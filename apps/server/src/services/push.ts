import { db } from './db';
import { logger } from '../utils/logger';
import type { CallRecord } from '@chatflow/shared';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/** Sends a visible, high-priority incoming-call notification to registered devices. */
export async function sendIncomingCallPush(call: CallRecord): Promise<void> {
  try {
    const tokens = await db.getPushTokens(call.receiverId);
    if (tokens.length === 0) return;

    const messages = tokens.map((to) => ({
      to,
      title: call.callerDisplayName || `@${call.callerUsername}`,
      body: call.type === 'video' ? 'Incoming video call' : 'Incoming voice call',
      sound: 'default',
      priority: 'high',
      channelId: 'incoming-calls',
      ttl: 90,
      data: { type: 'incoming_call', callId: call.id },
    }));

    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Accept-encoding': 'gzip, deflate', 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });
    if (!response.ok) {
      logger.warn({ status: response.status, callId: call.id }, 'Expo push gateway rejected incoming-call push');
      return;
    }

    const result = await response.json() as { data?: Array<{ status?: string; message?: string; details?: { error?: string } }> };
    for (const [index, ticket] of (result.data || []).entries()) {
      if (ticket.status === 'error') {
        logger.warn({ callId: call.id, error: ticket.details?.error || ticket.message }, 'Incoming-call push delivery failed');
        const tokenToRemove = tokens[index];
        if (ticket.details?.error === 'DeviceNotRegistered' && tokenToRemove) await db.removePushToken(tokenToRemove);
      }
    }
  } catch (err) {
    logger.warn({ err, callId: call.id }, 'Could not reach Expo push gateway');
  }
}
