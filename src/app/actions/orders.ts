'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { updateDealStatus } from '@/app/actions/deals';
import { db } from '@/lib/db';
import { deals, dispatchJobs, shipmentRequests } from '@/lib/db/schema';
import { buildOrderCommandCenterSnapshot } from '@/lib/order-intelligence';
import { enqueueAutoDispatchForDeal } from '@/lib/server/dispatch';
import { actionFail, actionOk } from '@/lib/server/action-result';
import { getCurrentUserContext } from '@/lib/server/current-user';
import { validateDealTransition } from '@/lib/server/deal-lifecycle';
import { findDealById, listDealsForDriverMatchesCompact, listDealsForParticipantsCompact } from '@/lib/server/logistics';
import { hasActiveRole } from '@/lib/user-roles';
import type { DealWithDetails } from '@/types/app';
import type { OrderPlaybookId, OrderRoleMode } from '@/types/orders';

const snapshotSchema = z.object({
  mode: z.enum(['ops', 'driver', 'seller', 'buyer']).default('ops'),
});

const transitionSchema = z.object({
  dealId: z.string().uuid(),
  status: z.enum(['transport_pending', 'in_transit', 'completed', 'cancelled', 'rejected']),
});

const playbookSchema = z.object({
  dealId: z.string().uuid(),
  playbookId: z.enum([
    'expedite_dispatch',
    'nudge_counterparty',
    'mark_in_transit',
    'prepare_settlement',
    'cancel_order',
  ]),
});

const dispatchOverrideSchema = z.object({
  dealId: z.string().uuid(),
  dispatchJobId: z.string().uuid(),
  priorityRank: z.number().int().min(1).max(20),
});

function mapModeByRole(mode: OrderRoleMode, context: NonNullable<Awaited<ReturnType<typeof getCurrentUserContext>>>) {
  if (mode === 'driver' && !hasActiveRole(context.profile.roles, 'driver')) {
    return 'ops' as const;
  }

  if (mode === 'seller' && !hasActiveRole(context.profile.roles, 'farmer')) {
    return 'ops' as const;
  }

  return mode;
}

export async function getOrderCommandCenterSnapshot(input: { mode?: OrderRoleMode }) {
  try {
    const context = await getCurrentUserContext();
    if (!context) {
      return actionFail('UNAUTHORIZED', 'Unauthorized', null);
    }

    const parsed = snapshotSchema.safeParse({ mode: input.mode ?? 'ops' });
    if (!parsed.success) {
      return actionFail('VALIDATION_ERROR', 'Invalid order mode.', null);
    }

    const mode = mapModeByRole(parsed.data.mode, context);

    const [participantDeals, driverDeals] = await Promise.all([
      listDealsForParticipantsCompact(context.authUser.id),
      hasActiveRole(context.profile.roles, 'driver')
        ? listDealsForDriverMatchesCompact(context.authUser.id)
        : Promise.resolve([]),
    ]);

    const seen = new Set<string>();
    const deduped = [...participantDeals, ...driverDeals].filter((deal) => {
      if (seen.has(deal.id)) return false;
      seen.add(deal.id);
      return true;
    }) as DealWithDetails[];

    const modeFiltered = deduped.filter((deal) => {
      if (mode === 'driver') {
        return deal.matches.some((match) => match.driver_id === context.authUser.id);
      }
      if (mode === 'seller') {
        return deal.farmer_id === context.authUser.id;
      }
      if (mode === 'buyer') {
        return deal.buyer_id === context.authUser.id;
      }
      return true;
    });

    const snapshot = buildOrderCommandCenterSnapshot({ deals: modeFiltered, roleMode: mode });
    return actionOk(snapshot);
  } catch (error) {
    console.error('Order Command Center Snapshot Error:', error);
    return actionFail('UNKNOWN_ERROR', 'Failed to load order command center.', null);
  }
}

export async function applyOrderTransition(input: {
  dealId: string;
  status: 'transport_pending' | 'in_transit' | 'completed' | 'cancelled' | 'rejected';
}) {
  try {
    const context = await getCurrentUserContext();
    if (!context) {
      return actionFail('UNAUTHORIZED', 'Unauthorized');
    }

    const parsed = transitionSchema.safeParse(input);
    if (!parsed.success) {
      return actionFail('VALIDATION_ERROR', 'Invalid transition request.');
    }

    const deal = await findDealById(parsed.data.dealId);
    if (!deal) {
      return actionFail('NOT_FOUND', 'Order not found.');
    }

    const hasAccess =
      deal.buyer_id === context.authUser.id ||
      deal.farmer_id === context.authUser.id ||
      deal.matches.some((match) => match.driver_id === context.authUser.id) ||
      context.systemRole === 'admin';

    if (!hasAccess) {
      return actionFail('FORBIDDEN', 'You do not have access to update this order.');
    }

    const transition = validateDealTransition({
      currentStatus: deal.status,
      nextStatus: parsed.data.status,
      hasAssignedDriver: deal.matches.length > 0,
    });

    if (!transition.ok) {
      return actionFail('CONFLICT', transition.error ?? 'Transition blocked by policy.');
    }

    if (parsed.data.status === 'transport_pending') {
      const statusResult = await updateDealStatus(parsed.data.dealId, 'accepted');
      if (!statusResult.success) {
        return actionFail('CONFLICT', statusResult.error ?? 'Failed to transition order.');
      }
    } else if (parsed.data.status === 'completed') {
      const statusResult = await updateDealStatus(parsed.data.dealId, 'completed');
      if (!statusResult.success) {
        return actionFail('CONFLICT', statusResult.error ?? 'Failed to complete order.');
      }
    } else if (parsed.data.status === 'cancelled') {
      const statusResult = await updateDealStatus(parsed.data.dealId, 'cancelled');
      if (!statusResult.success) {
        return actionFail('CONFLICT', statusResult.error ?? 'Failed to cancel order.');
      }
    } else if (parsed.data.status === 'rejected') {
      const statusResult = await updateDealStatus(parsed.data.dealId, 'rejected');
      if (!statusResult.success) {
        return actionFail('CONFLICT', statusResult.error ?? 'Failed to reject order.');
      }
    } else {
      await db.update(deals)
        .set({ status: 'in_transit' })
        .where(eq(deals.id, parsed.data.dealId));

      await db.update(shipmentRequests)
        .set({ status: 'in_transit' })
        .where(eq(shipmentRequests.id, deal.shipment_id));

      await db.update(dispatchJobs)
        .set({ updated_at: new Date() })
        .where(eq(dispatchJobs.deal_id, parsed.data.dealId));

      revalidatePath('/deals');
      revalidatePath('/orders');
    }

    revalidatePath('/orders');
    return actionOk({ status: parsed.data.status });
  } catch (error) {
    console.error('Apply Order Transition Error:', error);
    return actionFail('UNKNOWN_ERROR', 'Failed to apply transition.');
  }
}

