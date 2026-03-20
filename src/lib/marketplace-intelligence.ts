import type { DemandWithBuyer, ShipmentWithFarmer } from '@/types/app';

interface DemandRankDetail {
  demand: DemandWithBuyer;
  score: number;
}

export interface DemandInsights {
  demandsByProduce: Map<string, DemandWithBuyer[]>;
  averagePriceByProduce: Map<string, number>;
  totalDemandQtyByProduce: Map<string, number>;
  urgentDemandCountByProduce: Map<string, number>;
  maxDemandQty: number;
}

export interface OfferDecisionSignal {
  confidenceScore: number;
  valueScore: number;
  demandMatchCount: number;
  fitReason: string;
  bestDemand: DemandWithBuyer | null;
  demandPriceBenchmark: number;
  valueBreakdown: {
    confidenceWeight: number;
    quantityWeight: number;
    demandPressureWeight: number;
    urgencyWeight: number;
    urgencyBoostWeight: number;
  };
}

function deadlineHours(deadline: string | Date) {
  return (new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60);
}

function normalizeQuantity(quantityKg: number, maxQty: number) {
  if (maxQty <= 0) return 0;
  return Math.max(0, Math.min(1, quantityKg / maxQty));
}

function normalizeUrgency(deadline: string | Date) {
  const hours = deadlineHours(deadline);
  if (hours <= 24) return 1;
  if (hours <= 72) return 0.82;
  if (hours <= 168) return 0.65;
  return 0.48;
}

export function getOfferConfidenceScore(offer: ShipmentWithFarmer) {
  const hoursToDeadline = deadlineHours(offer.deadline);
  let score = 62;

  if (hoursToDeadline < 24) score -= 16;
  else if (hoursToDeadline < 72) score -= 8;
  else score += 6;

  if (offer.product_image_url) score += 8;
  if (offer.farmer?.name) score += 6;

  const quantity = Number(offer.quantity_kg);
  if (quantity >= 500) score += 8;
  else if (quantity < 100) score -= 6;

  return Math.max(40, Math.min(95, Math.round(score)));
}

export function buildDemandInsights(demands: DemandWithBuyer[]): DemandInsights {
  const demandsByProduce = new Map<string, DemandWithBuyer[]>();
  const averagePriceByProduce = new Map<string, number>();
  const totalDemandQtyByProduce = new Map<string, number>();
  const urgentDemandCountByProduce = new Map<string, number>();

  for (const demand of demands) {
    const produceKey = demand.produce_type.toLowerCase();
    const list = demandsByProduce.get(produceKey) ?? [];
    list.push(demand);
    demandsByProduce.set(produceKey, list);
  }

  let maxDemandQty = 0;
  for (const [produceKey, list] of demandsByProduce.entries()) {
    const totalPrice = list.reduce((sum, item) => sum + Number(item.max_price_usd), 0);
    const averagePrice = list.length > 0 ? totalPrice / list.length : 0;
    averagePriceByProduce.set(produceKey, averagePrice);

    const totalQty = list.reduce((sum, item) => sum + Number(item.quantity_kg), 0);
    totalDemandQtyByProduce.set(produceKey, totalQty);
    maxDemandQty = Math.max(maxDemandQty, totalQty);

    const urgentCount = list.reduce((count, item) => {
      return deadlineHours(item.deadline) <= 72 ? count + 1 : count;
    }, 0);
    urgentDemandCountByProduce.set(produceKey, urgentCount);
  }

  return {
    demandsByProduce,
    averagePriceByProduce,
    totalDemandQtyByProduce,
    urgentDemandCountByProduce,
    maxDemandQty,
  };
}

function rankDemandFit(offer: ShipmentWithFarmer, candidateDemands: DemandWithBuyer[]): DemandRankDetail[] {
  const offerQty = Number(offer.quantity_kg);
  const offerDeadline = new Date(offer.deadline).getTime();

  return candidateDemands.map((demand) => {
    const demandQty = Number(demand.quantity_kg);
    const demandDeadline = new Date(demand.deadline).getTime();
    const quantityCoverage = demandQty > 0 ? Math.min(offerQty / demandQty, 1) : 0;

    const provinceFit = demand.delivery_province === offer.pickup_province ? 1 : 0;
    const deadlineGapHours = Math.abs(demandDeadline - offerDeadline) / (1000 * 60 * 60);
    const deadlineFit = Math.max(0, 1 - Math.min(deadlineGapHours / 240, 1));

    const score = provinceFit * 0.42 + quantityCoverage * 0.34 + deadlineFit * 0.24;
    return { demand, score };
  }).sort((a, b) => b.score - a.score);
}

export function getOfferDecisionSignal(
  offer: ShipmentWithFarmer,
  insights: DemandInsights,
): OfferDecisionSignal {
  const produceKey = offer.produce_type.toLowerCase();
  const candidateDemands = insights.demandsByProduce.get(produceKey) ?? [];
  const rankedDemandFits = rankDemandFit(offer, candidateDemands);
  const bestDemand = rankedDemandFits[0]?.demand ?? null;

  const confidenceScore = getOfferConfidenceScore(offer);
  const quantityScore = normalizeQuantity(Number(offer.quantity_kg), Math.max(1, insights.maxDemandQty));
  const demandPressure = normalizeQuantity(
    insights.totalDemandQtyByProduce.get(produceKey) ?? 0,
    Math.max(1, insights.maxDemandQty),
  );
  const urgencyScore = normalizeUrgency(offer.deadline);
  const urgencyBoost = Math.min((insights.urgentDemandCountByProduce.get(produceKey) ?? 0) * 0.08, 0.24);

  const weighted =
    confidenceScore / 100 * 0.36 +
    quantityScore * 0.2 +
    demandPressure * 0.27 +
    urgencyScore * 0.17 +
    urgencyBoost;

  const valueScore = Math.max(45, Math.min(98, Math.round(weighted * 100)));
  const demandMatchCount = rankedDemandFits.filter((item) => item.score >= 0.45).length;

  let fitReason = 'General market fit.';
  if (bestDemand) {
    const deadlineLabel = new Date(bestDemand.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    fitReason = `${bestDemand.delivery_province} demand, ${Number(bestDemand.quantity_kg).toLocaleString()} kg, due ${deadlineLabel}`;
  } else if (candidateDemands.length > 0) {
    fitReason = `${candidateDemands.length} active buyer demand${candidateDemands.length > 1 ? 's' : ''} for this produce.`;
  }

  return {
    confidenceScore,
    valueScore,
    demandMatchCount,
    fitReason,
    bestDemand,
    demandPriceBenchmark: insights.averagePriceByProduce.get(produceKey) ?? 0,
    valueBreakdown: {
      confidenceWeight: confidenceScore / 100 * 0.36,
      quantityWeight: quantityScore * 0.2,
      demandPressureWeight: demandPressure * 0.27,
      urgencyWeight: urgencyScore * 0.17,
      urgencyBoostWeight: urgencyBoost,
    },
  };
}
