'use server';

import { getCurrentUserContext } from '@/lib/server/current-user';
import { hasActiveRole } from '@/lib/user-roles';
import {
  listDriverConversations,
  listDriverConversationMessages,
  sendDriverConversationMessage,
} from '@/lib/server/driver-messaging';
import { actionFail, actionOk } from '@/lib/server/action-result';

export async function getDriverConversationsAction() {
  try {
    const context = await getCurrentUserContext();
    if (!context) {
      return actionFail('UNAUTHORIZED', 'User not authenticated', null);
    }

    if (!hasActiveRole(context.profile.roles, 'driver')) {
      return actionFail('FORBIDDEN', 'Driver role not active on this account', null);
    }

    const conversations = await listDriverConversations(context.authUser.id);
    return actionOk(conversations);
  } catch (error) {
    console.error('Driver conversations action error:', error);
    return actionFail('UNKNOWN_ERROR', 'Failed to load conversations', null);
  }
}

export async function getDriverConversationMessagesAction(matchId: string) {
  try {
    const context = await getCurrentUserContext();
    if (!context) {
      return actionFail('UNAUTHORIZED', 'User not authenticated', null);
    }

    if (!hasActiveRole(context.profile.roles, 'driver')) {
      return actionFail('FORBIDDEN', 'Driver role not active on this account', null);
    }

    if (!matchId) {
      return actionFail('VALIDATION_ERROR', 'matchId is required', null);
    }

    const rows = await listDriverConversationMessages(context.authUser.id, matchId);
    return actionOk(rows);
  } catch (error) {
    console.error('Driver conversation messages action error:', error);
    return actionFail('UNKNOWN_ERROR', 'Failed to load conversation messages', null);
  }
}

export async function sendDriverMessageAction(input: {
  matchId: string;
  content: string;
}) {
  try {
    const context = await getCurrentUserContext();
    if (!context) {
      return actionFail('UNAUTHORIZED', 'User not authenticated', null);
    }

    if (!hasActiveRole(context.profile.roles, 'driver')) {
      return actionFail('FORBIDDEN', 'Driver role not active on this account', null);
    }

    if (!input.matchId || !input.content?.trim()) {
      return actionFail('VALIDATION_ERROR', 'matchId and content are required', null);
    }

    const ok = await sendDriverConversationMessage(
      context.authUser.id,
      input.matchId,
      input.content,
    );

    if (!ok) {
      return actionFail('NOT_FOUND', 'Conversation not found', null);
    }

    return actionOk({ sent: true });
  } catch (error) {
    console.error('Send driver message action error:', error);
    return actionFail('UNKNOWN_ERROR', 'Failed to send message', null);
  }
}
