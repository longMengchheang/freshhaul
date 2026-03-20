'use server';

import { db } from '@/lib/db';
import { shipmentRequests } from '@/lib/db/schema';
import { actionFail, actionOk, mapUnknownActionError } from '@/lib/server/action-result';
import { getCurrentUserContext } from '@/lib/server/current-user';
import { hasActiveRole } from '@/lib/user-roles';
import {
  findShipmentById,
  listMyShipmentOffers,
  listOpenShipmentOffers,
} from '@/lib/server/logistics';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const createShipmentSchema = z.object({
  produce_type: z.string().trim().min(2).max(120),
  quantity_kg: z.string().trim().regex(/^\d+(\.\d{1,2})?$/),
  product_image_url: z.string().trim().url().optional().or(z.literal('')),
  product_image_public_id: z.string().trim().min(1).max(255).optional().or(z.literal('')),
  pickup_lat: z.string().trim().regex(/^-?\d+(\.\d+)?$/),
  pickup_lng: z.string().trim().regex(/^-?\d+(\.\d+)?$/),
  pickup_country_code: z.string().trim().regex(/^[A-Z]{2}$/),
  pickup_province: z.string().trim().min(2).max(120),
  temp_required: z.enum(['ambient', 'chill', 'frozen']),
  deadline: z.date(),
});

export async function createShipmentOffer(data: {
  produce_type: string;
  quantity_kg: string;
  product_image_url?: string;
  product_image_public_id?: string;
  pickup_lat: string;
  pickup_lng: string;
  pickup_country_code: string;
  pickup_province: string;
  temp_required: string;
  deadline: Date;
}) {
  try {
    const context = await getCurrentUserContext();
    if (!context) {
      return actionFail('UNAUTHORIZED', 'Please sign in first.');
    }

    if (!hasActiveRole(context.profile.roles, 'farmer')) {
      return actionFail('FORBIDDEN', 'Farmer access is not active on this account yet.');
    }

    const parsed = createShipmentSchema.safeParse(data);
    if (!parsed.success) {
      return actionFail(
        'VALIDATION_ERROR',
        parsed.error.issues[0]?.message ?? 'Please check the produce form and try again.',
      );
    }

    if (parsed.data.deadline <= new Date()) {
      return actionFail('VALIDATION_ERROR', 'Pickup deadline must be later than now.');
    }

    await db.insert(shipmentRequests).values({
      farmer_id: context.authUser.id,
      produce_type: parsed.data.produce_type,
      quantity_kg: parsed.data.quantity_kg,
      product_image_url: parsed.data.product_image_url || null,
      product_image_public_id: parsed.data.product_image_public_id || null,
      pickup_lat: parsed.data.pickup_lat,
      pickup_lng: parsed.data.pickup_lng,
      pickup_country_code: parsed.data.pickup_country_code,
      pickup_province: parsed.data.pickup_province,
      temp_required: parsed.data.temp_required,
      deadline: parsed.data.deadline,
      status: 'open',
    });

    revalidatePath('/marketplace');
    revalidatePath('/post-shipment');
    revalidatePath('/deals');
    return actionOk();
  } catch (error) {
    console.error('Create Shipment Offer Error:', error);
    return mapUnknownActionError(
      error,
      'Could not save the produce listing. Check map pin, quantity, and deadline, then retry.',
    );
  }
}

export async function getOpenShipmentOffers() {
  try {
    const context = await getCurrentUserContext();
    if (!context) {
      return actionFail('UNAUTHORIZED', 'Unauthorized', []);
    }

    const rows = await listOpenShipmentOffers();
    return actionOk(rows);
  } catch (error) {
    console.error('Fetch Shipment Offers Error:', error);
    return actionFail('UNKNOWN_ERROR', 'Failed to fetch shipment offers', []);
  }
}

export async function getMyShipmentOffers() {
  try {
    const context = await getCurrentUserContext();
    if (!context) {
      return actionFail('UNAUTHORIZED', 'Unauthorized', []);
    }

    const rows = await listMyShipmentOffers(context.authUser.id);
    return actionOk(rows);
  } catch (error) {
    console.error('Fetch My Shipments Error:', error);
    return actionFail('UNKNOWN_ERROR', 'Failed to fetch your shipment offers', []);
  }
}

export async function getShipmentOfferById(shipmentId: string) {
  try {
    const context = await getCurrentUserContext();
    if (!context) {
      return actionFail('UNAUTHORIZED', 'Unauthorized', null);
    }

    const row = await findShipmentById(shipmentId);
    return actionOk(row);
  } catch (error) {
    console.error('Fetch Shipment Offer Error:', error);
    return actionFail('UNKNOWN_ERROR', 'Failed to fetch shipment offer', null);
  }
}

export async function cancelShipmentOffer(shipmentId: string) {
  try {
    const context = await getCurrentUserContext();
    if (!context) {
      return actionFail('UNAUTHORIZED', 'Unauthorized');
    }

    const shipment = await findShipmentById(shipmentId);
    if (!shipment) {
      return actionFail('NOT_FOUND', 'Shipment offer not found.');
    }

    if (shipment.farmer_id !== context.authUser.id) {
      return actionFail('FORBIDDEN', 'Only the shipment owner can cancel it.');
    }

    if (shipment.status !== 'open') {
      return actionFail('CONFLICT', 'Only open shipment offers can be cancelled. This offer may already be matched to a deal.');
    }

    const { eq: eqOp } = await import('drizzle-orm');
    const { deals } = await import('@/lib/db/schema');
    const activeDeals = await db.query.deals.findMany({
      where: eqOp(deals.shipment_id, shipmentId),
      columns: { id: true, status: true },
    });

    const hasActiveDeals = activeDeals.some((deal) =>
      !['rejected', 'cancelled', 'completed'].includes(deal.status),
    );

    if (hasActiveDeals) {
      return actionFail('CONFLICT', 'Cannot cancel a shipment offer that has active deals. Cancel or complete the deals first.');
    }

    await db.update(shipmentRequests).set({ status: 'cancelled' }).where(eqOp(shipmentRequests.id, shipmentId));

    revalidatePath('/marketplace');
    revalidatePath('/deals');
    revalidatePath('/post-shipment');
    return actionOk();
  } catch (error) {
    console.error('Cancel Shipment Offer Error:', error);
    return mapUnknownActionError(error, 'Failed to cancel shipment offer');
  }
}
