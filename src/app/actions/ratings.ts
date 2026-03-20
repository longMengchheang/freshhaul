'use server';

import { getCurrentUserContext } from '@/lib/server/current-user';
import { hasActiveRole } from '@/lib/user-roles';
import { submitRating, getDriverReputationProfile, getRatingStatistics } from '@/lib/server/rating-engine';
import { actionFail, actionOk } from '@/lib/server/action-result';

/**
 * Server action: Submit a rating for a driver
 */
export async function submitDriverRatingAction(params: {
  driverId: string;
  dealId: string;
  overallRating: number;
  speedRating?: number;
  communicationRating?: number;
  vehicleConditionRating?: number;
  professionalismRating?: number;
  reliabilityRating?: number;
  comment?: string;
  isAnonymous?: boolean;
}) {
  try {
    const context = await getCurrentUserContext();
    if (!context) {
      return actionFail('UNAUTHORIZED', 'User not authenticated', null);
    }

    // Determine rater role (farmer or buyer) from user's active role
    const isFarmer = hasActiveRole(context.profile.roles, 'farmer');
    const isBuyer = hasActiveRole(context.profile.roles, 'buyer');

    if (!isFarmer && !isBuyer) {
      return actionFail('FORBIDDEN', 'Must be a farmer or buyer to rate drivers', null);
    }

    const raterRole = (isFarmer ? 'farmer' : 'buyer') as 'farmer' | 'buyer';

    // Submit rating
    const rating = await submitRating({
      driverId: params.driverId,
      raterId: context.authUser.id,
      raterRole,
      dealId: params.dealId,
      overallRating: params.overallRating,
      speedRating: params.speedRating,
      communicationRating: params.communicationRating,
      vehicleConditionRating: params.vehicleConditionRating,
      professionalismRating: params.professionalismRating,
      reliabilityRating: params.reliabilityRating,
      comment: params.comment,
      isAnonymous: params.isAnonymous,
    });

    return actionOk(rating);
  } catch (error) {
    console.error('Error submitting rating:', error);
    if (error instanceof Error && error.message.includes('already exists')) {
      return actionFail('CONFLICT', 'You have already rated this driver for this trip', null);
    }
    if (error instanceof Error && error.message.includes('must be between')) {
      return actionFail('VALIDATION_ERROR', error.message, null);
    }
    return actionFail('UNKNOWN_ERROR', 'Failed to submit rating', null);
  }
}

/**
 * Server action: Get driver reputation profile
 */
export async function getDriverRatingProfileAction(driverId: string) {
  try {
    const context = await getCurrentUserContext();
    if (!context) {
      return actionFail('UNAUTHORIZED', 'User not authenticated', null);
    }

    // Get reputation profile
    const profile = await getDriverReputationProfile(driverId);

    if (!profile) {
      return actionFail('NOT_FOUND', 'Driver not found', null);
    }

    return actionOk(profile);
  } catch (error) {
    console.error('Error fetching driver rating profile:', error);
    return actionFail('UNKNOWN_ERROR', 'Failed to fetch rating profile', null);
  }
}

/**
 * Server action: Get driver rating statistics
 */
export async function getDriverRatingStatsAction(driverId: string) {
  try {
    const context = await getCurrentUserContext();
    if (!context) {
      return actionFail('UNAUTHORIZED', 'User not authenticated', null);
    }

    // Get rating statistics
    const stats = await getRatingStatistics(driverId);

    if (!stats) {
      return actionFail('NOT_FOUND', 'Driver not found', null);
    }

    return actionOk(stats);
  } catch (error) {
    console.error('Error fetching driver rating stats:', error);
    return actionFail('UNKNOWN_ERROR', 'Failed to fetch rating statistics', null);
  }
}

/**
 * Server action: Get driver's own rating profile
 */
export async function getMyRatingProfileAction() {
  try {
    const context = await getCurrentUserContext();
    if (!context) {
      return actionFail('UNAUTHORIZED', 'User not authenticated', null);
    }

    // Get reputation profile
    const profile = await getDriverReputationProfile(context.authUser.id);

    return actionOk(profile);
  } catch (error) {
    console.error('Error fetching my rating profile:', error);
    return actionFail('UNKNOWN_ERROR', 'Failed to fetch your rating profile', null);
  }
}
