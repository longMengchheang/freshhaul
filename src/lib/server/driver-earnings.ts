import 'server-only';

import { and, eq, gte, lte } from 'drizzle-orm';
import { db } from '@/lib/db';
import { matches } from '@/lib/db/schema';

export interface EarningsRecord {
  dealId: string;
  produceType: string;
  pickupProvince: string;
  deliveryProvince: string;
  agreedPriceUsd: string;
  quantityKg: string;
  commissionPercent: string;
  dealStatus: string;
  createdAt: Date;
  completedAt?: Date;
  estimatedGasUsd: number;
  estimatedWearUsd: number;
  netProfitUsd: number;
}

export interface EarningsSummary {
  totalEarnings: number;
  totalCommissionEarnings: number;
  estimatedGasCosts: number;
  estimatedWearCosts: number;
  netProfit: number;
  completedJobs: number;
  activeJobs: number;
  periodDays: number;
}

export interface EarningsTrend {
  produceType: string;
  jobCount: number;
  averageProfitPerJob: number;
  totalProfit: number;
}

const ESTIMATED_FUEL_PRICE_PER_KM = 0.15; // USD
const ESTIMATED_WEAR_PER_KM = 0.08; // USD (maintenance/depreciation)
const DISTANCE_KM_ESTIMATE = 50; // Conservative average provincial distance

/**
 * Estimate round-trip distance in km between two provinces.
 * This is a simplified heuristic; in production, use real routing API.
 */
function estimateDistanceKm(fromProvince: string, toProvince: string): number {
  // Default conservative estimate
  if (fromProvince === toProvince) return 50; // Local delivery
  return DISTANCE_KM_ESTIMATE;
}

/**
 * Calculate estimated operational costs for a trip.
 */
function calculateOperationalCosts(
  distanceKm: number,
  quantityKg: string
): { gas: number; wear: number } {
  const qty = Number(quantityKg) || 1;
  const baseFuel = distanceKm * ESTIMATED_FUEL_PRICE_PER_KM;
  const baseWear = distanceKm * ESTIMATED_WEAR_PER_KM;

  // Scale slightly with load for heavier goods (more fuel, more wear)
  const loadFactor = Math.min(qty / 100, 1.2); // Cap at 1.2x for very heavy loads

  return {
    gas: Math.round(baseFuel * loadFactor * 100) / 100,
    wear: Math.round(baseWear * loadFactor * 100) / 100,
  };
}

/**
 * Fetch all completed transport jobs for a driver within a date range.
 */
export async function getDriverEarningsHistory(
  driverId: string,
  startDate?: Date,
  endDate?: Date
): Promise<EarningsRecord[]> {
  const whereConditions = [eq(matches.driver_id, driverId), eq(matches.status, 'completed')];
  
  if (startDate) {
    whereConditions.push(gte(matches.created_at, startDate));
  }
  if (endDate) {
    whereConditions.push(lte(matches.created_at, endDate));
  }

  const records = await db.query.matches.findMany({
    where: and(...whereConditions),
    with: {
      deal: {
        with: {
          shipment: {
            columns: {
              produce_type: true,
              pickup_province: true,
              quantity_kg: true,
            },
          },
          demand: {
            columns: {
              delivery_province: true,
            },
          },
        },
      },
    },
  });

  return records
    .filter((match) => match.deal?.shipment && match.deal?.demand)
    .map((match) => {
      const deal = match.deal!;
      const shipment = deal.shipment!;
      const demand = deal.demand!;

      const commissionRate = Number(match.commission_percent) / 100;
      const earningUsd = Number(deal.agreed_price_usd) * commissionRate;

      const distance = estimateDistanceKm(
        shipment.pickup_province,
        demand.delivery_province
      );
      const { gas, wear } = calculateOperationalCosts(
        distance,
        shipment.quantity_kg
      );
      const netProfit = earningUsd - gas - wear;

      return {
        dealId: deal.id,
        produceType: shipment.produce_type,
        pickupProvince: shipment.pickup_province,
        deliveryProvince: demand.delivery_province,
        agreedPriceUsd: deal.agreed_price_usd,
        quantityKg: shipment.quantity_kg,
        commissionPercent: match.commission_percent,
        dealStatus: deal.status,
        createdAt: new Date(match.created_at),
        completedAt: deal.status === 'completed' ? new Date(deal.created_at) : undefined,
        estimatedGasUsd: gas,
        estimatedWearUsd: wear,
        netProfitUsd: netProfit,
      };
    });
}

/**
 * Get summary earnings for a driver in a date range.
 */
export async function getDriverEarningsSummary(
  driverId: string,
  startDate?: Date,
  endDate?: Date
): Promise<EarningsSummary> {
  const history = await getDriverEarningsHistory(driverId, startDate, endDate);
  const completed = history.filter((record) =>
    ['completed'].includes(record.dealStatus)
  );

  const totalEarnings = completed.reduce(
    (sum, record) =>
      sum + Number(record.agreedPriceUsd) * (Number(record.commissionPercent) / 100),
    0
  );
  const estimatedGas = completed.reduce((sum, r) => sum + r.estimatedGasUsd, 0);
  const estimatedWear = completed.reduce((sum, r) => sum + r.estimatedWearUsd, 0);
  const netProfit = completed.reduce((sum, r) => sum + r.netProfitUsd, 0);

  const periodDays = endDate && startDate ? Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) : 7;

  return {
    totalEarnings: Math.round(totalEarnings * 100) / 100,
    totalCommissionEarnings: totalEarnings,
    estimatedGasCosts: Math.round(estimatedGas * 100) / 100,
    estimatedWearCosts: Math.round(estimatedWear * 100) / 100,
    netProfit: Math.round(netProfit * 100) / 100,
    completedJobs: completed.length,
    activeJobs: history.filter((r) => r.dealStatus !== 'completed').length,
    periodDays,
  };
}

/**
 * Get earnings by produce type to show trends.
 */
export async function getDriverEarningsTrends(
  driverId: string,
  startDate?: Date,
  endDate?: Date
): Promise<EarningsTrend[]> {
  const history = await getDriverEarningsHistory(driverId, startDate, endDate);
  const completed = history.filter((r) => r.dealStatus === 'completed');

  const byType = new Map<string, EarningsTrend>();

  for (const record of completed) {
    const existing = byType.get(record.produceType) || {
      produceType: record.produceType,
      jobCount: 0,
      averageProfitPerJob: 0,
      totalProfit: 0,
    };

    existing.jobCount += 1;
    existing.totalProfit += record.netProfitUsd;
    existing.averageProfitPerJob = existing.totalProfit / existing.jobCount;

    byType.set(record.produceType, existing);
  }

  return Array.from(byType.values()).sort(
    (a, b) => b.totalProfit - a.totalProfit
  );
}
