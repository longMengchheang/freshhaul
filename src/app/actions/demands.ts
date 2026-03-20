'use server';

import { db } from '@/lib/db';
import { buyerDemands } from '@/lib/db/schema';
import { actionFail, actionOk, mapUnknownActionError } from '@/lib/server/action-result';
import { getCurrentUserContext } from '@/lib/server/current-user';
import { hasActiveRole } from '@/lib/user-roles';
import { findDemandById, listMyDemands, listOpenDemands } from '@/lib/server/logistics';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const createDemandSchema = z.object({
  produce_type: z.string().trim().min(2).max(120),
  quantity_kg: z.string().trim().regex(/^\d+(\.\d{1,2})?$/),
  max_price_usd: z.string().trim().regex(/^\d+(\.\d{1,2})?$/),
  delivery_lat: z.string().trim().regex(/^-?\d+(\.\d+)?$/),
  delivery_lng: z.string().trim().regex(/^-?\d+(\.\d+)?$/),
  delivery_country_code: z.string().trim().regex(/^[A-Z]{2}$/),
  delivery_province: z.string().trim().min(2).max(120),
  deadline: z.date(),
});

export async function createBuyerDemand(data: {
  produce_type: string;
  quantity_kg: string;
  max_price_usd: string;
  delivery_lat: string;
  delivery_lng: string;
  delivery_country_code: string;
  delivery_province: string;
  deadline: Date;
}) {
  try {
    const context = await getCurrentUserContext();
    if (!context) {
      return actionFail('UNAUTHORIZED', 'Unauthorized');
    }

    if (!hasActiveRole(context.profile.roles, 'buyer')) {
      return actionFail('FORBIDDEN', 'Buyer access is not available for this account.');
    }

    const parsed = createDemandSchema.safeParse(data);
    if (!parsed.success) {
      return actionFail(
        'VALIDATION_ERROR',
        parsed.error.issues[0]?.message ?? 'Please complete all demand fields.',
      );
    }

    await db.insert(buyerDemands).values({
      buyer_id: context.authUser.id,
      produce_type: parsed.data.produce_type,
      quantity_kg: parsed.data.quantity_kg,
      max_price_usd: parsed.data.max_price_usd,
      delivery_lat: parsed.data.delivery_lat,
      delivery_lng: parsed.data.delivery_lng,
      delivery_country_code: parsed.data.delivery_country_code,
      delivery_province: parsed.data.delivery_province,
      deadline: parsed.data.deadline,
      status: 'open',
    });

    revalidatePath('/marketplace');
    revalidatePath('/post-demand');
    revalidatePath('/deals');
    return actionOk();
  } catch (error) {
    console.error('Create Buyer Demand Error:', error);
    return mapUnknownActionError(
      error,
      'Could not create buyer demand. Check amount, price, and map pin, then retry.',
    );
  }
}

export async function getOpenDemands() {
  try {
    const context = await getCurrentUserContext();
    if (!context) {
      return actionFail('UNAUTHORIZED', 'Unauthorized', []);
    }

    const rows = await listOpenDemands();
    return actionOk(rows);
  } catch (error) {
    console.error('Fetch Demands Error:', error);
    return actionFail('UNKNOWN_ERROR', 'Failed to fetch demands', []);
  }
}

export async function getMyDemands() {
  try {
    const context = await getCurrentUserContext();
    if (!context) {
      return actionFail('UNAUTHORIZED', 'Unauthorized', []);
    }

    const rows = await listMyDemands(context.authUser.id);
    return actionOk(rows);
  } catch (error) {
    console.error('Fetch My Demands Error:', error);
    return actionFail('UNKNOWN_ERROR', 'Failed to fetch your demands', []);
  }
}

export async function getDemandById(demandId: string) {
  try {
    const context = await getCurrentUserContext();
    if (!context) {
      return actionFail('UNAUTHORIZED', 'Unauthorized', null);
    }

    const row = await findDemandById(demandId);
    return actionOk(row);
  } catch (error) {
    console.error('Fetch Demand Error:', error);
    return actionFail('UNKNOWN_ERROR', 'Failed to fetch demand', null);
  }
}

export async function cancelDemand(demandId: string) {
  try {
    const context = await getCurrentUserContext();
    if (!context) {
      return actionFail('UNAUTHORIZED', 'Unauthorized');
    }

    const demand = await findDemandById(demandId);
    if (!demand) {
      return actionFail('NOT_FOUND', 'Demand not found.');
    }

    if (demand.buyer_id !== context.authUser.id) {
      return actionFail('FORBIDDEN', 'Only the demand owner can cancel it.');
    }

    if (demand.status !== 'open') {
      return actionFail('CONFLICT', 'Only open demands can be cancelled. This demand may already be matched to a deal.');
    }

    const { eq: eqOp } = await import('drizzle-orm');
    const { deals } = await import('@/lib/db/schema');
    const activeDeals = await db.query.deals.findMany({
      where: eqOp(deals.demand_id, demandId),
      columns: { id: true, status: true },
    });

    const hasActiveDeals = activeDeals.some((deal) =>
      !['rejected', 'cancelled', 'completed'].includes(deal.status),
    );

    if (hasActiveDeals) {
      return actionFail('CONFLICT', 'Cannot cancel a demand that has active deals. Cancel or complete the deals first.');
    }

    await db.update(buyerDemands).set({ status: 'cancelled' }).where(eqOp(buyerDemands.id, demandId));

    revalidatePath('/marketplace');
    revalidatePath('/deals');
    revalidatePath('/post-demand');
    return actionOk();
  } catch (error) {
    console.error('Cancel Demand Error:', error);
    return mapUnknownActionError(error, 'Failed to cancel demand');
  }
}
