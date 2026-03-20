'use server';

import { getCurrentUserContext } from '@/lib/server/current-user';
import {
  listDisputeEvents,
  listDisputesForUser,
  openTransportDispute,
} from '@/lib/server/dispute-resolution';
import { actionFail, actionOk } from '@/lib/server/action-result';

export async function openDisputeAction(input: {
  dealId: string;
  reason: string;
  evidenceNotes?: string;
}) {
  try {
    const context = await getCurrentUserContext();
    if (!context) {
      return actionFail('UNAUTHORIZED', 'User not authenticated', null);
    }

    if (!input.dealId || !input.reason?.trim()) {
      return actionFail('VALIDATION_ERROR', 'dealId and reason are required', null);
    }

    const created = await openTransportDispute({
      userId: context.authUser.id,
      dealId: input.dealId,
      reason: input.reason,
      evidenceNotes: input.evidenceNotes,
    });

    if (!created) {
      return actionFail('FORBIDDEN', 'You are not allowed to open a dispute for this deal', null);
    }

    return actionOk({
      disputeId: created.id,
      status: created.status,
      autoResolution: created.auto_resolution,
      confidence: created.auto_confidence,
    });
  } catch (error) {
    console.error('Open dispute action error:', error);
    return actionFail('UNKNOWN_ERROR', 'Failed to open dispute', null);
  }
}

export async function getMyDisputesAction() {
  try {
    const context = await getCurrentUserContext();
    if (!context) {
      return actionFail('UNAUTHORIZED', 'User not authenticated', null);
    }

    const rows = await listDisputesForUser(context.authUser.id);
    return actionOk(rows);
  } catch (error) {
    console.error('List disputes action error:', error);
    return actionFail('UNKNOWN_ERROR', 'Failed to load disputes', null);
  }
}

export async function getDisputeEventsAction(disputeId: string) {
  try {
    const context = await getCurrentUserContext();
    if (!context) {
      return actionFail('UNAUTHORIZED', 'User not authenticated', null);
    }

    if (!disputeId) {
      return actionFail('VALIDATION_ERROR', 'disputeId is required', null);
    }

    const rows = await listDisputeEvents(disputeId, context.authUser.id);
    return actionOk(rows);
  } catch (error) {
    console.error('List dispute events action error:', error);
    return actionFail('UNKNOWN_ERROR', 'Failed to load dispute events', null);
  }
}
