/**
 * @file Typed Socket.IO event payloads and contract for ChatFlow.
 */

import { ChatMessage, MessageDeliveryStatus, MessageType } from './chat';
import { UserPresenceStatus, UserProfile } from './user';

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
    replyToId?: string;
  }) => void;
  typing_start: (payload: { chatId: string }) => void;
  typing_stop: (payload: { chatId: string }) => void;
  message_delivered: (payload: { messageId: string; chatId: string }) => void;
  message_read: (payload: { messageId: string; chatId: string }) => void;
  call_offer: (payload: {
    targetUserId: string;
    sdp: string;
    callType: 'audio' | 'video';
  }) => void;
  call_answer: (payload: { callerUserId: string; sdp: string }) => void;
  call_ice_candidate: (payload: {
    targetUserId: string;
    candidate: unknown;
  }) => void;
  call_hangup: (payload: { targetUserId: string; reason?: string }) => void;
}

/** Server-to-client socket event payloads. */
export interface ServerToClientEvents {
  message_new: (payload: {
    message: ChatMessage;
    clientTempId?: string;
  }) => void;
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
  call_incoming: (payload: {
    caller: UserProfile;
    callType: 'audio' | 'video';
    sdp: string;
  }) => void;
  call_answered: (payload: { responderUserId: string; sdp: string }) => void;
  call_ice_candidate: (payload: {
    senderUserId: string;
    candidate: unknown;
  }) => void;
  call_ended: (payload: { peerUserId: string; reason?: string }) => void;
  error: (payload: { code: string; message: string }) => void;
}

/** Socket handshake auth data. */
export interface SocketAuthData {
  token: string;
}