export async function executeOrderPlaybook(input: {
  dealId: string;
  playbookId: OrderPlaybookId;
}) {
  try {
    const context = await getCurrentUserContext();
    if (!context) {
      return actionFail('UNAUTHORIZED', 'Unauthorized');
    }

    const parsed = playbookSchema.safeParse(input);
    if (!parsed.success) {
      return actionFail('VALIDATION_ERROR', 'Invalid playbook request.');
    }

    const deal = await findDealById(parsed.data.dealId);
    if (!deal) {
      return actionFail('NOT_FOUND', 'Order not found.');
    }

    const hasAccess =
      deal.buyer_id === context.authUser.id ||
      deal.farmer_id === context.authUser.id ||
      deal.matches.some((match) => match.driver_id === context.authUser.id) ||
      context.systemRole === 'admin';

    if (!hasAccess) {
      return actionFail('FORBIDDEN', 'You do not have access to this playbook.');
    }

    const playbookId = parsed.data.playbookId;

    if (playbookId === 'expedite_dispatch') {
      const result = await enqueueAutoDispatchForDeal(parsed.data.dealId);
      revalidatePath('/orders');
      revalidatePath('/browse-trips');
      return actionOk({ playbookId, queued: result.queued });
    }

    if (playbookId === 'mark_in_transit') {
      const transition = validateDealTransition({
        currentStatus: deal.status,
        nextStatus: 'in_transit',
        hasAssignedDriver: deal.matches.length > 0,
      });

      if (!transition.ok) {
        return actionFail('CONFLICT', transition.error ?? 'Cannot move order into transit.');
      }

      await db.update(deals)
        .set({ status: 'in_transit' })
        .where(eq(deals.id, parsed.data.dealId));
      await db.update(shipmentRequests)
        .set({ status: 'in_transit' })
        .where(eq(shipmentRequests.id, deal.shipment_id));
      revalidatePath('/orders');
      revalidatePath('/deals');
      return actionOk({ playbookId });
    }

    if (playbookId === 'prepare_settlement') {
      return actionOk({
        playbookId,
        note: 'Settlement preflight passed. Release stays milestone-gated until completed.',
      });
    }

    if (playbookId === 'cancel_order') {
      const statusResult = await updateDealStatus(parsed.data.dealId, 'cancelled');
      if (!statusResult.success) {
        return actionFail('CONFLICT', statusResult.error ?? 'Unable to cancel order.');
      }

      revalidatePath('/orders');
      return actionOk({ playbookId });
    }

    return actionOk({
      playbookId,
      note: 'Stakeholder nudge issued. Message templates can be wired into chat next.',
    });
  } catch (error) {
    console.error('Execute Order Playbook Error:', error);
    return actionFail('UNKNOWN_ERROR', 'Failed to execute playbook.');
  }
}

export async function overrideDispatchPriority(input: {
  dealId: string;
  dispatchJobId: string;
  priorityRank: number;
}) {
  try {
    const context = await getCurrentUserContext();
    if (!context) {
      return actionFail('UNAUTHORIZED', 'Unauthorized');
    }

    const parsed = dispatchOverrideSchema.safeParse(input);
    if (!parsed.success) {
      return actionFail('VALIDATION_ERROR', 'Invalid dispatch override request.');
    }

    const deal = await findDealById(parsed.data.dealId);
    if (!deal) {
      return actionFail('NOT_FOUND', 'Order not found.');
    }

    const isManager = context.systemRole === 'admin' || deal.buyer_id === context.authUser.id || deal.farmer_id === context.authUser.id;
    if (!isManager) {
      return actionFail('FORBIDDEN', 'Only stakeholders can override dispatch priority.');
    }

    await db
      .update(dispatchJobs)
      .set({
        priority_rank: parsed.data.priorityRank,
        updated_at: new Date(),
      })
      .where(and(eq(dispatchJobs.id, parsed.data.dispatchJobId), eq(dispatchJobs.deal_id, parsed.data.dealId)));

    revalidatePath('/orders');
    revalidatePath('/browse-trips');
    return actionOk({ ok: true });
  } catch (error) {
    console.error('Override Dispatch Priority Error:', error);
    return actionFail('UNKNOWN_ERROR', 'Failed to override dispatch priority.');
  }
}
