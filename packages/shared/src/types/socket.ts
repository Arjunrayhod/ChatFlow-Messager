/**
 * @file Typed Socket.IO event payloads and contract for ChatFlow.
 * Enforces RULE 0.1: No phone numbers stored, transmitted, or logged.
 */

import { ChatMessage, MessageDeliveryStatus, MessageType } from './chat';
import { UserPresenceStatus } from './user';
import { CallType, CallParticipant } from './call';

/** Client-to-server socket event payloads. */
export interface ClientToServerEvents {
  join_room: (payload: { chatId: string }) => void;
  leave_room: (payload: { chatId: string }) => void;
  send_message: (payload: {
    chatId: string;
    clientTempId: string;
    type: MessageType;
    content: string;
    mediaUrl?: string;
    metadata?: Record<string, unknown> | null;
    replyToId?: string;
  }) => void;
  typing_start: (payload: { chatId: string }) => void;
  typing_stop: (payload: { chatId: string }) => void;
  message_delivered: (payload: { messageId: string; chatId: string }) => void;
  message_read: (payload: { messageId: string; chatId: string }) => void;
  chat_read: (payload: { chatId: string }) => void;
  refresh_chat: (payload: { chatId: string }) => void;

  // WebRTC Calling (Phase 5)
  call_initiate: (payload: {
    callId: string;
    receiverId: string;
    type: CallType;
    sdp: unknown;
  }, acknowledge?: (result: { ok: boolean; error?: string }) => void) => void;
  call_answer: (payload: {
    callId: string;
    callerId: string;
    sdp: unknown;
  }) => void;
  call_reject: (payload: {
    callId: string;
    callerId: string;
    reason?: string;
  }) => void;
  call_ice_candidate: (payload: {
    callId: string;
    targetUserId: string;
    candidate: unknown;
  }) => void;
  call_end: (payload: {
    callId: string;
    targetUserId: string;
    durationSeconds?: number;
    reason?: string;
  }) => void;

  // Backward compatibility alias
  call_offer?: (payload: {
    targetUserId: string;
    sdp: unknown;
    callType: 'audio' | 'video';
  }) => void;
  call_hangup?: (payload: { targetUserId: string; reason?: string }) => void;

  // Snapchat-Style Screenshot Detection Alert
  screenshot_alert: (payload: {
    targetType: 'status' | 'chat';
    targetId: string;
    ownerId: string;
    takerUserId: string;
    takerUsername: string;
    takerDisplayName: string;
  }) => void;

  // Status Story Feed Update
  status_published: (payload: { statusId: string; userId: string }) => void;
}

/** Server-to-client socket event payloads. */
export interface ServerToClientEvents {
  message_new: (payload: {
    message: ChatMessage;
    clientTempId?: string;
  }) => void;
  chat_refresh: (payload: { chatId: string }) => void;
  user_typing: (payload: {
    chatId: string;
    userId: string;
    username: string;
    isTyping: boolean;
  }) => void;
  message_status_update: (payload: {
    messageId: string;
    chatId: string;
    status: MessageDeliveryStatus;
  }) => void;
  user_status_changed: (payload: {
    userId: string;
    status: UserPresenceStatus;
    lastSeen: string | null;
  }) => void;

  // WebRTC Calling (Phase 5)
  incoming_call: (payload: {
    callId: string;
    caller: CallParticipant;
    type: CallType;
    sdp: unknown;
  }) => void;
  call_ringing: (payload: {
    callId: string;
    receiverId: string;
  }) => void;
  call_accepted: (payload: {
    callId: string;
    responder: CallParticipant;
    sdp: unknown;
  }) => void;
  call_rejected: (payload: {
    callId: string;
    reason?: string;
  }) => void;
  call_ice_candidate: (payload: {
    callId: string;
    senderUserId: string;
    candidate: unknown;
  }) => void;
  call_ended: (payload: {
    callId: string;
    peerUserId: string;
    reason?: string;
    durationSeconds?: number;
  }) => void;
  call_missed: (payload: {
    callId: string;
    caller: CallParticipant;
  }) => void;

  // Backward compatibility alias
  call_incoming?: (payload: {
    caller: CallParticipant;
    callType: 'audio' | 'video';
    sdp: unknown;
  }) => void;
  call_answered?: (payload: { responderUserId: string; sdp: unknown }) => void;

  // Snapchat-Style Screenshot Detection
  screenshot_detected: (payload: {
    targetType: 'status' | 'chat';
    targetId: string;
    takerUserId: string;
    takerUsername: string;
    takerDisplayName: string;
    timestamp: string;
  }) => void;

  // Status Story Feed
  status_feed_update: (payload: { userId: string; action: 'created' | 'deleted' }) => void;

  // Generic errors
  error: (payload: { code: string; message: string }) => void;
}

/** Socket handshake auth data. */
export interface SocketAuthData {
  token: string;
}
