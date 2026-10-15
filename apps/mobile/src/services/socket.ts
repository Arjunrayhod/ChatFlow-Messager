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
} from '@chatflow/shared';

const SOCKET_SERVER_URL =
  process.env.EXPO_PUBLIC_SOCKET_URL ||
  process.env.EXPO_PUBLIC_API_URL ||
  'http://localhost:4000';

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
