import 'server-only';

import { getDriverEarningsHistory } from '@/lib/server/driver-earnings';
import { db } from '@/lib/db';
import { driverReputationScores } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export interface AdvancedProfitSeriesPoint {
  date: string;
  jobs: number;
  totalProfit: number;
}

export interface AdvancedWeekdayPerformance {
  weekday: string;
  jobs: number;
  totalProfit: number;
  averageProfit: number;
}

export interface AdvancedRoutePerformance {
  route: string;
  jobs: number;
  totalProfit: number;
  averageProfit: number;
  averageQuantityKg: number;
}

export interface AdvancedEarningsOverview {
  totalProfit: number;
  totalJobs: number;
  averageProfitPerJob: number;
  medianProfitPerJob: number;
  profitMarginPercent: number;
  bestDayProfit: number;
  worstDayProfit: number;
  consistencyScore: number;
}

export interface AdvancedEarningsAnalytics {
  overview: AdvancedEarningsOverview;
  profitSeries: AdvancedProfitSeriesPoint[];
  weekdayPerformance: AdvancedWeekdayPerformance[];
  routePerformance: AdvancedRoutePerformance[];
  reputationSignal: {
    averageRating: number;
    totalRatings: number;
  } | null;
  insights: string[];
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function isReputationSchemaCompatibilityError(error: unknown) {
  const maybeCode = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: string }).code)
    : '';
  const maybeMessage = error instanceof Error ? error.message : '';

  if (maybeCode === '42P01' || maybeCode === '42703') {
    return true;
  }

  return /driver_reputation_scores|reputation_badge|does not exist|column|relation|schema/i.test(maybeMessage);
}

