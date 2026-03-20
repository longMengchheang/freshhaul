import { db } from '@/lib/db';
import { driverRatings, driverReputationScores, reputationBadges } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

export interface SubmitRatingParams {
  driverId: string;
  raterId: string;
  raterRole: 'farmer' | 'buyer';
  dealId: string;
  overallRating: number;
  speedRating?: number;
  communicationRating?: number;
  vehicleConditionRating?: number;
  professionalismRating?: number;
  reliabilityRating?: number;
  comment?: string;
  isAnonymous?: boolean;
}

export interface DriverReputationProfile {
  driverId: string;
  totalRatings: number;
  averageRating: number;
  averageSpeed: number;
  averageCommunication: number;
  averageVehicleCondition: number;
  averageProfessionalism: number;
  averageReliability: number;
  ratingDistribution: {
    fiveStars: number;
    fourStars: number;
    threeStars: number;
    twoStars: number;
    oneStar: number;
  };
  reputationBadge: string | null;
  lastUpdated: Date;
  recentRatings: Array<{
    id: string;
    overallRating: number;
    comment: string | null;
    raterRole: string;
    createdAt: Date;
  }>;
}

/**
 * Submit a rating from a farmer/buyer for a driver
 */
export async function submitRating(params: SubmitRatingParams) {
  const {
    driverId,
    raterId,
    raterRole,
    dealId,
    overallRating,
    speedRating,
    communicationRating,
    vehicleConditionRating,
    professionalismRating,
    reliabilityRating,
    comment,
    isAnonymous = false,
  } = params;

  // Validate rating is 1-5
  if (overallRating < 1 || overallRating > 5) {
    throw new Error('Overall rating must be between 1 and 5');
  }

  // Validate category ratings if provided
  const categoryRatings = [
    speedRating,
    communicationRating,
    vehicleConditionRating,
    professionalismRating,
    reliabilityRating,
  ];

  for (const rating of categoryRatings) {
    if (rating !== undefined && (rating < 1 || rating > 5)) {
      throw new Error('Category ratings must be between 1 and 5');
    }
  }

  // Check if rating already exists for this deal
  const existingRating = await db
    .select()
    .from(driverRatings)
    .where(
      and(
        eq(driverRatings.driver_id, driverId),
        eq(driverRatings.rater_id, raterId),
        eq(driverRatings.deal_id, dealId),
      ),
    )
    .limit(1);

  if (existingRating.length > 0) {
    throw new Error('Rating already exists for this deal');
  }

  // Create the rating
  const newRating = await db
    .insert(driverRatings)
    .values({
      driver_id: driverId,
      rater_id: raterId,
      rater_role: raterRole,
      deal_id: dealId,
      overall_rating: overallRating,
      speed_rating: speedRating,
      communication_rating: communicationRating,
      vehicle_condition_rating: vehicleConditionRating,
      professionalism_rating: professionalismRating,
      reliability_rating: reliabilityRating,
      comment: comment || null,
      is_anonymous: isAnonymous,
    })
    .returning();

  // Update reputation scores
  await updateReputationScores(driverId);

  return newRating[0];
}

/**
 * Update reputation scores for a driver based on all ratings
 */
