import { validateDealTransition } from '@/lib/server/deal-lifecycle';
import type { DealWithDetails } from '@/types/app';
import type {
  EnrichedOrder,
  OrderCommandCenterSnapshot,
  OrderMilestone,
  OrderPlaybook,
  OrderPortfolioSummary,
  OrderRoleMode,
  OrderSplitSuggestion,
  OrderTimelineEvent,
  OrderTransitionOption,
} from '@/types/orders';

function toDate(value: string | Date) {
  return value instanceof Date ? value : new Date(value);
}

function getRiskScore(deal: DealWithDetails) {
  const now = Date.now();
  const shipmentDeadlineHours = (toDate(deal.shipment.deadline).getTime() - now) / (1000 * 60 * 60);
  const demandDeadlineHours = (toDate(deal.demand.deadline).getTime() - now) / (1000 * 60 * 60);
  const nearestDeadlineHours = Math.min(shipmentDeadlineHours, demandDeadlineHours);
  const hasDriver = deal.matches.length > 0;
  const staleDispatch = (deal.dispatchLogs ?? []).find((log) => log.event_type === 'deal_queued');
  const staleDispatchHours = staleDispatch
    ? (now - toDate(staleDispatch.created_at).getTime()) / (1000 * 60 * 60)
    : 0;

  let risk = 20;

  if (nearestDeadlineHours < 12) risk += 35;
  else if (nearestDeadlineHours < 24) risk += 22;

  if (['transport_pending', 'accepted'].includes(deal.status) && !hasDriver) risk += 25;
  if (deal.status === 'in_transit') risk += 10;
  if (staleDispatchHours > 4 && !hasDriver) risk += 15;

  return Math.max(0, Math.min(100, Math.round(risk)));
}

function toRiskBand(score: number): 'Low' | 'Medium' | 'High' {
  if (score >= 70) return 'High';
  if (score >= 40) return 'Medium';
  return 'Low';
}

function getTimeline(deal: DealWithDetails): OrderTimelineEvent[] {
  const events: OrderTimelineEvent[] = [
    {
      id: `created-${deal.id}`,
      kind: 'status',
      title: 'Order created',
      detail: `Deal opened for ${deal.shipment.produce_type}`,
      createdAt: toDate(deal.created_at).toISOString(),
      tone: 'info',
    },
    {
      id: `status-${deal.id}`,
      kind: 'status',
      title: `Status: ${deal.status.replace('_', ' ')}`,
      detail: `Current lifecycle state is ${deal.status.replace('_', ' ')}`,
      createdAt: toDate(deal.created_at).toISOString(),
      tone: ['rejected', 'cancelled'].includes(deal.status) ? 'danger' : 'neutral',
    },
  ];

  for (const log of deal.dispatchLogs ?? []) {
    events.push({
      id: `dispatch-${log.id}`,
      kind: 'dispatch',
      title: log.event_type.replaceAll('_', ' '),
      detail: log.message,
      createdAt: toDate(log.created_at).toISOString(),
      tone: log.event_type === 'no_driver_available' ? 'danger' : 'warning',
    });
  }

  if (deal.matches[0]) {
    events.push({
      id: `driver-${deal.matches[0].id}`,
      kind: 'milestone',
      title: 'Driver assigned',
      detail: `${deal.matches[0].driver?.name ?? 'Assigned driver'} accepted transport`,
      createdAt: toDate(deal.matches[0].created_at).toISOString(),
      tone: 'success',
    });
  }

  return events.sort((a, b) => toDate(b.createdAt).getTime() - toDate(a.createdAt).getTime());
}

