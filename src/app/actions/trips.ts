'use server';

import { and, eq, inArray, ne } from 'drizzle-orm';
import { db } from '@/lib/db';
import { availableTrips, deals, dispatchJobs, dispatchLogs, matches } from '@/lib/db/schema';
import { isSameLocation } from '@/lib/province';
import { actionFail, actionOk, mapUnknownActionError } from '@/lib/server/action-result';
import { validateDealTransition } from '@/lib/server/deal-lifecycle';
import { getCurrentUserContext } from '@/lib/server/current-user';
import { enqueueAutoDispatchForRoute } from '@/lib/server/dispatch';
import { hasActiveRole } from '@/lib/user-roles';
import {
  filterMatchingDealsForRoute,
  filterRouteOpportunityDeals,
  findDealById,
  listAvailableTripsForDriver,
  listDealsForDriverBoard,
} from '@/lib/server/logistics';
import { buildTripOptimizationResult } from '@/lib/server/trip-optimization';
import { listDispatchQueueForDriver } from '@/lib/server/dispatch';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const createTripSchema = z.object({
  from_country_code: z.string().trim().regex(/^[A-Z]{2}$/),
  from_province: z.string().trim().min(2).max(120),
  to_country_code: z.string().trim().regex(/^[A-Z]{2}$/),
  to_province: z.string().trim().min(2).max(120),
  truck_type: z.string().trim().min(2).max(120),
  capacity_kg: z.string().trim().regex(/^\d+(\.\d{1,2})?$/),
  available_from: z.date(),
  available_to: z.date(),
  price_per_kg: z.string().trim().regex(/^\d+(\.\d{1,2})?$/),
});

export async function createAvailableTrip(data: {
  from_country_code: string;
  from_province: string;
  to_country_code: string;
  to_province: string;
  truck_type: string;
  capacity_kg: string;
  available_from: Date;
  available_to: Date;
  price_per_kg: string;
}) {
  try {
    const context = await getCurrentUserContext();
    if (!context) {
      return actionFail('UNAUTHORIZED', 'Please sign in first.');
    }

    if (!hasActiveRole(context.profile.roles, 'driver')) {
      return actionFail('FORBIDDEN', 'Driver access is not active on this account yet.');
    }

    const parsed = createTripSchema.safeParse(data);
    if (!parsed.success) {
      return actionFail(
        'VALIDATION_ERROR',
        parsed.error.issues[0]?.message ?? 'Enter valid trip details.',
      );
    }

    if (isSameLocation(
      parsed.data.from_country_code,
      parsed.data.from_province,
      parsed.data.to_country_code,
      parsed.data.to_province,
    )) {
      return actionFail('VALIDATION_ERROR', 'Start and destination location cannot be the same.');
    }

    if (parsed.data.available_to <= parsed.data.available_from) {
      return actionFail('VALIDATION_ERROR', 'End time must be later than start time.');
    }

    await db.insert(availableTrips).values({
      driver_id: context.authUser.id,
      from_country_code: parsed.data.from_country_code,
      from_province: parsed.data.from_province,
      to_country_code: parsed.data.to_country_code,
      to_province: parsed.data.to_province,
      truck_type: parsed.data.truck_type,
      capacity_kg: parsed.data.capacity_kg,
      available_from: parsed.data.available_from,
      available_to: parsed.data.available_to,
      price_per_kg: parsed.data.price_per_kg,
      status: 'active',
    });

    try {
      await enqueueAutoDispatchForRoute(
        parsed.data.from_country_code,
        parsed.data.from_province,
        parsed.data.to_country_code,
        parsed.data.to_province,
      );
    } catch (dispatchError) {
      console.error('Auto Dispatch Route Queue Error:', dispatchError);
    }

    revalidatePath('/browse-trips');
    const createdTrip = await db.query.availableTrips.findFirst({
      where: and(
        eq(availableTrips.driver_id, context.authUser.id),
        eq(availableTrips.from_country_code, parsed.data.from_country_code),
        eq(availableTrips.from_province, parsed.data.from_province),
        eq(availableTrips.to_country_code, parsed.data.to_country_code),
        eq(availableTrips.to_province, parsed.data.to_province),
        eq(availableTrips.status, 'active'),
      ),
      orderBy: (fields, { desc }) => [desc(fields.created_at)],
    });

    return actionOk({ tripId: createdTrip?.id ?? null });
  } catch (error) {
    console.error('Create Available Trip Error:', error);
    return mapUnknownActionError(
      error,
      'Could not save the route. Check province, capacity, and schedule, then retry.',
    );
  }
}

