'use server';

import { getCurrentUserContext } from '@/lib/server/current-user';
import { hasActiveRole } from '@/lib/user-roles';
import { listDealsForDriverMatchesCompact } from '@/lib/server/logistics';
import { findConsolidationOpportunities } from '@/lib/server/consolidation-engine';
import { actionFail, actionOk } from '@/lib/server/action-result';
import type { ConsolidationOpportunity } from '@/lib/server/consolidation-engine';

import { db } from '@/lib/db';
import { jobConsolidations, consolidationExecutions } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Fetch consolidation opportunities for driver's current matching deals
 */
export async function getConsolidationOpportunities() {
  try {
    const context = await getCurrentUserContext();
    if (!context) {
      return actionFail('UNAUTHORIZED', 'User not authenticated', null);
    }

    if (!hasActiveRole(context.profile.roles, 'driver')) {
      return actionFail('FORBIDDEN', 'Driver role not active on this account', null);
    }

    // Fetch driver's current matching deals
    const matchingDeals = await listDealsForDriverMatchesCompact(context.authUser.id);

    // Filter to transport_pending (no driver assigned yet)
    const pendingDeals = matchingDeals.filter(
      (deal) => deal.status === 'transport_pending' && deal.matches.length === 0
    );

    if (pendingDeals.length < 2) {
      return actionOk<ConsolidationOpportunity[]>([]);
    }

    // Find consolidation opportunities
    const opportunities = await findConsolidationOpportunities(context.authUser.id, pendingDeals);

    return actionOk(opportunities);
  } catch (error) {
    console.error('Consolidation opportunities error:', error);
    return actionFail(
      'UNKNOWN_ERROR',
      'Failed to load consolidation opportunities',
      null
    );
  }
}

/**
 * Accept a consolidation opportunity and create execution records
 */
export async function acceptConsolidation(consolidationId: string) {
  try {
    const context = await getCurrentUserContext();
    if (!context) {
      return actionFail('UNAUTHORIZED', 'User not authenticated', null);
    }

    if (!hasActiveRole(context.profile.roles, 'driver')) {
      return actionFail('FORBIDDEN', 'Driver role not active on this account', null);
    }

    // Verify consolidation belongs to this driver and is in suggested state
    const consolidation = await db.query.jobConsolidations.findFirst({
      where: and(
        eq(jobConsolidations.id, consolidationId),
        eq(jobConsolidations.driver_id, context.authUser.id),
        eq(jobConsolidations.status, 'suggested')
      ),
    });

    if (!consolidation) {
      return actionFail('NOT_FOUND', 'Consolidation not found or expired', null);
    }

    // Create execution record for the acceptance action
    await db.insert(consolidationExecutions).values({
      consolidation_id: consolidationId,
      deal_id: consolidation.primary_deal_id,
      sequence_order: 1,
      status: 'accepted',
    });

    // Update consolidation status to accepted
    await db
      .update(jobConsolidations)
      .set({ 
        status: 'accepted',
        updated_at: new Date(),
      })
      .where(eq(jobConsolidations.id, consolidationId));

    return actionOk({ message: 'Consolidation accepted' });
  } catch (error) {
    console.error('Accept consolidation error:', error);
    return actionFail('UNKNOWN_ERROR', 'Failed to accept consolidation', null);
  }
}

/**
 * Reject a consolidation opportunity
 */
export async function rejectConsolidation(consolidationId: string) {
  try {
    const context = await getCurrentUserContext();
    if (!context) {
      return actionFail('UNAUTHORIZED', 'User not authenticated', null);
    }

    if (!hasActiveRole(context.profile.roles, 'driver')) {
      return actionFail('FORBIDDEN', 'Driver role not active on this account', null);
    }

    // Verify consolidation belongs to this driver and is in suggested state
    const consolidation = await db.query.jobConsolidations.findFirst({
      where: and(
        eq(jobConsolidations.id, consolidationId),
        eq(jobConsolidations.driver_id, context.authUser.id),
        eq(jobConsolidations.status, 'suggested')
      ),
    });

    if (!consolidation) {
      return actionFail('NOT_FOUND', 'Consolidation not found or expired', null);
    }

    // Create execution record for the rejection action
    await db.insert(consolidationExecutions).values({
      consolidation_id: consolidationId,
      deal_id: consolidation.primary_deal_id,
      sequence_order: 1,
      status: 'rejected',
    });

    // Update consolidation status to rejected
    await db
      .update(jobConsolidations)
      .set({ 
        status: 'rejected',
        updated_at: new Date(),
      })
      .where(eq(jobConsolidations.id, consolidationId));

    return actionOk({ message: 'Consolidation rejected' });
  } catch (error) {
    console.error('Reject consolidation error:', error);
    return actionFail('UNKNOWN_ERROR', 'Failed to reject consolidation', null);
  }
}
