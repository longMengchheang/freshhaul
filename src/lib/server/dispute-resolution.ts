import 'server-only';

import { and, desc, eq, or } from 'drizzle-orm';
import { db } from '@/lib/db';
import { disputeEvents, messages, transportDisputes } from '@/lib/db/schema';
import { findDealById } from '@/lib/server/logistics';

export interface DisputeSummary {
  id: string;
  dealId: string;
  status: string;
  reason: string;
  autoResolution: string | null;
  autoConfidence: number | null;
  createdAt: Date;
  updatedAt: Date;
}

function estimateAutoDecision(input: {
  hasDriverMatch: boolean;
  dealStatus: string;
  messageCount: number;
}): { resolution: 'driver_favored' | 'farmer_favored' | 'buyer_favored' | 'split_decision' | 'manual_review'; confidence: number; summary: string } {
  const { hasDriverMatch, dealStatus, messageCount } = input;

  if (!hasDriverMatch) {
    return {
      resolution: 'farmer_favored',
      confidence: 78,
      summary: 'No active driver assignment found at dispute time; farmer-side fulfillment constraints are more likely.',
    };
  }

  if (dealStatus === 'completed') {
    return {
      resolution: 'split_decision',
      confidence: 62,
      summary: 'Trip reached completed status; recommended split decision pending evidence details.',
    };
  }

  if (messageCount < 2) {
    return {
      resolution: 'manual_review',
      confidence: 40,
      summary: 'Insufficient communication evidence in transport thread; manual review required.',
    };
  }

  if (dealStatus === 'in_transit') {
    return {
      resolution: 'driver_favored',
      confidence: 68,
      summary: 'Driver is actively in transit and coordination evidence exists; preliminary driver-favored outcome.',
    };
  }

  return {
    resolution: 'manual_review',
    confidence: 50,
    summary: 'Unable to determine a reliable automated outcome from current signals.',
  };
}

export async function openTransportDispute(input: {
  userId: string;
  dealId: string;
  reason: string;
  evidenceNotes?: string;
}) {
  const deal = await findDealById(input.dealId);
  if (!deal) {
    return null;
  }

  const isParticipant =
    deal.buyer_id === input.userId ||
    deal.farmer_id === input.userId ||
    deal.matches.some((match) => match.driver_id === input.userId);

  if (!isParticipant) {
    return null;
  }

  const firstMatch = deal.matches[0] ?? null;
  const respondentId =
    input.userId === deal.farmer_id ? firstMatch?.driver_id ?? deal.buyer_id : deal.farmer_id;

  const messageRows = await db
    .select({ id: messages.id })
    .from(messages)
    .where(eq(messages.deal_id, deal.id));
  const messageCount = messageRows.length;
  const auto = estimateAutoDecision({
    hasDriverMatch: Boolean(firstMatch),
    dealStatus: deal.status,
    messageCount,
  });

  const [created] = await db
    .insert(transportDisputes)
    .values({
      deal_id: deal.id,
      match_id: firstMatch?.id ?? null,
      opened_by: input.userId,
      respondent_id: respondentId,
      reason: input.reason.trim(),
      evidence_notes: input.evidenceNotes?.trim() || null,
      status: auto.resolution === 'manual_review' ? 'under_review' : 'resolved',
      auto_resolution: auto.resolution,
      auto_confidence: auto.confidence.toFixed(2),
      auto_summary: auto.summary,
      resolved_at: auto.resolution === 'manual_review' ? null : new Date(),
      updated_at: new Date(),
    })
    .returning();

  await db.insert(disputeEvents).values({
    dispute_id: created.id,
    actor_id: input.userId,
    event_type: 'opened',
    message: `Dispute opened: ${input.reason.trim()}`,
  });

  await db.insert(disputeEvents).values({
    dispute_id: created.id,
    actor_id: null,
    event_type: 'auto_resolution',
    message: `${auto.summary} (confidence ${auto.confidence.toFixed(0)}%)`,
  });

  return created;
}

export async function listDisputesForUser(userId: string): Promise<DisputeSummary[]> {
  const rows = await db.query.transportDisputes.findMany({
    where: or(
      eq(transportDisputes.opened_by, userId),
      eq(transportDisputes.respondent_id, userId),
    ),
    orderBy: [desc(transportDisputes.created_at)],
  });

  return rows.map((row) => ({
    id: row.id,
    dealId: row.deal_id,
    status: row.status,
    reason: row.reason,
    autoResolution: row.auto_resolution,
    autoConfidence: row.auto_confidence ? Number.parseFloat(row.auto_confidence) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function listDisputeEvents(disputeId: string, userId: string) {
  const dispute = await db.query.transportDisputes.findFirst({
    where: and(
      eq(transportDisputes.id, disputeId),
      or(eq(transportDisputes.opened_by, userId), eq(transportDisputes.respondent_id, userId)),
    ),
  });

  if (!dispute) {
    return [];
  }

  return db.query.disputeEvents.findMany({
    where: eq(disputeEvents.dispute_id, disputeId),
    orderBy: [desc(disputeEvents.created_at)],
  });
}
