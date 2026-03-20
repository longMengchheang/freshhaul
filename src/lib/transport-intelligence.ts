import type { DealWithDetails } from '@/types/app';

export type RiskLabel = 'Low' | 'Medium' | 'High';

export function getDispatchAttemptCount(deal: DealWithDetails) {
  return (deal.dispatchLogs ?? []).filter((log) => log.event_type === 'deal_queued').length;
}

export function getTransportRisk(deal: DealWithDetails): {
  score: number;
  label: RiskLabel;
  reason: string;
} {
  if (deal.status === 'completed') {
    return { score: 0, label: 'Low', reason: 'Delivery is completed.' };
  }

  let score = 10;
  const now = Date.now();
  const demandDeadline = new Date(deal.demand.deadline).getTime();
  const shipmentDeadline = new Date(deal.shipment.deadline).getTime();
  const effectiveDeadline = Math.min(demandDeadline, shipmentDeadline);
  const hoursToDeadline = (effectiveDeadline - now) / (1000 * 60 * 60);
  const dispatchAttempts = getDispatchAttemptCount(deal);

  if (hoursToDeadline < 6) score += 32;
  else if (hoursToDeadline < 12) score += 22;
  else if (hoursToDeadline < 24) score += 12;

  if (deal.status === 'transport_pending' && !(deal.matches?.[0])) {
    score += 20;
  }

  if (dispatchAttempts >= 3) score += 20;
  else if (dispatchAttempts === 2) score += 12;
  else if (dispatchAttempts === 1) score += 6;

  if (deal.status === 'in_transit') {
    score = Math.max(8, score - 18);
  }

  const normalized = Math.max(0, Math.min(100, score));

  if (normalized >= 70) {
    return { score: normalized, label: 'High', reason: 'Close deadline with unresolved transport risk.' };
  }
  if (normalized >= 40) {
    return { score: normalized, label: 'Medium', reason: 'Some delivery risk factors need monitoring.' };
  }
  return { score: normalized, label: 'Low', reason: 'Transport flow currently looks stable.' };
}

export function getReliabilitySummary(deals: DealWithDetails[]) {
  if (deals.length === 0) {
    return { completionRate: 0, activeRate: 0, stalledRate: 0 };
  }

  const completed = deals.filter((deal) => deal.status === 'completed').length;
  const active = deals.filter((deal) => ['in_transit', 'transport_pending'].includes(deal.status)).length;
  const stalled = deals.filter((deal) => {
    if (deal.status !== 'transport_pending') {
      return false;
    }
    const attempts = getDispatchAttemptCount(deal);
    return attempts >= 2 && !deal.matches?.[0];
  }).length;

  return {
    completionRate: Math.round((completed / deals.length) * 100),
    activeRate: Math.round((active / deals.length) * 100),
    stalledRate: Math.round((stalled / deals.length) * 100),
  };
}
