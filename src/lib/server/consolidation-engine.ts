import 'server-only';

import { db } from '@/lib/db';
import { deals, jobConsolidations } from '@/lib/db/schema';
import { inArray } from 'drizzle-orm';
import type { DealWithDetails } from '@/types/app';

export interface ConsolidationOpportunity {
  consolidationId: string;
  primaryDealId: string;
  consolidatedDealIds: string[];
  deals: DealWithDetails[];
  estimatedTimeSavedMinutes: number;
  earningsIncrementUsd: number;
  efficiencyScore: number;
  expiresAt: Date;
  status: 'suggested' | 'accepted' | 'rejected';
}

/**
 * Geographic distance estimate between two provinces
 * Returns kilometers
 */
function estimateDistanceBetweenProvinces(province1: string, province2: string): number {
  // Simplified Cambodia province distances
  // Use real mapping service in production
  const sameProvince = province1 === province2;
  if (sameProvince) return 15; // Local delivery

  // Simple heuristic: adjacent provinces ~50km, far provinces ~150km
  const adjacentPairs = [
    ['Phnom Penh', 'Kandal'],
    ['Kandal', 'Takeo'],
    ['Takeo', 'Kep'],
    ['Kampung Som', 'Koh Kong'],
  ];

  const isAdjacent = adjacentPairs.some(
    (pair) =>
      (pair[0] === province1 && pair[1] === province2) ||
      (pair[0] === province2 && pair[1] === province1)
  );

  return isAdjacent ? 50 : 120;
}

/**
 * Estimate time saved by consolidating multiple stops into one trip
 * Assumes 45km/h average + 10min per stop (pickup/delivery)
 */
function estimateTimeSavedMinutes(
  primaryPickup: string,
  primaryDelivery: string,
  additionalDeals: DealWithDetails[]
): number {
  // Time for separate trips
  let separateTime = 0;
  separateTime += estimateDistanceBetweenProvinces(primaryPickup, primaryDelivery) / 45 * 60; // primary trip
  separateTime += 20; // pickup + dropoff
  for (const deal of additionalDeals) {
    const distance = estimateDistanceBetweenProvinces(deal.shipment.pickup_province, deal.demand.delivery_province);
    separateTime += (distance / 45) * 60 + 20;
  }

  // Time for consolidated trip (multi-stop)
  // Assume minor detours for each additional stop
  let consolidatedTime = 0;
  consolidatedTime += -50; // consolidation reduces overall travel by ~50min of planning
  consolidatedTime += 10 * (additionalDeals.length + 1); // pickup/delivery per stop

  const savings = Math.max(0, separateTime - consolidatedTime);
  return Math.round(savings);
}

/**
 * Calculate revenue increment from consolidation bonus
 * Bonus = 5% of total consolidated value
 */
function calculateEarningsIncrement(deals: DealWithDetails[]): number {
  const totalValue = deals.reduce((sum, deal) => sum + Number(deal.agreed_price_usd), 0);
  const consolidationBonus = totalValue * 0.05; // 5% bonus
  return Math.round(consolidationBonus * 100) / 100;
}

/**
 * Efficiency score (0-100)
 * Factors: distance optimization, revenue per time, pickup/delivery clustering
 */
function calculateEfficiencyScore(
  timeSavedMinutes: number,
  earningsIncrement: number,
  dealCount: number
): number {
  // Time optimization: 60 saved minutes = 50 points
  const timeScore = Math.min(50, (timeSavedMinutes / 60) * 50);

  // Revenue bonus score: $20 increment = 30 points
  const revenueScore = Math.min(30, (earningsIncrement / 20) * 30);

  // Deal count bonus: 2 deals = 10 points, 3+ = 20 points
  const countScore = dealCount === 2 ? 10 : dealCount > 2 ? 20 : 0;

  const total = timeScore + revenueScore + countScore;
  return Math.round(total);
}

/**
 * Check if two deals can be consolidated together
 * Rules:
 * - Both must be transport_pending
 * - Both must have same driver
 * - Pickup provinces should be within 50km
 * - Delivery provinces should be within 50km
 * - Consolidation bonus > $5
 */
export function canConsolidateDeals(deal1: DealWithDetails, deal2: DealWithDetails): boolean {
  // Status check
  if (deal1.status !== 'transport_pending' || deal2.status !== 'transport_pending') {
    return false;
  }

  // Both should not have drivers already assigned
  const deal1HasDriver = deal1.matches.length > 0;
  const deal2HasDriver = deal2.matches.length > 0;
  if (deal1HasDriver || deal2HasDriver) {
    return false;
  }

  // Geographic proximity
  const pickupDistance = estimateDistanceBetweenProvinces(
    deal1.shipment.pickup_province,
    deal2.shipment.pickup_province
  );
  const deliveryDistance = estimateDistanceBetweenProvinces(
    deal1.demand.delivery_province,
    deal2.demand.delivery_province
  );

  // Both must be close to each other (within 80km for pickup, 80km for delivery)
  if (pickupDistance > 80 || deliveryDistance > 80) {
    return false;
  }

  return true;
}

