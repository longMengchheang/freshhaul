import 'server-only';

import { and, eq, inArray, lt } from 'drizzle-orm';
import { db } from '@/lib/db';
import { availableTrips, dispatchJobs, dispatchLogs, userRoles } from '@/lib/db/schema';
import { normalizeCountryCode, normalizeProvinceName } from '@/lib/province';
import { findDealById, listDealsForDriverBoard } from '@/lib/server/logistics';
import type { DispatchJobSummary } from '@/types/app';

const AUTO_DISPATCH_LIMIT = 5;
const AUTO_DISPATCH_WINDOW_MINUTES = 20;
const AUTO_DISPATCH_REQUEUE_COOLDOWN_MS = 3 * 60 * 1000;

function toDate(value: string | Date) {
  return value instanceof Date ? value : new Date(value);
}

function scoreTripForDeal(input: {
  quantityKg: number;
  pricePerKg: number;
  capacityKg: number;
  availableFrom: Date;
  availableTo: Date;
  pickupDeadline: Date;
  deliveryDeadline: Date;
}) {
  const {
    quantityKg,
    pricePerKg,
    capacityKg,
    availableFrom,
    availableTo,
    pickupDeadline,
    deliveryDeadline,
  } = input;

  if (capacityKg < quantityKg) {
    return -1;
  }

  let score = 60;
  const capacityHeadroomRatio = quantityKg > 0 ? (capacityKg - quantityKg) / quantityKg : 0;
  score += Math.min(18, Math.max(0, capacityHeadroomRatio * 10));
  score += Math.max(0, 18 - Math.min(18, pricePerKg));

  if (availableFrom <= pickupDeadline) {
    score += 10;
  }

  if (availableTo >= deliveryDeadline) {
    score += 12;
  }

  if (availableFrom <= new Date()) {
    score += 4;
  }

  return Number(score.toFixed(2));
}

export async function enqueueAutoDispatchForDeal(dealId: string) {
  const deal = await findDealById(dealId);
  if (!deal) {
    return { queued: 0 };
  }

  if (!['accepted', 'transport_pending'].includes(deal.status) || deal.matches.length > 0) {
    return { queued: 0 };
  }

  const now = new Date();
  const existingQueue = await db.query.dispatchJobs.findMany({
    where: and(
      eq(dispatchJobs.deal_id, dealId),
      inArray(dispatchJobs.status, ['queued', 'seen']),
    ),
    columns: {
      id: true,
      expires_at: true,
    },
  });

  const activeQueue = existingQueue.filter((job) => toDate(job.expires_at) >= now);
  if (activeQueue.length > 0) {
    return { queued: activeQueue.length, reused: true };
  }

  const dealQuantityKg = Number(deal.quantity_kg);
  const pickupCountryCode = normalizeCountryCode(deal.shipment.pickup_country_code);
  const deliveryCountryCode = normalizeCountryCode(deal.demand.delivery_country_code);
  const pickupDeadline = toDate(deal.shipment.deadline);
  const deliveryDeadline = toDate(deal.demand.deadline);

  const [tripRows, activeDriverRoleRows] = await Promise.all([
    db.query.availableTrips.findMany({
      where: and(
        eq(availableTrips.status, 'active'),
        eq(availableTrips.from_country_code, pickupCountryCode),
        eq(availableTrips.to_country_code, deliveryCountryCode),
      ),
      orderBy: (fields, { desc }) => [desc(fields.created_at)],
    }),
    db.query.userRoles.findMany({
      where: and(eq(userRoles.role_name, 'driver'), eq(userRoles.status, 'active')),
      columns: { user_id: true },
    }),
  ]);

  const activeDriverIds = new Set(activeDriverRoleRows.map((row) => row.user_id));

  const scoredTrips = tripRows
    .filter((trip) => {
      if (!activeDriverIds.has(trip.driver_id)) {
        return false;
      }

      if (
        normalizeProvinceName(trip.from_province) !== normalizeProvinceName(deal.shipment.pickup_province) ||
        normalizeProvinceName(trip.to_province) !== normalizeProvinceName(deal.demand.delivery_province)
      ) {
        return false;
      }

      return true;
    })
    .map((trip) => {
      const score = scoreTripForDeal({
        quantityKg: dealQuantityKg,
        pricePerKg: Number(trip.price_per_kg),
        capacityKg: Number(trip.capacity_kg),
        availableFrom: toDate(trip.available_from),
        availableTo: toDate(trip.available_to),
        pickupDeadline,
        deliveryDeadline,
      });

      return { trip, score };
    })
    .filter((row) => row.score > 0);

  const bestTripPerDriver = new Map<string, { trip: typeof tripRows[number]; score: number }>();
  for (const row of scoredTrips) {
    const previous = bestTripPerDriver.get(row.trip.driver_id);
    if (!previous || row.score > previous.score) {
      bestTripPerDriver.set(row.trip.driver_id, row);
    }
  }

  const ranked = [...bestTripPerDriver.values()]
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return Number(a.trip.price_per_kg) - Number(b.trip.price_per_kg);
    })
    .slice(0, AUTO_DISPATCH_LIMIT);

  const expiresAt = new Date(Date.now() + AUTO_DISPATCH_WINDOW_MINUTES * 60_000);

  await db.transaction(async (tx) => {
    await tx.delete(dispatchJobs).where(eq(dispatchJobs.deal_id, dealId));

    if (ranked.length === 0) {
      await tx.insert(dispatchLogs).values({
        deal_id: dealId,
        event_type: 'no_driver_available',
        message: 'No active driver route matched this deal for auto-dispatch.',
      });
      return;
    }

    await tx.insert(dispatchLogs).values({
      deal_id: dealId,
      event_type: 'deal_queued',
      message: `Auto-dispatch queued for ${ranked.length} drivers.`,
    });

    for (const [index, candidate] of ranked.entries()) {
      const [createdJob] = await tx
        .insert(dispatchJobs)
        .values({
          deal_id: dealId,
          driver_id: candidate.trip.driver_id,
          trip_id: candidate.trip.id,
          score: candidate.score.toFixed(2),
          priority_rank: index + 1,
          status: 'queued',
          expires_at: expiresAt,
          updated_at: new Date(),
        })
        .returning({ id: dispatchJobs.id });

      await tx.insert(dispatchLogs).values({
        deal_id: dealId,
        driver_id: candidate.trip.driver_id,
        dispatch_job_id: createdJob.id,
        event_type: 'driver_notified',
        message: `Driver rank #${index + 1} queued with score ${candidate.score.toFixed(2)}.`,
      });
    }
  });

  return { queued: ranked.length };
}

