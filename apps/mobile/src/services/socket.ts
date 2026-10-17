/**
 * @file Client Socket.IO service for real-time messaging, typing, and presence.
 * 
 * [HINGLISH GUIDE]:
 * Yeh frontend ka Socket.IO client manager hai:
 * Backend server (http://localhost:4000) se real-time connection banata hai.
 * Room join karna, live messages send/receive karna, aur typing indicators handle karta hai.
 */

import { io, Socket } from 'socket.io-client';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  ChatMessage,
  MessageType,
  CallType,
} from '@chatflow/shared';
import { Platform } from 'react-native';

export function getSocketUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.hostname) {
    const host = window.location.hostname;
    if (host) {
      return `${window.location.protocol}//${host}:4000`;
    }
  }
  if (process.env.EXPO_PUBLIC_SOCKET_URL) {
    return process.env.EXPO_PUBLIC_SOCKET_URL;
  }
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  return 'http://10.160.190.85:4000';
}

const SOCKET_SERVER_URL = getSocketUrl();

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socketInstance: TypedSocket | null = null;
let currentConnectedToken: string | null = null;

/**
 * Initializes and connects client socket with bearer token.
 * Reuses existing socket if token is unchanged to prevent disconnecting active listeners.
 */
export function connectSocket(token: string, explicitUserId?: string): TypedSocket {
  // If socket already exists for this exact token, reuse it!
  if (socketInstance && currentConnectedToken === token) {
    if (socketInstance.disconnected) {
      socketInstance.connect();
    }
    return socketInstance;
  }

  // If token changed or socket doesn't exist, cleanly disconnect old socket
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }

  // Retrieve cached user profile ID for socket handshake
  let userId = explicitUserId;
  let username: string | undefined;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem('chatflow_auth');
      if (raw) {
        const parsed = JSON.parse(raw);
        userId = userId || parsed?.state?.user?.id;
        username = parsed?.state?.user?.username;
      }
    }
  } catch {
    // Ignore
  }

  currentConnectedToken = token;
  const socketTargetUrl = getSocketUrl();
  socketInstance = io(socketTargetUrl, {
    auth: { token, userId, username },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 20,
    reconnectionDelay: 1000,
  }) as TypedSocket;

  socketInstance.on('connect', () => {
    console.log('[Socket] Connected to server, socketId:', socketInstance?.id);
  });

  socketInstance.on('connect_error', (err) => {
    console.warn('[Socket] Connection error:', err.message);
  });

  return socketInstance;
}

/**
 * Disconnects the active socket connection.
 */
export function disconnectSocket(): void {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
  currentConnectedToken = null;
}

/**
 * Returns current socket instance.
 */
export function getSocket(): TypedSocket | null {
  return socketInstance;
}

/**
 * Joins a chat room.
 */
export function joinRoom(chatId: string): void {
  if (socketInstance) {
    socketInstance.emit('join_room', { chatId });
  }
}

/**
 * Leaves a chat room.
 */
export function leaveRoom(chatId: string): void {
  if (socketInstance) {
    socketInstance.emit('leave_room', { chatId });
  }
}

/**
 * Sends a real-time message to a conversation.
 */
export function emitMessage(
  chatId: string,
  content: string,
  clientTempId: string,
  type: MessageType = 'text',
  mediaUrl?: string,
  metadata?: Record<string, unknown> | null
): void {
  if (socketInstance) {
    socketInstance.emit('send_message', {
      chatId,
      clientTempId,
      content,
      type,
      mediaUrl: mediaUrl || undefined,
      metadata: metadata || null,
    });
  }
}

/**
 * Emits typing start indicator.
 */
export function emitTypingStart(chatId: string): void {
  if (socketInstance) {
    socketInstance.emit('typing_start', { chatId });
  }
}

/**
 * Emits typing stop indicator.
 */
export function emitTypingStop(chatId: string): void {
  if (socketInstance) {
    socketInstance.emit('typing_stop', { chatId });
  }
}

/**
 * Initiates a WebRTC 1-on-1 call with SDP offer.
 */
export function emitCallInitiate(
  callId: string,
  receiverId: string,
  type: CallType,
  sdp: unknown
): void {
  if (socketInstance) {
    socketInstance.emit('call_initiate', { callId, receiverId, type, sdp });
  }
}

/**
 * Answers an incoming call with SDP answer.
 */
export function emitCallAnswer(
  callId: string,
  callerId: string,
  sdp: unknown
): void {
  if (socketInstance) {
    socketInstance.emit('call_answer', { callId, callerId, sdp });
  }
}

/**
 * Declines an incoming call.
 */
export function emitCallReject(
  callId: string,
  callerId: string,
  reason?: string
): void {
  if (socketInstance) {
    socketInstance.emit('call_reject', { callId, callerId, reason });
  }
}

/**
 * Relays an ICE candidate to peer.
 */
export function emitCallIceCandidate(
  callId: string,
  targetUserId: string,
  candidate: unknown
): void {
  if (socketInstance) {
    socketInstance.emit('call_ice_candidate', { callId, targetUserId, candidate });
  }
}

/**
 * Terminates an active call.
 */
export function emitCallEnd(
  callId: string,
  targetUserId: string,
  durationSeconds?: number,
  reason?: string
): void {
  if (socketInstance) {
    socketInstance.emit('call_end', { callId, targetUserId, durationSeconds, reason });
  }
}