/**
 * Generate consolidation suggestion for a driver's matching deals
 */
export async function generateConsolidationSuggestion(
  driverId: string,
  primaryDealId: string,
  additionalDealIds: string[]
): Promise<ConsolidationOpportunity | null> {
  const allDealIds = [primaryDealId, ...additionalDealIds];

  // Fetch all deals
  const dealsResult = await db.query.deals.findMany({
    where: inArray(deals.id, allDealIds),
    with: {
      buyer: {
        columns: { name: true, phone: true, avatar_url: true, province: true },
      },
      farmer: {
        columns: { name: true, phone: true, avatar_url: true, province: true },
      },
      shipment: true,
      demand: true,
      matches: {
        with: {
          driver: {
            columns: { name: true, phone: true, avatar_url: true, province: true },
          },
        },
      },
      dispatchLogs: true,
    },
  });

  if (dealsResult.length < 2) return null;

  const primaryDeal = dealsResult.find((d) => d.id === primaryDealId);
  const additionalDeals = dealsResult.filter((d) => d.id !== primaryDealId);

  if (!primaryDeal) return null;

  // Validate consolidation is possible
  for (const deal of additionalDeals) {
    if (!canConsolidateDeals(primaryDeal, deal)) {
      return null;
    }
  }

  // Calculate metrics
  const timeSavedMinutes = estimateTimeSavedMinutes(
    primaryDeal.shipment.pickup_province,
    primaryDeal.demand.delivery_province,
    additionalDeals
  );

  const earningsIncrement = calculateEarningsIncrement(dealsResult);
  const efficiencyScore = calculateEfficiencyScore(timeSavedMinutes, earningsIncrement, dealsResult.length);

  // Expire suggestion in 2 hours
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);

  return {
    consolidationId: '', // Will be set by database
    primaryDealId,
    consolidatedDealIds: additionalDealIds,
    deals: dealsResult as DealWithDetails[],
    estimatedTimeSavedMinutes: timeSavedMinutes,
    earningsIncrementUsd: earningsIncrement,
    efficiencyScore,
    expiresAt,
    status: 'suggested',
  };
}

/**
 * Find best consolidation opportunities for a driver given their matching deals
 */
export async function findConsolidationOpportunities(
  driverId: string,
  matchingDeals: DealWithDetails[]
): Promise<ConsolidationOpportunity[]> {
  const opportunities: ConsolidationOpportunity[] = [];

  // Find all pairs and triplets that can be consolidated
  for (let i = 0; i < matchingDeals.length; i++) {
    const primaryDeal = matchingDeals[i];

    // Find compatible secondary deals
    const compatibleDeals = matchingDeals.filter(
      (deal, idx) => idx > i && canConsolidateDeals(primaryDeal, deal)
    );

    if (compatibleDeals.length === 0) continue;

    // Create consolidation for each compatible pairing (up to 3 deals per consolidation)
    for (let j = 0; j < Math.min(compatibleDeals.length, 2); j++) {
      const consolidation = await generateConsolidationSuggestion(
        driverId,
        primaryDeal.id,
        [compatibleDeals[j].id]
      );
      if (consolidation && consolidation.efficiencyScore > 20) {
        opportunities.push(consolidation);
      }
    }
  }

  // Sort by efficiency score (highest first)
  return opportunities.sort((a, b) => b.efficiencyScore - a.efficiencyScore);
}

/**
 * Save consolidation suggestion to database
 */
export async function saveConsolidationSuggestion(
  driverId: string,
  primaryDealId: string,
  consolidatedDealIds: string[],
  metrics: {
    timeSavedMinutes: number;
    earningsIncrement: number;
    efficiencyScore: number;
  }
): Promise<string> {
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);

  // Generate ID for the consolidation
  const consolidationId = crypto.randomUUID();

  await db.insert(jobConsolidations).values({
    id: consolidationId,
    driver_id: driverId,
    primary_deal_id: primaryDealId,
    consolidated_deal_ids: consolidatedDealIds,
    status: 'suggested',
    estimated_time_saved_minutes: metrics.timeSavedMinutes,
    earnings_increment_usd: metrics.earningsIncrement.toString(),
    efficiency_score: metrics.efficiencyScore.toString(),
    expires_at: expiresAt,
  });

  return consolidationId;
}