export async function listDispatchQueueForDriver(driverId: string) {
  const now = new Date();

  await db
    .update(dispatchJobs)
    .set({ status: 'expired', updated_at: now })
    .where(
      and(
        eq(dispatchJobs.driver_id, driverId),
        inArray(dispatchJobs.status, ['queued', 'seen']),
        lt(dispatchJobs.expires_at, now),
      ),
    );

  const rows = await db.query.dispatchJobs.findMany({
    where: and(
      eq(dispatchJobs.driver_id, driverId),
      inArray(dispatchJobs.status, ['queued', 'seen']),
    ),
    orderBy: (fields, { asc }) => [asc(fields.priority_rank), asc(fields.expires_at)],
  });

  const filtered = rows.filter((job) => toDate(job.expires_at) >= now);
  return filtered as DispatchJobSummary[];
}

export async function enqueueAutoDispatchForRoute(
  fromCountryCode: string,
  fromProvince: string,
  toCountryCode: string,
  toProvince: string,
) {
  const normalizedFromCountryCode = normalizeCountryCode(fromCountryCode);
  const normalizedFrom = normalizeProvinceName(fromProvince);
  const normalizedToCountryCode = normalizeCountryCode(toCountryCode);
  const normalizedTo = normalizeProvinceName(toProvince);
  const driverBoardDeals = await listDealsForDriverBoard();

  const candidateDeals = driverBoardDeals.filter(
    (deal) =>
      normalizeCountryCode(deal.shipment.pickup_country_code) === normalizedFromCountryCode &&
      normalizeProvinceName(deal.shipment.pickup_province) === normalizedFrom &&
      normalizeCountryCode(deal.demand.delivery_country_code) === normalizedToCountryCode &&
      normalizeProvinceName(deal.demand.delivery_province) === normalizedTo,
  );

  let queuedDeals = 0;
  let skippedCooldown = 0;

  for (const deal of candidateDeals) {
    const lastQueueLog = await db.query.dispatchLogs.findFirst({
      where: and(eq(dispatchLogs.deal_id, deal.id), eq(dispatchLogs.event_type, 'deal_queued')),
      columns: { created_at: true },
      orderBy: (fields, { desc }) => [desc(fields.created_at)],
    });

    if (lastQueueLog) {
      const elapsed = Date.now() - toDate(lastQueueLog.created_at).getTime();
      if (elapsed < AUTO_DISPATCH_REQUEUE_COOLDOWN_MS) {
        skippedCooldown += 1;
        continue;
      }
    }

    await enqueueAutoDispatchForDeal(deal.id);
    queuedDeals += 1;
  }

  return { queuedDeals, skippedCooldown };
}
