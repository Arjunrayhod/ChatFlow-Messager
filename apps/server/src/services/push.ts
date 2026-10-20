import webpush from 'web-push';
import { env } from '../config/env';
import { db } from './db';
import { logger } from '../utils/logger';
import type { CallRecord, ChatMessage, UserProfile } from '@chatflow/shared';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// Initialize Web Push VAPID credentials
if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(
      env.VAPID_SUBJECT,
      env.VAPID_PUBLIC_KEY,
      env.VAPID_PRIVATE_KEY
    );
  } catch (err) {
    logger.warn({ err }, 'Failed to set VAPID details for Web Push');
  }
}

/** Sends a visible, high-priority incoming-call notification to registered devices (Web + Native). */
export async function sendIncomingCallPush(call: CallRecord): Promise<void> {
  try {
    const tokens = await db.getPushTokens(call.receiverId);
    if (tokens.length === 0) return;

    const expoTokens: string[] = [];
    const webSubscriptions: Array<{ raw: string; sub: webpush.PushSubscription }> = [];

    for (const token of tokens) {
      if (token.startsWith('{') && token.includes('endpoint')) {
        try {
          webSubscriptions.push({ raw: token, sub: JSON.parse(token) });
        } catch {
          // ignore malformed token
        }
      } else if (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[')) {
        expoTokens.push(token);
      }
    }

    // 1. Deliver via Web Push (Android Chrome / Mobile PWA / Desktop)
    const callPayload = JSON.stringify({
      type: 'incoming_call',
      callId: call.id,
      title: call.callerDisplayName || `@${call.callerUsername}`,
      body: call.type === 'video' ? '📞 Incoming video call...' : '📞 Incoming voice call...',
      avatarUrl: call.callerAvatarUrl,
    });

    for (const { raw, sub } of webSubscriptions) {
      try {
        await webpush.sendNotification(sub, callPayload, {
          TTL: 90,
          urgency: 'high',
        });
        logger.info({ receiverId: call.receiverId }, 'Web push incoming-call dispatched successfully');
      } catch (webErr: any) {
        logger.warn({ status: webErr?.statusCode, error: webErr?.message }, 'Web push incoming-call delivery failed');
        if (webErr?.statusCode === 410 || webErr?.statusCode === 404) {
          await db.removePushToken(raw);
        }
      }
    }

    // 2. Deliver via Expo Gateway (Native iOS & Android standalone)
    if (expoTokens.length > 0) {
      const messages = expoTokens.map((to) => ({
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
      } else {
        const result = (await response.json()) as { data?: Array<{ status?: string; message?: string; details?: { error?: string } }> };
        for (const [index, ticket] of (result.data || []).entries()) {
          if (ticket.status === 'error') {
            logger.warn({ callId: call.id, error: ticket.details?.error || ticket.message }, 'Incoming-call push delivery failed');
            const tokenToRemove = expoTokens[index];
            if (ticket.details?.error === 'DeviceNotRegistered' && tokenToRemove) await db.removePushToken(tokenToRemove);
          }
        }
      }
    }
  } catch (err) {
    logger.warn({ err, callId: call.id }, 'Could not dispatch incoming call push notification');
  }
}

/** Sends a push notification for an incoming chat message. */
export async function sendNewMessagePush(
  message: ChatMessage,
  senderUser: UserProfile | { displayName: string; username: string },
  recipientId: string
): Promise<void> {
  try {
    const tokens = await db.getPushTokens(recipientId);
    if (tokens.length === 0) return;

    let bodyText = message.content;
    if (message.type === 'image') bodyText = '📷 Photo';
    else if (message.type === 'video') bodyText = '🎥 Video';
    else if (message.type === 'audio') bodyText = '🎤 Voice message';
    else if (message.type === 'document') bodyText = '📄 Document';
    else if (message.type === 'location') bodyText = '📍 Location';

    const expoTokens: string[] = [];
    const webSubscriptions: Array<{ raw: string; sub: webpush.PushSubscription }> = [];

    for (const token of tokens) {
      if (token.startsWith('{') && token.includes('endpoint')) {
        try {
          webSubscriptions.push({ raw: token, sub: JSON.parse(token) });
        } catch {
          // ignore malformed
        }
      } else if (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[')) {
        expoTokens.push(token);
      }
    }

    // 1. Deliver via Web Push (Android Chrome / Mobile PWA / Desktop)
    const msgPayload = JSON.stringify({
      type: 'message',
      chatId: message.chatId,
      senderId: message.senderId,
      title: senderUser.displayName || `@${senderUser.username}`,
      body: bodyText,
    });

    for (const { raw, sub } of webSubscriptions) {
      try {
        await webpush.sendNotification(sub, msgPayload, {
          TTL: 86400,
          urgency: 'high',
        });
      } catch (webErr: any) {
        logger.warn({ status: webErr?.statusCode, error: webErr?.message }, 'Web push message delivery failed');
        if (webErr?.statusCode === 410 || webErr?.statusCode === 404) {
          await db.removePushToken(raw);
        }
      }
    }

    // 2. Deliver via Expo Gateway
    if (expoTokens.length > 0) {
      const messages = expoTokens.map((to) => ({
        to,
        title: senderUser.displayName || `@${senderUser.username}`,
        body: bodyText,
        sound: 'default',
        priority: 'high',
        channelId: 'messages',
        data: { type: 'chat_message', chatId: message.chatId, senderId: message.senderId },
      }));

      await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Accept-encoding': 'gzip, deflate', 'Content-Type': 'application/json' },
        body: JSON.stringify(messages),
      });
    }
  } catch (err) {
    logger.warn({ err, recipientId }, 'Could not send message push');
  }
}
