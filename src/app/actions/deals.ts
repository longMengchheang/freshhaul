'use server';

import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { buyerDemands, deals, shipmentRequests } from '@/lib/db/schema';
import { actionFail, actionOk, mapUnknownActionError } from '@/lib/server/action-result';
import { getCurrentUserContext } from '@/lib/server/current-user';
import { enqueueAutoDispatchForDeal } from '@/lib/server/dispatch';
import { mapCommercialDealActionToStatus, validateDealTransition } from '@/lib/server/deal-lifecycle';
import {
  findDemandById,
  findDealById,
  findShipmentById,
  listDealsForDriverMatchesCompact,
  listDealsForParticipantsCompact,
  listActiveMarketplaceHeroPromotion,
  listMyDemands,
  listMyShipmentOffers,
  listOpenDemands,
  listOpenShipmentOffers,
} from '@/lib/server/logistics';
import { hasActiveRole } from '@/lib/user-roles';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const createDealSchema = z.object({
  demand_id: z.string().uuid(),
  shipment_id: z.string().uuid(),
  agreed_price_usd: z.string().trim().regex(/^\d+(\.\d{1,2})?$/),
  quantity_kg: z.string().trim().regex(/^\d+(\.\d{1,2})?$/),
});

export async function createDealProposal(data: {
  demand_id: string;
  shipment_id: string;
  agreed_price_usd: string;
  quantity_kg: string;
}) {
  try {
    const context = await getCurrentUserContext();
    if (!context) {
      return actionFail('UNAUTHORIZED', 'Unauthorized');
    }

    const parsed = createDealSchema.safeParse(data);
    if (!parsed.success) {
      return actionFail(
        'VALIDATION_ERROR',
        parsed.error.issues[0]?.message ?? 'Please check the deal values and try again.',
      );
    }
    const demand = await findDemandById(parsed.data.demand_id);
    const shipment = await findShipmentById(parsed.data.shipment_id);

    if (!demand || !shipment) {
      return actionFail('NOT_FOUND', 'Demand or shipment offer not found.');
    }

    if (demand.status !== 'open' || shipment.status !== 'open') {
      return actionFail('CONFLICT', 'Only open demands and shipment offers can be matched.');
    }

    const isBuyerOwner = context.authUser.id === demand.buyer_id;
    const isFarmerOwner = context.authUser.id === shipment.farmer_id;

    if (!isBuyerOwner && !isFarmerOwner) {
      return actionFail('FORBIDDEN', 'You can only create a deal from your own demand or shipment.');
    }

    const existingDeal = await db.query.deals.findFirst({
      where: and(
        eq(deals.demand_id, parsed.data.demand_id),
        eq(deals.shipment_id, parsed.data.shipment_id),
      ),
    });

    if (existingDeal) {
      return actionFail('CONFLICT', 'A deal already exists for this demand and shipment.');
    }

    await db.insert(deals).values({
      buyer_id: demand.buyer_id,
      farmer_id: shipment.farmer_id,
      demand_id: demand.id,
      shipment_id: shipment.id,
      agreed_price_usd: parsed.data.agreed_price_usd,
      quantity_kg: parsed.data.quantity_kg,
      status: 'pending',
    });

    revalidatePath('/marketplace');
    revalidatePath('/deals');
    return actionOk();
  } catch (error) {
    console.error('Create Deal Proposal Error:', error);
    const message = error instanceof Error ? error.message : '';
    const code = typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: string }).code)
      : '';
    if (code === '23505' || /duplicate key value/i.test(message)) {
      return actionFail('CONFLICT', 'A deal already exists for this demand and shipment.');
    }
    return mapUnknownActionError(error, 'Failed to create deal proposal');
  }
}

export async function updateDealStatus(
  dealId: string,
  newStatus: 'accepted' | 'rejected' | 'completed' | 'cancelled',
) {
  try {
    const context = await getCurrentUserContext();
    if (!context) {
      return actionFail('UNAUTHORIZED', 'Unauthorized');
    }

    const deal = await findDealById(dealId);
    if (!deal) {
      return actionFail('NOT_FOUND', 'Deal not found.');
    }

    const isParticipant =
      deal.buyer_id === context.authUser.id || deal.farmer_id === context.authUser.id;

    if (!isParticipant) {
      return actionFail('FORBIDDEN', 'Only the buyer or farmer in this deal can update it.');
    }

    const targetStatus = mapCommercialDealActionToStatus(newStatus);
    const transition = validateDealTransition({
      currentStatus: deal.status,
      nextStatus: targetStatus,
      hasAssignedDriver: deal.matches.length > 0,
    });
    if (!transition.ok) {
      return actionFail('CONFLICT', transition.error ?? 'Invalid status transition.');
    }

    if (deal.status === targetStatus) {
      return actionOk({ noChange: true });
    }

    await db.transaction(async (tx) => {
      await tx.update(deals).set({
        status: targetStatus,
      }).where(eq(deals.id, dealId));

      if (targetStatus === 'transport_pending') {
        await tx.update(buyerDemands).set({ status: 'matched' }).where(eq(buyerDemands.id, deal.demand_id));
        await tx.update(shipmentRequests).set({ status: 'ready_for_transport' }).where(eq(shipmentRequests.id, deal.shipment_id));
      }

      if (targetStatus === 'completed') {
        await tx.update(buyerDemands).set({ status: 'fulfilled' }).where(eq(buyerDemands.id, deal.demand_id));
        await tx.update(shipmentRequests).set({ status: 'completed' }).where(eq(shipmentRequests.id, deal.shipment_id));
      }

      if (targetStatus === 'rejected' || targetStatus === 'cancelled') {
        await tx.update(buyerDemands).set({ status: 'open' }).where(eq(buyerDemands.id, deal.demand_id));
        await tx.update(shipmentRequests).set({ status: 'open' }).where(eq(shipmentRequests.id, deal.shipment_id));
      }
    });

    if (targetStatus === 'transport_pending') {
      try {
        await enqueueAutoDispatchForDeal(dealId);
      } catch (dispatchError) {
        console.error('Auto Dispatch Error:', dispatchError);
      }
    }

    revalidatePath('/marketplace');
    revalidatePath('/deals');
    revalidatePath(`/trip/${dealId}`);
    revalidatePath('/browse-trips');
    return actionOk();
  } catch (error) {
    console.error('Update Deal Status Error:', error);
    return mapUnknownActionError(error, 'Failed to update deal status');
  }
}

