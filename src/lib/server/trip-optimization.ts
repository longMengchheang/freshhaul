import 'server-only';

import type { MatchingDealCandidate, TripWithDriver } from '@/types/app';

export interface TripOptimizationDealSuggestion {
  dealId: string;
  produceType: string;
  route: string;
  quantityKg: number;
  estimatedCommissionUsd: number;
  urgencyScore: number;
  fitScore: number;
  priorityRank: number;
}

export interface TripOptimizationResult {
  selectedTripId: string | null;
  routeEfficiencyScore: number;
  loadUtilizationPercent: number;
  recommendedDealCount: number;
  projectedCommissionUsd: number;
  projectedUtilizedKg: number;
  urgencyMix: {
    critical: number;
    soon: number;
    normal: number;
  };
  suggestions: TripOptimizationDealSuggestion[];
  recommendations: string[];
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function getUrgencyScore(deadlineRaw: string | Date): number {
  const deadline = deadlineRaw instanceof Date ? deadlineRaw : new Date(deadlineRaw);
  const hoursLeft = (deadline.getTime() - Date.now()) / (1000 * 60 * 60);

  if (hoursLeft <= 6) return 100;
  if (hoursLeft <= 12) return 85;
  if (hoursLeft <= 24) return 70;
  if (hoursLeft <= 48) return 45;
  return 20;
}

function estimateCommissionUsd(deal: MatchingDealCandidate): number {
  const matchCommission = deal.matches[0]?.commission_percent;
  const commissionPct = Number(matchCommission ?? 5);
  return Number(deal.agreed_price_usd) * (commissionPct / 100);
}

export function buildTripOptimizationResult(params: {
  selectedTrip: TripWithDriver | null;
  matchingDeals: MatchingDealCandidate[];
  opportunityDeals: MatchingDealCandidate[];
}): TripOptimizationResult {
  const { selectedTrip, matchingDeals, opportunityDeals } = params;

  if (!selectedTrip) {
    return {
      selectedTripId: null,
      routeEfficiencyScore: 0,
      loadUtilizationPercent: 0,
      recommendedDealCount: 0,
      projectedCommissionUsd: 0,
      projectedUtilizedKg: 0,
      urgencyMix: {
        critical: 0,
        soon: 0,
        normal: 0,
      },
      suggestions: [],
      recommendations: [
        'Save and select a route to receive optimization recommendations.',
      ],
    };
  }

  const capacityKg = Math.max(0, Number(selectedTrip.capacity_kg) || 0);

  const scored = matchingDeals
    .map((deal) => {
      const quantityKg = Math.max(0, Number(deal.quantity_kg) || 0);
      const loadFit = capacityKg > 0 ? Math.min(100, (quantityKg / capacityKg) * 100) : 0;
      const urgencyScore = Math.max(
        getUrgencyScore(deal.shipment.deadline),
        getUrgencyScore(deal.demand.deadline),
      );
      const dispatchBonus = deal.dispatchJob ? 18 : 0;
      const fitScore = round2(Math.min(100, loadFit * 0.45 + urgencyScore * 0.4 + dispatchBonus));

      return {
        dealId: deal.id,
        produceType: deal.shipment.produce_type,
        route: `${deal.shipment.pickup_province} -> ${deal.demand.delivery_province}`,
        quantityKg,
        estimatedCommissionUsd: round2(estimateCommissionUsd(deal)),
        urgencyScore,
        fitScore,
      };
    })
    .sort((a, b) => {
      if (b.fitScore !== a.fitScore) return b.fitScore - a.fitScore;
      return b.estimatedCommissionUsd - a.estimatedCommissionUsd;
    });

  let usedKg = 0;
  const chosen: TripOptimizationDealSuggestion[] = [];
  for (const candidate of scored) {
    if (usedKg + candidate.quantityKg > capacityKg && chosen.length > 0) {
      continue;
    }
    chosen.push({
      ...candidate,
      priorityRank: chosen.length + 1,
    });
    usedKg += candidate.quantityKg;
    if (chosen.length >= 3) break;
  }

  const projectedCommissionUsd = chosen.reduce((sum, item) => sum + item.estimatedCommissionUsd, 0);
  const loadUtilizationPercent = capacityKg > 0 ? Math.min(100, (usedKg / capacityKg) * 100) : 0;

  let critical = 0;
  let soon = 0;
  let normal = 0;
  for (const item of scored) {
    if (item.urgencyScore >= 85) critical += 1;
    else if (item.urgencyScore >= 45) soon += 1;
    else normal += 1;
  }

  const opportunityCount = opportunityDeals.length;
  const averageFit = scored.length > 0
    ? scored.reduce((sum, item) => sum + item.fitScore, 0) / scored.length
    : 0;

  const routeEfficiencyScore = round2(
    Math.min(100, averageFit * 0.75 + (loadUtilizationPercent > 65 ? 20 : loadUtilizationPercent * 0.2)),
  );

  const recommendations: string[] = [];
  if (chosen[0]) {
    recommendations.push(
      `Prioritize ${chosen[0].produceType} (${chosen[0].route}) with fit score ${chosen[0].fitScore.toFixed(1)}.`,
    );
  }
  if (loadUtilizationPercent < 50) {
    recommendations.push('Load utilization is low; add a second compatible job or use a smaller vehicle where possible.');
  }
  if (critical > 0) {
    recommendations.push(`${critical} high-urgency job(s) detected; confirm pickup windows early via driver chat.`);
  }
  if (opportunityCount > 0) {
    recommendations.push(`${opportunityCount} nearby route opportunities are available if you save a supplemental route.`);
  }

  return {
    selectedTripId: selectedTrip.id,
    routeEfficiencyScore,
    loadUtilizationPercent: round2(loadUtilizationPercent),
    recommendedDealCount: chosen.length,
    projectedCommissionUsd: round2(projectedCommissionUsd),
    projectedUtilizedKg: round2(usedKg),
    urgencyMix: {
      critical,
      soon,
      normal,
    },
    suggestions: chosen,
    recommendations,
  };
}