export async function updateReputationScores(driverId: string) {
  const allRatings = await db
    .select()
    .from(driverRatings)
    .where(eq(driverRatings.driver_id, driverId));

  if (allRatings.length === 0) {
    // Initialize reputation with default values
    const existing = await db
      .select()
      .from(driverReputationScores)
      .where(eq(driverReputationScores.driver_id, driverId));

    if (existing.length === 0) {
      await db.insert(driverReputationScores).values({
        driver_id: driverId,
        total_ratings: 0,
         average_rating: '0.00',
      });
    }
    return;
  }

  // Calculate averages
  const totalRatings = allRatings.length;

  const averageRating = parseFloat((
      (allRatings.reduce((sum, r) => sum + r.overall_rating, 0) / totalRatings).toFixed(2)
    ));
  const averageSpeed =
    allRatings
      .filter((r) => r.speed_rating !== null)
      .reduce((sum, r) => sum + (r.speed_rating || 0), 0) /
      (allRatings.filter((r) => r.speed_rating !== null).length || 1) || 0;

  const averageCommunication =
    allRatings
      .filter((r) => r.communication_rating !== null)
      .reduce((sum, r) => sum + (r.communication_rating || 0), 0) /
      (allRatings.filter((r) => r.communication_rating !== null).length || 1) || 0;

  const averageVehicleCondition =
    allRatings
      .filter((r) => r.vehicle_condition_rating !== null)
      .reduce((sum, r) => sum + (r.vehicle_condition_rating || 0), 0) /
      (allRatings.filter((r) => r.vehicle_condition_rating !== null).length || 1) || 0;

  const averageProfessionalism =
    allRatings
      .filter((r) => r.professionalism_rating !== null)
      .reduce((sum, r) => sum + (r.professionalism_rating || 0), 0) /
      (allRatings.filter((r) => r.professionalism_rating !== null).length || 1) || 0;

  const averageReliability =
    allRatings
      .filter((r) => r.reliability_rating !== null)
      .reduce((sum, r) => sum + (r.reliability_rating || 0), 0) /
      (allRatings.filter((r) => r.reliability_rating !== null).length || 1) || 0;

  // Count by star rating
  const ratingCounts = {
    5: allRatings.filter((r) => r.overall_rating === 5).length,
    4: allRatings.filter((r) => r.overall_rating === 4).length,
    3: allRatings.filter((r) => r.overall_rating === 3).length,
    2: allRatings.filter((r) => r.overall_rating === 2).length,
    1: allRatings.filter((r) => r.overall_rating === 1).length,
  };

  // Format numeric strings for Drizzle
  const formattedAverage = parseFloat(averageRating.toFixed(2)).toString();
  const formattedSpeed = parseFloat(averageSpeed.toFixed(2)).toString();
  const formattedComm = parseFloat(averageCommunication.toFixed(2)).toString();
  const formattedVehicle = parseFloat(averageVehicleCondition.toFixed(2)).toString();
  const formattedProf = parseFloat(averageProfessionalism.toFixed(2)).toString();
  const formattedReliability = parseFloat(averageReliability.toFixed(2)).toString();

  // Determine badge
  const badge = await determineReputationBadge(averageRating, totalRatings);

  // Update or insert reputation score
  const existing = await db
    .select()
    .from(driverReputationScores)
    .where(eq(driverReputationScores.driver_id, driverId));

  if (existing.length > 0) {
    await db
      .update(driverReputationScores)
      .set({
        total_ratings: totalRatings,
        average_rating: formattedAverage,
        average_speed: formattedSpeed,
        average_communication: formattedComm,
        average_vehicle_condition: formattedVehicle,
        average_professionalism: formattedProf,
        average_reliability: formattedReliability,
        rating_count_5_star: ratingCounts[5],
        rating_count_4_star: ratingCounts[4],
        rating_count_3_star: ratingCounts[3],
        rating_count_2_star: ratingCounts[2],
        rating_count_1_star: ratingCounts[1],
        reputation_badge: badge,
        last_updated: new Date(),
      })
      .where(eq(driverReputationScores.driver_id, driverId));
  } else {
    await db.insert(driverReputationScores).values({
      driver_id: driverId,
      total_ratings: totalRatings,
      average_rating: formattedAverage,
      average_speed: formattedSpeed,
      average_communication: formattedComm,
      average_vehicle_condition: formattedVehicle,
      average_professionalism: formattedProf,
      average_reliability: formattedReliability,
      rating_count_5_star: ratingCounts[5],
      rating_count_4_star: ratingCounts[4],
      rating_count_3_star: ratingCounts[3],
      rating_count_2_star: ratingCounts[2],
      rating_count_1_star: ratingCounts[1],
      reputation_badge: badge,
    });
  }
}

/**
 * Determine reputation badge based on rating and count
 */
