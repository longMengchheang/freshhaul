'use server';

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { deals, matches } from '@/lib/db/schema';
import { validateDealTransition } from '@/lib/server/deal-lifecycle';
import { getCurrentUserContext } from '@/lib/server/current-user';
import { findAccessibleTransportDeal } from '@/lib/server/logistics';
import { revalidatePath } from 'next/cache';

export async function getTripWorkspace(dealId: string) {
  try {
    const context = await getCurrentUserContext();
    if (!context) {
      return { success: false, error: 'Unauthorized', data: null };
    }

    const deal = await findAccessibleTransportDeal(dealId, context.authUser.id);
    if (!deal) {
      return { success: false, error: 'Trip not found.', data: null };
    }

    return { success: true, data: deal };
  } catch (error) {
    console.error('Fetch Trip Workspace Error:', error);
    return { success: false, error: 'Failed to load trip workspace', data: null };
  }
}

export async function updateTripStatus(
  dealId: string,
  newStatus: 'transport_pending' | 'in_transit' | 'completed',
) {
  try {
    const context = await getCurrentUserContext();
    if (!context) {
      return { success: false, error: 'Unauthorized' };
    }

    const deal = await findAccessibleTransportDeal(dealId, context.authUser.id);
    if (!deal) {
      return { success: false, error: 'Trip not found.' };
    }

    const isAllowed =
      deal.farmer_id === context.authUser.id ||
      deal.matches.some((match) => match.driver_id === context.authUser.id);

    if (!isAllowed) {
      return { success: false, error: 'Only the farmer or assigned driver can update trip status.' };
    }

    const transition = validateDealTransition({
      currentStatus: deal.status,
      nextStatus: newStatus,
      hasAssignedDriver: deal.matches.length > 0,
    });
    if (!transition.ok) {
      return { success: false, error: transition.error ?? 'Invalid trip status transition.' };
    }

    if (deal.status === newStatus) {
      return { success: true, noChange: true };
    }

    await db.transaction(async (tx) => {
      await tx.update(deals).set({ status: newStatus }).where(eq(deals.id, dealId));

      if (deal.matches[0]) {
        await tx.update(matches).set({
          status:
            newStatus === 'completed'
              ? 'completed'
              : newStatus === 'in_transit'
                ? 'in_transit'
                : 'accepted',
        }).where(eq(matches.id, deal.matches[0].id));
      }
    });

    revalidatePath('/deals');
    revalidatePath('/browse-trips');
    revalidatePath(`/trip/${dealId}`);
    return { success: true };
  } catch (error) {
    console.error('Update Trip Status Error:', error);
    return { success: false, error: 'Failed to update trip status' };
  }
}
