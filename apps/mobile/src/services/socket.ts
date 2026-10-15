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

function getSocketUrl(): string {
  if (process.env.EXPO_PUBLIC_SOCKET_URL) return process.env.EXPO_PUBLIC_SOCKET_URL;
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
    const host = window.location.hostname || 'localhost';
    return `http://${host}:4000`;
  }
  return 'http://localhost:4000';
}

const SOCKET_SERVER_URL = getSocketUrl();

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socketInstance: TypedSocket | null = null;
let currentConnectedToken: string | null = null;

/**
 * Initializes and connects client socket with bearer token.
 */
export function connectSocket(token: string): TypedSocket {
  if (socketInstance) {
    if (socketInstance.connected && currentConnectedToken === token) {
      return socketInstance;
    }
    // Token changed or instance stale: disconnect old socket
    socketInstance.disconnect();
    socketInstance = null;
  }

  currentConnectedToken = token;
  socketInstance = io(SOCKET_SERVER_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  }) as TypedSocket;

  socketInstance.on('connect', () => {
    // Connected to server
  });

  socketInstance.on('connect_error', (_err) => {
    // Socket connection error
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

