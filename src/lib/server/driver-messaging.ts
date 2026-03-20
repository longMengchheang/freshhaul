import 'server-only';

import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { matches, messages } from '@/lib/db/schema';

export interface DriverConversationSummary {
  matchId: string;
  dealId: string;
  status: string;
  farmerName: string;
  pickupProvince: string;
  deliveryProvince: string;
  produceType: string;
  quantityKg: string;
  lastMessagePreview: string | null;
  lastMessageAt: Date;
}

export interface DriverConversationMessage {
  id: string;
  senderId: string;
  content: string;
  createdAt: Date;
}

export async function listDriverConversations(driverId: string): Promise<DriverConversationSummary[]> {
  const driverMatches = await db.query.matches.findMany({
    where: eq(matches.driver_id, driverId),
    orderBy: [desc(matches.created_at)],
    with: {
      deal: {
        with: {
          farmer: {
            columns: {
              name: true,
            },
          },
          shipment: {
            columns: {
              produce_type: true,
              pickup_province: true,
              quantity_kg: true,
            },
          },
          demand: {
            columns: {
              delivery_province: true,
            },
          },
        },
      },
    },
  });

  if (driverMatches.length === 0) {
    return [];
  }

  const matchIds = driverMatches.map((match) => match.id);
  const recentMessages = await db
    .select({
      matchId: messages.match_id,
      content: messages.content,
      createdAt: messages.created_at,
    })
    .from(messages)
    .where(inArray(messages.match_id, matchIds))
    .orderBy(desc(messages.created_at));

  const latestByMatch = new Map<string, { content: string; createdAt: Date }>();
  for (const message of recentMessages) {
    if (!message.matchId || latestByMatch.has(message.matchId)) {
      continue;
    }
    latestByMatch.set(message.matchId, {
      content: message.content,
      createdAt: message.createdAt,
    });
  }

  return driverMatches
    .filter((match) => match.deal?.farmer && match.deal?.shipment && match.deal?.demand)
    .map((match) => {
      const lastMessage = latestByMatch.get(match.id);
      return {
        matchId: match.id,
        dealId: match.deal_id,
        status: match.status,
        farmerName: match.deal!.farmer!.name,
        pickupProvince: match.deal!.shipment!.pickup_province,
        deliveryProvince: match.deal!.demand!.delivery_province,
        produceType: match.deal!.shipment!.produce_type,
        quantityKg: match.deal!.shipment!.quantity_kg,
        lastMessagePreview: lastMessage?.content ?? null,
        lastMessageAt: lastMessage?.createdAt ?? match.created_at,
      };
    })
    .sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());
}

export async function listDriverConversationMessages(
  driverId: string,
  matchId: string,
): Promise<DriverConversationMessage[]> {
  const ownership = await db.query.matches.findFirst({
    where: and(eq(matches.id, matchId), eq(matches.driver_id, driverId)),
  });

  if (!ownership) {
    return [];
  }

  const rows = await db
    .select({
      id: messages.id,
      senderId: messages.sender_id,
      content: messages.content,
      createdAt: messages.created_at,
    })
    .from(messages)
    .where(eq(messages.match_id, matchId))
    .orderBy(desc(messages.created_at));

  return rows.reverse();
}

export async function sendDriverConversationMessage(
  driverId: string,
  matchId: string,
  content: string,
): Promise<boolean> {
  const match = await db.query.matches.findFirst({
    where: and(eq(matches.id, matchId), eq(matches.driver_id, driverId)),
    with: {
      deal: {
        columns: {
          id: true,
          farmer_id: true,
        },
      },
    },
  });

  if (!match?.deal) {
    return false;
  }

  await db.insert(messages).values({
    match_id: matchId,
    deal_id: match.deal.id,
    sender_id: driverId,
    recipient_id: match.deal.farmer_id,
    content: content.trim(),
  });

  return true;
}
