'use server';

import { getCurrentUserContext } from '@/lib/server/current-user';
import { hasActiveRole } from '@/lib/user-roles';
import { db } from '@/lib/db';
import { driverSchedules, availableTrips } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { actionFail, actionOk } from '@/lib/server/action-result';

export interface WeeklySchedule {
  mondayFrom?: string;
  mondayTo?: string;
  tuesdayFrom?: string;
  tuesdayTo?: string;
  wednesdayFrom?: string;
  wednesdayTo?: string;
  thursdayFrom?: string;
  thursdayTo?: string;
  fridayFrom?: string;
  fridayTo?: string;
  saturdayFrom?: string;
  saturdayTo?: string;
  sundayFrom?: string;
  sundayTo?: string;
}

/**
 * Fetch driver's current schedule
 */
export async function getDriverSchedule() {
  try {
    const context = await getCurrentUserContext();
    if (!context) {
      return actionFail('UNAUTHORIZED', 'User not authenticated', null);
    }

    if (!hasActiveRole(context.profile.roles, 'driver')) {
      return actionFail('FORBIDDEN', 'Driver role not active on this account', null);
    }

    const schedule = await db.query.driverSchedules.findFirst({
      where: eq(driverSchedules.driver_id, context.authUser.id),
    });

    return actionOk(schedule ?? null);
  } catch (error) {
    console.error('Get driver schedule error:', error);
    return actionFail('UNKNOWN_ERROR', 'Failed to load schedule', null);
  }
}

/**
 * Save or update driver's weekly schedule
 */
export async function saveDriverSchedule(input: WeeklySchedule) {
  try {
    const context = await getCurrentUserContext();
    if (!context) {
      return actionFail('UNAUTHORIZED', 'User not authenticated', null);
    }

    if (!hasActiveRole(context.profile.roles, 'driver')) {
      return actionFail('FORBIDDEN', 'Driver role not active on this account', null);
    }

    // Validate schedule data
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
    for (const day of days) {
      const fromKey = `${day}From` as keyof WeeklySchedule;
      const toKey = `${day}To` as keyof WeeklySchedule;
      const fromTime = input[fromKey];
      const toTime = input[toKey];

      if ((fromTime && !toTime) || (!fromTime && toTime)) {
        return actionFail(
          'VALIDATION_ERROR',
          `Both start and end time required for ${day}`,
          null
        );
      }
    }

    const existing = await db.query.driverSchedules.findFirst({
      where: eq(driverSchedules.driver_id, context.authUser.id),
    });

    const scheduleData = {
      monday_from: input.mondayFrom || null,
      monday_to: input.mondayTo || null,
      tuesday_from: input.tuesdayFrom || null,
      tuesday_to: input.tuesdayTo || null,
      wednesday_from: input.wednesdayFrom || null,
      wednesday_to: input.wednesdayTo || null,
      thursday_from: input.thursdayFrom || null,
      thursday_to: input.thursdayTo || null,
      friday_from: input.fridayFrom || null,
      friday_to: input.fridayTo || null,
      saturday_from: input.saturdayFrom || null,
      saturday_to: input.saturdayTo || null,
      sunday_from: input.sundayFrom || null,
      sunday_to: input.sundayTo || null,
      updated_at: new Date(),
    };

    if (existing) {
      await db
        .update(driverSchedules)
        .set(scheduleData)
        .where(eq(driverSchedules.id, existing.id));
    } else {
      await db.insert(driverSchedules).values({
        ...scheduleData,
        driver_id: context.authUser.id,
        created_at: new Date(),
      });
    }

    return actionOk({ success: true });
  } catch (error) {
    console.error('Save driver schedule error:', error);
    return actionFail('UNKNOWN_ERROR', 'Failed to save schedule', null);
  }
}

/**
 * Activate hot mode for a trip (15 min urgent dispatch window)
 */
export async function activateHotMode(tripId: string) {
  try {
    const context = await getCurrentUserContext();
    if (!context) {
      return actionFail('UNAUTHORIZED', 'User not authenticated', null);
    }

    if (!hasActiveRole(context.profile.roles, 'driver')) {
      return actionFail('FORBIDDEN', 'Driver role not active on this account', null);
    }

    const trip = await db.query.availableTrips.findFirst({
      where: eq(availableTrips.id, tripId),
    });

    if (!trip) {
      return actionFail('NOT_FOUND', 'Trip not found', null);
    }

    if (trip.driver_id !== context.authUser.id) {
      return actionFail('FORBIDDEN', 'This trip does not belong to you', null);
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes

    await db
      .update(availableTrips)
      .set({
        is_hot_mode_active: true,
        hot_mode_expires_at: expiresAt,
      })
      .where(eq(availableTrips.id, tripId));

    return actionOk({ success: true, expiresAt });
  } catch (error) {
    console.error('Activate hot mode error:', error);
    return actionFail('UNKNOWN_ERROR', 'Failed to activate hot mode', null);
  }
}

/**
 * Deactivate hot mode for a trip
 */
export async function deactivateHotMode(tripId: string) {
  try {
    const context = await getCurrentUserContext();
    if (!context) {
      return actionFail('UNAUTHORIZED', 'User not authenticated', null);
    }

    if (!hasActiveRole(context.profile.roles, 'driver')) {
      return actionFail('FORBIDDEN', 'Driver role not active on this account', null);
    }

    const trip = await db.query.availableTrips.findFirst({
      where: eq(availableTrips.id, tripId),
    });

    if (!trip) {
      return actionFail('NOT_FOUND', 'Trip not found', null);
    }

    if (trip.driver_id !== context.authUser.id) {
      return actionFail('FORBIDDEN', 'This trip does not belong to you', null);
    }

    await db
      .update(availableTrips)
      .set({
        is_hot_mode_active: false,
        hot_mode_expires_at: null,
      })
      .where(eq(availableTrips.id, tripId));

    return actionOk({ success: true });
  } catch (error) {
    console.error('Deactivate hot mode error:', error);
    return actionFail('UNKNOWN_ERROR', 'Failed to deactivate hot mode', null);
  }
}