export async function getDriverAdvancedEarningsAnalytics(
  driverId: string,
  startDate?: Date,
  endDate?: Date,
): Promise<AdvancedEarningsAnalytics> {
  const history = await getDriverEarningsHistory(driverId, startDate, endDate);
  const completed = history.filter((record) => record.dealStatus === 'completed');

  const profitValues = completed.map((record) => record.netProfitUsd);
  const totalProfit = profitValues.reduce((sum, value) => sum + value, 0);
  const totalJobs = completed.length;
  const averageProfitPerJob = totalJobs > 0 ? totalProfit / totalJobs : 0;
  const medianProfitPerJob = median(profitValues);

  const totalCommission = completed.reduce((sum, record) => {
    return sum + Number(record.agreedPriceUsd) * (Number(record.commissionPercent) / 100);
  }, 0);
  const profitMarginPercent = totalCommission > 0 ? (totalProfit / totalCommission) * 100 : 0;

  const profitByDay = new Map<string, { jobs: number; totalProfit: number }>();
  for (const record of completed) {
    const key = record.createdAt.toISOString().slice(0, 10);
    const current = profitByDay.get(key) ?? { jobs: 0, totalProfit: 0 };
    current.jobs += 1;
    current.totalProfit += record.netProfitUsd;
    profitByDay.set(key, current);
  }

  const profitSeries = Array.from(profitByDay.entries())
    .map(([date, value]) => ({
      date,
      jobs: value.jobs,
      totalProfit: round2(value.totalProfit),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const dayProfits = profitSeries.map((point) => point.totalProfit);
  const bestDayProfit = dayProfits.length > 0 ? Math.max(...dayProfits) : 0;
  const worstDayProfit = dayProfits.length > 0 ? Math.min(...dayProfits) : 0;

  const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weekdayMap = new Map<number, { jobs: number; totalProfit: number }>();
  for (const record of completed) {
    const weekday = record.createdAt.getDay();
    const current = weekdayMap.get(weekday) ?? { jobs: 0, totalProfit: 0 };
    current.jobs += 1;
    current.totalProfit += record.netProfitUsd;
    weekdayMap.set(weekday, current);
  }

  const weekdayPerformance: AdvancedWeekdayPerformance[] = weekdayNames.map((name, index) => {
    const data = weekdayMap.get(index) ?? { jobs: 0, totalProfit: 0 };
    return {
      weekday: name,
      jobs: data.jobs,
      totalProfit: round2(data.totalProfit),
      averageProfit: data.jobs > 0 ? round2(data.totalProfit / data.jobs) : 0,
    };
  });

  const routeMap = new Map<string, { jobs: number; totalProfit: number; totalQuantity: number }>();
  for (const record of completed) {
    const route = `${record.pickupProvince} -> ${record.deliveryProvince}`;
    const current = routeMap.get(route) ?? { jobs: 0, totalProfit: 0, totalQuantity: 0 };
    current.jobs += 1;
    current.totalProfit += record.netProfitUsd;
    current.totalQuantity += Number(record.quantityKg) || 0;
    routeMap.set(route, current);
  }

  const routePerformance: AdvancedRoutePerformance[] = Array.from(routeMap.entries())
    .map(([route, data]) => ({
      route,
      jobs: data.jobs,
      totalProfit: round2(data.totalProfit),
      averageProfit: data.jobs > 0 ? round2(data.totalProfit / data.jobs) : 0,
      averageQuantityKg: data.jobs > 0 ? round2(data.totalQuantity / data.jobs) : 0,
    }))
    .sort((a, b) => b.totalProfit - a.totalProfit)
    .slice(0, 5);

  let consistencyScore = 0;
  if (profitSeries.length > 1) {
    const mean = dayProfits.reduce((sum, value) => sum + value, 0) / dayProfits.length;
    const variance = dayProfits.reduce((sum, value) => sum + (value - mean) ** 2, 0) / dayProfits.length;
    const stdDev = Math.sqrt(variance);
    const coefficient = mean > 0 ? stdDev / mean : 1;
    consistencyScore = Math.max(0, Math.min(100, round2((1 - coefficient) * 100)));
  }

  let ratingRow: Awaited<ReturnType<typeof db.query.driverReputationScores.findFirst>>;
  try {
    ratingRow = await db.query.driverReputationScores.findFirst({
      where: eq(driverReputationScores.driver_id, driverId),
    });
  } catch (error) {
    if (!isReputationSchemaCompatibilityError(error)) {
      throw error;
    }
  }

  const reputationSignal = ratingRow
    ? {
        averageRating: Number.parseFloat(ratingRow.average_rating || '0'),
        totalRatings: ratingRow.total_ratings || 0,
      }
    : null;

  const insights: string[] = [];
  if (routePerformance[0]) {
    insights.push(
      `Top route ${routePerformance[0].route} yields $${routePerformance[0].averageProfit.toFixed(2)} avg profit/job.`,
    );
  }
  const bestWeekday = [...weekdayPerformance].sort((a, b) => b.totalProfit - a.totalProfit)[0];
  if (bestWeekday && bestWeekday.jobs > 0) {
    insights.push(`Best weekday: ${bestWeekday.weekday} with $${bestWeekday.totalProfit.toFixed(2)} total profit.`);
  }
  if (profitMarginPercent > 80) {
    insights.push('Excellent profit retention. Your operating costs are very efficient.');
  } else if (profitMarginPercent < 60) {
    insights.push('Profit margin is below target. Consider prioritizing shorter or higher-fee routes.');
  }
  if (reputationSignal && reputationSignal.averageRating >= 4.5 && reputationSignal.totalRatings >= 20) {
    insights.push('You are premium-eligible based on rating performance (4.5+ with 20+ ratings).');
  }

  return {
    overview: {
      totalProfit: round2(totalProfit),
      totalJobs,
      averageProfitPerJob: round2(averageProfitPerJob),
      medianProfitPerJob: round2(medianProfitPerJob),
      profitMarginPercent: round2(profitMarginPercent),
      bestDayProfit: round2(bestDayProfit),
      worstDayProfit: round2(worstDayProfit),
      consistencyScore,
    },
    profitSeries,
    weekdayPerformance,
    routePerformance,
    reputationSignal,
    insights,
  };
}