function getMilestones(deal: DealWithDetails): OrderMilestone[] {
  const hasDriver = deal.matches.length > 0;
  const isCompleted = deal.status === 'completed';
  return [
    {
      key: 'commercial',
      label: 'Commercial approved',
      done: ['transport_pending', 'in_transit', 'completed'].includes(deal.status),
      blockedReason: ['pending', 'rejected', 'cancelled'].includes(deal.status)
        ? 'Waiting for acceptance flow.'
        : undefined,
    },
    {
      key: 'dispatch',
      label: 'Driver assignment',
      done: hasDriver,
      blockedReason: hasDriver ? undefined : 'No driver assigned yet.',
    },
    {
      key: 'pickup',
      label: 'Pickup confirmed',
      done: ['in_transit', 'completed'].includes(deal.status),
      blockedReason: ['transport_pending', 'accepted'].includes(deal.status)
        ? 'Pickup starts when trip transitions to in transit.'
        : undefined,
    },
    {
      key: 'delivery',
      label: 'Delivery completed',
      done: isCompleted,
      blockedReason: isCompleted ? undefined : 'Delivery proof not completed yet.',
    },
    {
      key: 'settlement',
      label: 'Settlement release',
      done: isCompleted,
      blockedReason: isCompleted ? undefined : 'Release only after completed delivery milestone.',
    },
  ];
}

function getTransitions(deal: DealWithDetails): OrderTransitionOption[] {
  const targets: Array<OrderTransitionOption['status']> = [
    'transport_pending',
    'in_transit',
    'completed',
    'cancelled',
    'rejected',
  ];

  return targets.map((status) => {
    const validation = validateDealTransition({
      currentStatus: deal.status,
      nextStatus: status,
      hasAssignedDriver: deal.matches.length > 0,
    });

    return {
      status,
      label: `Move to ${status.replace('_', ' ')}`,
      blockedReason: validation.ok ? undefined : validation.error,
    };
  });
}

function getPlaybooks(deal: DealWithDetails, riskBand: 'Low' | 'Medium' | 'High'): OrderPlaybook[] {
  const items: OrderPlaybook[] = [];

  if (['accepted', 'transport_pending'].includes(deal.status) && deal.matches.length === 0) {
    items.push({
      id: 'expedite_dispatch',
      title: 'Expedite dispatch',
      detail: 'Requeue top driver candidates and refresh dispatch visibility.',
      ctaLabel: 'Run dispatch rescue',
      urgency: riskBand === 'High' ? 'high' : 'medium',
    });
  }

  if (deal.status === 'transport_pending') {
    items.push({
      id: 'nudge_counterparty',
      title: 'Nudge stakeholders',
      detail: 'Send guided reminder for buyer, farmer, and available drivers.',
      ctaLabel: 'Send reminder',
      urgency: 'medium',
    });
  }

  if (deal.matches.length > 0 && ['transport_pending', 'accepted'].includes(deal.status)) {
    items.push({
      id: 'mark_in_transit',
      title: 'Start trip execution',
      detail: 'Transition order into in-transit once pickup starts.',
      ctaLabel: 'Mark in transit',
      urgency: 'low',
    });
  }

  if (deal.status === 'in_transit') {
    items.push({
      id: 'prepare_settlement',
      title: 'Prepare milestone settlement',
      detail: 'Validate evidence and queue release readiness.',
      ctaLabel: 'Prepare settlement',
      urgency: 'medium',
    });
  }

  if (riskBand === 'High' && !['completed', 'cancelled', 'rejected'].includes(deal.status)) {
    items.push({
      id: 'cancel_order',
      title: 'Controlled cancellation',
      detail: 'When recovery fails, close safely and reopen supply/demand.',
      ctaLabel: 'Cancel order',
      urgency: 'high',
    });
  }

  return items;
}

function getSplitMergeSuggestions(deal: DealWithDetails, allDeals: DealWithDetails[]): OrderSplitSuggestion[] {
  const suggestions: OrderSplitSuggestion[] = [];
  const quantity = Number(deal.quantity_kg);

  if (quantity > 4000) {
    suggestions.push({
      kind: 'split',
      detail: 'Large quantity detected. Split into two execution legs to reduce route failure risk.',
      confidence: 82,
    });
  }

  const mergeCandidate = allDeals.find(
    (candidate) =>
      candidate.id !== deal.id &&
      candidate.shipment.pickup_province === deal.shipment.pickup_province &&
      candidate.demand.delivery_province === deal.demand.delivery_province &&
      candidate.status === 'transport_pending',
  );

  if (mergeCandidate) {
    suggestions.push({
      kind: 'merge',
      detail: `Merge-ready lane with order ${mergeCandidate.id.slice(0, 8)} for dispatch efficiency.`,
      confidence: 76,
    });
  }

  return suggestions;
}