export async function getMyDeals() {
  try {
    const context = await getCurrentUserContext();
    if (!context) {
      return actionFail('UNAUTHORIZED', 'Unauthorized', []);
    }

    const [participantDeals, driverDeals] = await Promise.all([
      listDealsForParticipantsCompact(context.authUser.id),
      hasActiveRole(context.profile.roles, 'driver')
        ? listDealsForDriverMatchesCompact(context.authUser.id)
        : Promise.resolve([]),
    ]);

    const seenDealIds = new Set<string>();
    const rows = [...participantDeals, ...driverDeals].filter((deal) => {
      if (seenDealIds.has(deal.id)) {
        return false;
      }

      seenDealIds.add(deal.id);
      return true;
    });

    return actionOk(rows);
  } catch (error) {
    console.error('Fetch My Deals Error:', error);
    return actionFail('UNKNOWN_ERROR', 'Failed to fetch deals', []);
  }
}

export async function getDealDetail(dealId: string) {
  try {
    const context = await getCurrentUserContext();
    if (!context) {
      return actionFail('UNAUTHORIZED', 'Unauthorized', null);
    }

    const row = await findDealById(dealId);
    if (!row) {
      return actionFail('NOT_FOUND', 'Deal not found.', null);
    }

    const hasAccess =
      row.buyer_id === context.authUser.id ||
      row.farmer_id === context.authUser.id ||
      row.matches.some((match) => match.driver_id === context.authUser.id);

    if (!hasAccess) {
      return actionFail('FORBIDDEN', 'Forbidden', null);
    }

    return actionOk(row);
  } catch (error) {
    console.error('Fetch Deal Detail Error:', error);
    return actionFail('UNKNOWN_ERROR', 'Failed to fetch deal detail', null);
  }
}

export async function getMarketplaceSnapshot() {
  const emptySnapshot = {
    openDemands: [] as Awaited<ReturnType<typeof listOpenDemands>>,
    openShipments: [] as Awaited<ReturnType<typeof listOpenShipmentOffers>>,
    myDemands: [] as Awaited<ReturnType<typeof listMyDemands>>,
    myShipments: [] as Awaited<ReturnType<typeof listMyShipmentOffers>>,
    heroPromotion: null as Awaited<ReturnType<typeof listActiveMarketplaceHeroPromotion>>,
  };

  try {
    const context = await getCurrentUserContext();
    if (!context) {
      return actionFail('UNAUTHORIZED', 'Unauthorized', emptySnapshot);
    }

    const [openDemandsResult, openShipmentsResult, myDemandsResult, myShipmentsResult, heroPromotionResult] = await Promise.allSettled([
      listOpenDemands(),
      listOpenShipmentOffers(),
      hasActiveRole(context.profile.roles, 'buyer') ? listMyDemands(context.authUser.id) : Promise.resolve([]),
      hasActiveRole(context.profile.roles, 'farmer') ? listMyShipmentOffers(context.authUser.id) : Promise.resolve([]),
      listActiveMarketplaceHeroPromotion(),
    ]);

    const openDemands = openDemandsResult.status === 'fulfilled' ? openDemandsResult.value : [];
    const openShipments = openShipmentsResult.status === 'fulfilled' ? openShipmentsResult.value : [];
    const myDemands = myDemandsResult.status === 'fulfilled' ? myDemandsResult.value : [];
    const myShipments = myShipmentsResult.status === 'fulfilled' ? myShipmentsResult.value : [];
    const heroPromotion = heroPromotionResult.status === 'fulfilled' ? heroPromotionResult.value : null;

    if (openDemandsResult.status === 'rejected') {
      console.error('Marketplace snapshot degraded: open demands failed', openDemandsResult.reason);
    }
    if (openShipmentsResult.status === 'rejected') {
      console.error('Marketplace snapshot degraded: open shipments failed', openShipmentsResult.reason);
    }
    if (myDemandsResult.status === 'rejected') {
      console.error('Marketplace snapshot degraded: my demands failed', myDemandsResult.reason);
    }
    if (myShipmentsResult.status === 'rejected') {
      console.error('Marketplace snapshot degraded: my shipments failed', myShipmentsResult.reason);
    }
    if (heroPromotionResult.status === 'rejected') {
      console.error('Marketplace snapshot degraded: hero promotion failed', heroPromotionResult.reason);
    }

    return actionOk({
      openDemands,
      openShipments,
      myDemands,
      myShipments,
      heroPromotion,
    });
  } catch (error) {
    console.error('Fetch Marketplace Snapshot Error:', error);
    return actionFail('UNKNOWN_ERROR', 'Failed to fetch marketplace data', emptySnapshot);
  }
}