async function determineReputationBadge(
  averageRating: number,
  totalRatings: number,
): Promise<string | null> {
  if (totalRatings === 0) {
    return 'New Driver';
  }

  const badges = await db
    .select()
    .from(reputationBadges)
    .orderBy(desc(reputationBadges.min_rating));

  // Find the first badge that matches (highest tier first)
  for (const badge of badges) {
    const minRating = parseFloat(badge.min_rating);
    const minCount = badge.min_total_ratings || 0;
    if (averageRating >= minRating && totalRatings >= minCount) {
      return badge.badge_name;
    }
  }

  return null;
}

/**
 * Get full driver reputation profile
 */
export async function getDriverReputationProfile(
  driverId: string,
): Promise<DriverReputationProfile | null> {
  const reputationScore = await db
    .select()
    .from(driverReputationScores)
    .where(eq(driverReputationScores.driver_id, driverId));

  if (reputationScore.length === 0) {
    return null;
  }

  const score = reputationScore[0];

  // Get recent ratings (last 5)
  const recentRatings = await db
    .select({
      id: driverRatings.id,
      overallRating: driverRatings.overall_rating,
      comment: driverRatings.comment,
      raterRole: driverRatings.rater_role,
      createdAt: driverRatings.created_at,
    })
    .from(driverRatings)
    .where(eq(driverRatings.driver_id, driverId))
    .orderBy(desc(driverRatings.created_at))
    .limit(5);

  return {
    driverId,
    totalRatings: score.total_ratings || 0,
    averageRating: parseFloat(score.average_rating || '0'),
    averageSpeed: parseFloat(score.average_speed || '0'),
    averageCommunication: parseFloat(score.average_communication || '0'),
    averageVehicleCondition: parseFloat(score.average_vehicle_condition || '0'),
    averageProfessionalism: parseFloat(score.average_professionalism || '0'),
    averageReliability: parseFloat(score.average_reliability || '0'),
    ratingDistribution: {
      fiveStars: score.rating_count_5_star || 0,
      fourStars: score.rating_count_4_star || 0,
      threeStars: score.rating_count_3_star || 0,
      twoStars: score.rating_count_2_star || 0,
      oneStar: score.rating_count_1_star || 0,
    },
    reputationBadge: score.reputation_badge,
    lastUpdated: score.last_updated || new Date(),
    recentRatings: recentRatings.map((r) => ({
      id: r.id,
      overallRating: r.overallRating,
      comment: r.comment,
      raterRole: r.raterRole,
      createdAt: r.createdAt,
    })),
  };
}

/**
 * Check if a driver is eligible for premium status (4.5+ stars, 20+ ratings)
 */
export async function isPremiumEligible(driverId: string): Promise<boolean> {
  const reputationScore = await db
    .select()
    .from(driverReputationScores)
    .where(eq(driverReputationScores.driver_id, driverId));

  if (reputationScore.length === 0) return false;

  const score = reputationScore[0];
  return (parseFloat(score.average_rating || '0') >= 4.5 && (score.total_ratings || 0) >= 20);
}

/**
 * Get rating statistics for analytics
 */
export async function getRatingStatistics(driverId: string) {
  const profile = await getDriverReputationProfile(driverId);
  if (!profile) return null;

  // Calculate improvement trend (compare last 5 ratings to previous 5)
  const allRatings = await db
    .select()
    .from(driverRatings)
    .where(eq(driverRatings.driver_id, driverId))
    .orderBy(desc(driverRatings.created_at));

  const recentAverage =
    allRatings
      .slice(0, 5)
      .reduce((sum, r) => sum + r.overall_rating, 0) / Math.min(5, allRatings.length) || 0;

  const previousAverage =
    allRatings
      .slice(5, 10)
      .reduce((sum, r) => sum + r.overall_rating, 0) / (Math.min(10, allRatings.length) - 5 || 1) || 0;

  const trend = recentAverage - previousAverage;

  return {
    ...profile,
   lastFiveAverageRating: parseFloat(recentAverage.toFixed(2)),
   trendSinceLast5Ratings: parseFloat(trend.toFixed(2)),
    trendDirection: trend > 0 ? 'improving' : trend < 0 ? 'declining' : 'stable',
  };
}