function getAssignmentRationale(deal: DealWithDetails) {
  const jobs = [...(deal.dispatchJobs ?? [])].sort((a, b) => a.priority_rank - b.priority_rank).slice(0, 3);
  if (jobs.length === 0) {
    return ['No queue candidates yet. Requeue to generate ranked assignment options.'];
  }

  return jobs.map((job) => {
    const score = Number(job.score).toFixed(1);
    return `Rank ${job.priority_rank}: ${job.driver?.name ?? 'Driver'} score ${score} (status: ${job.status})`;
  });
}

function getExceptionSummary(deal: DealWithDetails, riskBand: 'Low' | 'Medium' | 'High') {
  const exceptions: string[] = [];
  const now = Date.now();

  if (riskBand === 'High') {
    exceptions.push('High SLA risk due to timeline/assignment pressure.');
  }

  const queueLog = (deal.dispatchLogs ?? []).find((item) => item.event_type === 'deal_queued');
  if (queueLog) {
    const ageHours = (now - toDate(queueLog.created_at).getTime()) / (1000 * 60 * 60);
    if (ageHours > 4 && deal.matches.length === 0) {
      exceptions.push(`Dispatch queue is stale (${Math.floor(ageHours)}h without assignment).`);
    }
  }

  if (toDate(deal.demand.deadline).getTime() < now || toDate(deal.shipment.deadline).getTime() < now) {
    exceptions.push('Deadline passed for either pickup or delivery target.');
  }

  return exceptions;
}

function toHealthScore(riskScore: number, milestones: OrderMilestone[]) {
  const doneMilestones = milestones.filter((item) => item.done).length;
  const milestoneRatio = milestones.length === 0 ? 0 : doneMilestones / milestones.length;
  const health = Math.round(100 - riskScore * 0.55 + milestoneRatio * 35);
  return Math.max(0, Math.min(100, health));
}

export function buildOrderCommandCenterSnapshot(input: {
  deals: DealWithDetails[];
  roleMode: OrderRoleMode;
}): OrderCommandCenterSnapshot {
  const orders: EnrichedOrder[] = input.deals.map((deal) => {
    const riskScore = getRiskScore(deal);
    const riskBand = toRiskBand(riskScore);
    const milestones = getMilestones(deal);
    const healthScore = toHealthScore(riskScore, milestones);
    const transitions = getTransitions(deal);

    return {
      deal,
      riskScore,
      riskBand,
      healthScore,
      timeline: getTimeline(deal),
      milestones,
      transitions,
      playbooks: getPlaybooks(deal, riskBand),
      splitMergeSuggestions: getSplitMergeSuggestions(deal, input.deals),
      paymentReleaseReady: milestones.every((item) => item.done || item.key !== 'settlement'),
      assignmentRationale: getAssignmentRationale(deal),
      exceptionSummary: getExceptionSummary(deal, riskBand),
    };
  });

  const summary: OrderPortfolioSummary = {
    total: orders.length,
    highRisk: orders.filter((order) => order.riskBand === 'High').length,
    mediumRisk: orders.filter((order) => order.riskBand === 'Medium').length,
    lowRisk: orders.filter((order) => order.riskBand === 'Low').length,
    avgHealth: orders.length > 0 ? Math.round(orders.reduce((acc, order) => acc + order.healthScore, 0) / orders.length) : 0,
    releaseReady: orders.filter((order) => order.paymentReleaseReady).length,
  };

  return {
    roleMode: input.roleMode,
    orders,
    summary,
  };
}
