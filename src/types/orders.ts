import type { DealWithDetails } from '@/types/app';

export type OrderRoleMode = 'ops' | 'driver' | 'seller' | 'buyer';

export type OrderPlaybookId =
  | 'expedite_dispatch'
  | 'nudge_counterparty'
  | 'mark_in_transit'
  | 'prepare_settlement'
  | 'cancel_order';

export interface OrderTimelineEvent {
  id: string;
  kind: 'status' | 'dispatch' | 'milestone' | 'message';
  title: string;
  detail: string;
  createdAt: string;
  tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger';
}

export interface OrderMilestone {
  key: 'commercial' | 'dispatch' | 'pickup' | 'delivery' | 'settlement';
  label: string;
  done: boolean;
  blockedReason?: string;
}

export interface OrderTransitionOption {
  status: 'transport_pending' | 'in_transit' | 'completed' | 'cancelled' | 'rejected';
  label: string;
  blockedReason?: string;
}

export interface OrderPlaybook {
  id: OrderPlaybookId;
  title: string;
  detail: string;
  ctaLabel: string;
  urgency: 'low' | 'medium' | 'high';
}

export interface OrderSplitSuggestion {
  kind: 'split' | 'merge';
  detail: string;
  confidence: number;
}

export interface EnrichedOrder {
  deal: DealWithDetails;
  riskScore: number;
  riskBand: 'Low' | 'Medium' | 'High';
  healthScore: number;
  timeline: OrderTimelineEvent[];
  milestones: OrderMilestone[];
  transitions: OrderTransitionOption[];
  playbooks: OrderPlaybook[];
  splitMergeSuggestions: OrderSplitSuggestion[];
  paymentReleaseReady: boolean;
  assignmentRationale: string[];
  exceptionSummary: string[];
}

export interface OrderPortfolioSummary {
  total: number;
  highRisk: number;
  mediumRisk: number;
  lowRisk: number;
  avgHealth: number;
  releaseReady: number;
}

export interface OrderCommandCenterSnapshot {
  roleMode: OrderRoleMode;
  orders: EnrichedOrder[];
  summary: OrderPortfolioSummary;
}