export async function getDriverBoard(selectedTripId?: string) {
  try {
    const context = await getCurrentUserContext();
    if (!context || !hasActiveRole(context.profile.roles, 'driver')) {
      return actionFail('UNAUTHORIZED', 'Unauthorized', {
        trips: [],
        selectedTrip: undefined,
        matchingDeals: [],
        opportunityDeals: [],
        optimization: buildTripOptimizationResult({
          selectedTrip: null,
          matchingDeals: [],
          opportunityDeals: [],
        }),
        diagnostics: {
          totalOpenDeals: 0,
          routeMatchedDeals: 0,
          routeOpportunityDeals: 0,
          queueVisibleDeals: 0,
          mismatchSummary: {
            routeMismatch: 0,
            capacityMismatch: 0,
            scheduleMismatch: 0,
          },
        },
      });
    }

    const [trips, driverDeals] = await Promise.all([
      listAvailableTripsForDriver(context.authUser.id),
      listDealsForDriverBoard(),
    ]);

    let initialDispatchQueue: Awaited<ReturnType<typeof listDispatchQueueForDriver>> = [];
    try {
      initialDispatchQueue = await listDispatchQueueForDriver(context.authUser.id);
    } catch (dispatchQueueError) {
      console.error('Driver board dispatch queue load degraded:', dispatchQueueError);
      initialDispatchQueue = [];
    }

    const selectedTrip = selectedTripId
      ? trips.find((trip) => trip.id === selectedTripId)
      : trips[0];

    const routeMatchedDeals = selectedTrip && selectedTrip.status === 'active'
      ? filterMatchingDealsForRoute(
          driverDeals,
          selectedTrip.from_country_code,
          selectedTrip.from_province,
          selectedTrip.to_country_code,
          selectedTrip.to_province,
        )
      : [];
    const opportunityDeals = selectedTrip && selectedTrip.status === 'active'
      ? filterRouteOpportunityDeals(
          driverDeals,
          selectedTrip.from_country_code,
          selectedTrip.from_province,
          selectedTrip.to_country_code,
          selectedTrip.to_province,
        )
      : [];

    let dispatchQueue = initialDispatchQueue;

    // Auto-escalation: if this route has transport-pending deals but queue is empty/stale,
    // regenerate dispatch offers so drivers see actionable jobs immediately.
    const hasRouteQueue = routeMatchedDeals.some((deal) =>
      dispatchQueue.some((job) => job.deal_id === deal.id),
    );
    const hasTransportPendingRouteDeal = routeMatchedDeals.some((deal) => deal.status === 'transport_pending');

    if (selectedTrip && selectedTrip.status === 'active' && hasTransportPendingRouteDeal && !hasRouteQueue) {
      try {
        await enqueueAutoDispatchForRoute(
          selectedTrip.from_country_code,
          selectedTrip.from_province,
          selectedTrip.to_country_code,
          selectedTrip.to_province,
        );
        dispatchQueue = await listDispatchQueueForDriver(context.authUser.id);
      } catch (dispatchRefreshError) {
        console.error('Driver board dispatch refresh degraded:', dispatchRefreshError);
      }
    }

    const dispatchByDealId = new Map(dispatchQueue.map((job) => [job.deal_id, job]));

    const queueAware = routeMatchedDeals
      .map((deal) => ({
        ...deal,
        dispatchJob: dispatchByDealId.get(deal.id) ?? null,
      }))
      .sort((left, right) => {
        if (left.dispatchJob && right.dispatchJob) {
          return left.dispatchJob.priority_rank - right.dispatchJob.priority_rank;
        }

        if (left.dispatchJob) return -1;
        if (right.dispatchJob) return 1;
        return 0;
      });

    const matchingDeals = queueAware;
    const optimization = buildTripOptimizationResult({
      selectedTrip: selectedTrip ?? null,
      matchingDeals,
      opportunityDeals,
    });
    const diagnostics = {
      totalOpenDeals: driverDeals.length,
      routeMatchedDeals: routeMatchedDeals.length,
      routeOpportunityDeals: opportunityDeals.length,
      queueVisibleDeals: queueAware.filter((deal) => Boolean(deal.dispatchJob)).length,
      mismatchSummary: {
        routeMismatch: 0,
        capacityMismatch: 0,
        scheduleMismatch: 0,
      },
    };

    if (selectedTrip && selectedTrip.status === 'active') {
      const selectedCapacity = Number(selectedTrip.capacity_kg);
      const availableFrom = new Date(selectedTrip.available_from);
      const availableTo = new Date(selectedTrip.available_to);
      const routeMatchedIds = new Set(routeMatchedDeals.map((deal) => deal.id));

      for (const deal of driverDeals) {
        if (!routeMatchedIds.has(deal.id)) {
          diagnostics.mismatchSummary.routeMismatch += 1;
          continue;
        }

        const quantityKg = Number(deal.quantity_kg);
        const pickupDeadline = new Date(deal.shipment.deadline);
        const deliveryDeadline = new Date(deal.demand.deadline);
        const failsCapacity = quantityKg > selectedCapacity;
        const failsSchedule = availableFrom > pickupDeadline || availableTo < deliveryDeadline;

        if (failsCapacity) diagnostics.mismatchSummary.capacityMismatch += 1;
        if (failsSchedule) diagnostics.mismatchSummary.scheduleMismatch += 1;
      }
    }

    return actionOk({
      trips,
      selectedTrip,
      matchingDeals,
      opportunityDeals,
      optimization,
      diagnostics,
    });
  } catch (error) {
    console.error('Fetch Driver Board Error:', error);
    const mapped = mapUnknownActionError(error, 'Failed to load driver board');
    return {
      ...mapped,
      data: {
        trips: [],
        selectedTrip: undefined,
        matchingDeals: [],
        opportunityDeals: [],
        optimization: buildTripOptimizationResult({
          selectedTrip: null,
          matchingDeals: [],
          opportunityDeals: [],
        }),
        diagnostics: {
          totalOpenDeals: 0,
          routeMatchedDeals: 0,
          routeOpportunityDeals: 0,
          queueVisibleDeals: 0,
          mismatchSummary: {
            routeMismatch: 0,
            capacityMismatch: 0,
            scheduleMismatch: 0,
          },
        },
      },
    };
  }
}

