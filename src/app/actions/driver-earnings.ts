'use server';

import { getCurrentUserContext } from '@/lib/server/current-user';
import { hasActiveRole } from '@/lib/user-roles';
import {
  getDriverEarningsHistory,
  getDriverEarningsSummary,
  getDriverEarningsTrends,
} from '@/lib/server/driver-earnings';
import {
  getDriverAdvancedEarningsAnalytics,
  type AdvancedEarningsAnalytics,
} from '@/lib/server/advanced-earnings';
import { actionFail, actionOk } from '@/lib/server/action-result';
import type { EarningsRecord, EarningsSummary, EarningsTrend } from '@/lib/server/driver-earnings';

export interface DriverEarningsReportResult {
  driverId: string;
  earnings: EarningsRecord[];
  summary: EarningsSummary;
  trends: EarningsTrend[];
}

export interface DriverAdvancedEarningsResult {
  driverId: string;
  analytics: AdvancedEarningsAnalytics;
}

/**
 * Fetch driver earnings dashboard data for the current user.
 * Optionally filter by a date range (defaults to last 30 days if no dates provided).
 */
export async function getDriverEarningsReport(input?: {
  startDate?: string;
  endDate?: string;
}) {
  try {
    const context = await getCurrentUserContext();
    if (!context) {
      return actionFail('UNAUTHORIZED', 'User not authenticated', null);
    }

    if (!hasActiveRole(context.profile.roles, 'driver')) {
      return actionFail('FORBIDDEN', 'Driver role not active on this account', null);
    }

    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const startDate = input?.startDate ? new Date(input.startDate) : thirtyDaysAgo;
    const endDate = input?.endDate ? new Date(input.endDate) : today;

    const [earnings, summary, trends] = await Promise.all([
      getDriverEarningsHistory(context.authUser.id, startDate, endDate),
      getDriverEarningsSummary(context.authUser.id, startDate, endDate),
      getDriverEarningsTrends(context.authUser.id, startDate, endDate),
    ]);

    return actionOk<DriverEarningsReportResult>({
      driverId: context.authUser.id,
      earnings,
      summary,
      trends,
    });
  } catch (error) {
    console.error('Driver earnings report error:', error);
    return actionFail(
      'UNKNOWN_ERROR',
      'Failed to load earnings report',
      null
    );
  }
}

/**
 * Fetch advanced earnings analytics for the current driver user.
 */
export async function getDriverAdvancedEarningsReport(input?: {
  startDate?: string;
  endDate?: string;
}) {
  try {
    const context = await getCurrentUserContext();
    if (!context) {
      return actionFail('UNAUTHORIZED', 'User not authenticated', null);
    }

    if (!hasActiveRole(context.profile.roles, 'driver')) {
      return actionFail('FORBIDDEN', 'Driver role not active on this account', null);
    }

    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const startDate = input?.startDate ? new Date(input.startDate) : thirtyDaysAgo;
    const endDate = input?.endDate ? new Date(input.endDate) : today;

    const analytics = await getDriverAdvancedEarningsAnalytics(
      context.authUser.id,
      startDate,
      endDate,
    );

    return actionOk<DriverAdvancedEarningsResult>({
      driverId: context.authUser.id,
      analytics,
    });
  } catch (error) {
    console.error('Driver advanced earnings report error:', error);
    return actionFail('UNKNOWN_ERROR', 'Failed to load advanced earnings analytics', null);
  }
}