export async function claimDealWithTrip(dealId: string, tripId: string) {
  try {
    const context = await getCurrentUserContext();
    if (!context || !hasActiveRole(context.profile.roles, 'driver')) {
      return actionFail('FORBIDDEN', 'Driver access is not active on this account.');
    }

    const [deal, trip] = await Promise.all([
      findDealById(dealId),
      db.query.availableTrips.findFirst({
        where: and(eq(availableTrips.id, tripId), eq(availableTrips.driver_id, context.authUser.id)),
      }),
    ]);

    if (!deal || !trip) {
      return actionFail('NOT_FOUND', 'The job or route could not be found.');
    }

    const existingByDriver = deal.matches.find((match) => match.driver_id === context.authUser.id);
    if (existingByDriver) {
      return actionOk({ alreadyClaimed: true });
    }

    const existingMatch = deal.matches.find((match) =>
      ['pending', 'accepted', 'in_transit', 'completed'].includes(match.status),
    );

    if (existingMatch) {
      return actionFail('CONFLICT', 'This job has already been claimed by another driver.');
    }

    if (trip.status !== 'active') {
      return actionFail('CONFLICT', 'This route is already in use. Please add a new route for another job.');
    }

    const transition = validateDealTransition({
      currentStatus: deal.status,
      nextStatus: 'in_transit',
      hasAssignedDriver: true,
    });
    if (!transition.ok) {
      return {
        ...actionFail('CONFLICT', transition.error ?? 'This job is no longer open for driver assignment.'),
      };
    }

    await db.transaction(async (tx) => {
      const freshDeal = await tx.query.deals.findFirst({
        where: eq(deals.id, dealId),
        columns: {
          id: true,
          status: true,
        },
      });

      if (!freshDeal) {
        throw new Error('DEAL_NOT_FOUND');
      }

      const freshTrip = await tx.query.availableTrips.findFirst({
        where: and(eq(availableTrips.id, tripId), eq(availableTrips.driver_id, context.authUser.id)),
        columns: {
          id: true,
          status: true,
        },
      });

      if (!freshTrip) {
        throw new Error('TRIP_NOT_FOUND');
      }

      if (freshTrip.status !== 'active') {
        throw new Error('TRIP_NOT_ACTIVE');
      }

      const freshTransition = validateDealTransition({
        currentStatus: freshDeal.status,
        nextStatus: 'in_transit',
        hasAssignedDriver: true,
      });

      if (!freshTransition.ok) {
        throw new Error('DEAL_NOT_ASSIGNABLE');
      }

      const freshExistingByDriver = await tx.query.matches.findFirst({
        where: and(eq(matches.deal_id, dealId), eq(matches.driver_id, context.authUser.id)),
      });

      if (freshExistingByDriver) {
        return;
      }

      const freshExistingMatch = await tx.query.matches.findFirst({
        where: and(
          eq(matches.deal_id, dealId),
          inArray(matches.status, ['pending', 'accepted', 'in_transit', 'completed']),
        ),
      });

      if (freshExistingMatch) {
        throw new Error('JOB_ALREADY_CLAIMED');
      }

      await tx.insert(matches).values({
        deal_id: dealId,
        driver_id: context.authUser.id,
        status: 'accepted',
        commission_percent: '4.50',
      });

      await tx.update(availableTrips).set({ status: 'matched' }).where(eq(availableTrips.id, tripId));
      await tx.update(deals).set({ status: 'in_transit' }).where(eq(deals.id, dealId));

      const [claimedDispatchJob] = await tx
        .update(dispatchJobs)
        .set({ status: 'claimed', updated_at: new Date() })
        .where(
          and(
            eq(dispatchJobs.deal_id, dealId),
            eq(dispatchJobs.driver_id, context.authUser.id),
            inArray(dispatchJobs.status, ['queued', 'seen']),
          ),
        )
        .returning({ id: dispatchJobs.id });

      const expiredDispatchJobs = await tx
        .update(dispatchJobs)
        .set({ status: 'expired', updated_at: new Date() })
        .where(
          and(
            eq(dispatchJobs.deal_id, dealId),
            ne(dispatchJobs.driver_id, context.authUser.id),
            inArray(dispatchJobs.status, ['queued', 'seen']),
          ),
        )
        .returning({ id: dispatchJobs.id, driver_id: dispatchJobs.driver_id });

      await tx.insert(dispatchLogs).values({
        deal_id: dealId,
        driver_id: context.authUser.id,
        dispatch_job_id: claimedDispatchJob?.id ?? null,
        event_type: 'driver_claimed',
        message: 'Driver claimed this transport job from auto-dispatch queue.',
      });

      if (expiredDispatchJobs.length > 0) {
        await tx.insert(dispatchLogs).values({
          deal_id: dealId,
          event_type: 'dispatch_expired',
          message: `${expiredDispatchJobs.length} queued dispatch offer(s) expired after claim.`,
        });
      }
    });

    revalidatePath('/browse-trips');
    revalidatePath('/deals');
    revalidatePath(`/trip/${dealId}`);
    return actionOk();
  } catch (error) {
    if (error instanceof Error && error.message === 'JOB_ALREADY_CLAIMED') {
      return actionFail('CONFLICT', 'This job has already been claimed by another driver.');
    }
    if (error instanceof Error && error.message === 'TRIP_NOT_ACTIVE') {
      return actionFail('CONFLICT', 'This route is already in use. Please add a new route for another job.');
    }
    if (error instanceof Error && error.message === 'DEAL_NOT_ASSIGNABLE') {
      return actionFail('CONFLICT', 'This job is no longer open for driver assignment.');
    }
    if (error instanceof Error && error.message === 'DEAL_NOT_FOUND') {
      return actionFail('NOT_FOUND', 'The job could not be found.');
    }
    if (error instanceof Error && error.message === 'TRIP_NOT_FOUND') {
      return actionFail('NOT_FOUND', 'The route could not be found.');
    }

    console.error('Claim Deal With Trip Error:', error);
    return actionFail('UNKNOWN_ERROR', 'Could not take this transport job. Please try again.');
  }
}
