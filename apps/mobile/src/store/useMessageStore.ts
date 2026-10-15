/**
 * @file Zustand state store for Real-time Chat Messages and Typing Indicators.
 * Strict compliance with RULE 0.1 (No phone numbers) and RULE 0.7 (Design tokens).
 * 
 * [HINGLISH GUIDE]:
 * Yeh store real-time chat messages ko manage karta hai:
 * 1. Optimistic UI: Message bhejte hi screen par 'sending' status ke sath dikh jata hai.
 * 2. Socket.IO sync: Server se message_new aane par status 'sent' me update hota hai.
 * 3. Typing indicator: Dusra user jab type kar raha ho to "User is typing..." show karta hai.
 */

import { create } from 'zustand';
import { ChatMessage, MessageDeliveryStatus, MessageType } from '@chatflow/shared';
import { getMessageHistory } from '../services/api';
import { emitMessage, emitTypingStart, emitTypingStop } from '../services/socket';

export interface MessageState {
  messagesByChatId: Record<string, ChatMessage[]>;
  isLoadingHistory: boolean;
  typingUsersByChatId: Record<string, string[]>;

  loadHistory: (chatId: string, token: string) => Promise<void>;
  sendMessage: (
    chatId: string,
    content: string,
    currentUserId: string,
    type?: MessageType,
    mediaUrl?: string | null,
    metadata?: Record<string, unknown> | null
  ) => void;
  receiveMessage: (message: ChatMessage, clientTempId?: string) => void;
  setUserTyping: (chatId: string, username: string, isTyping: boolean) => void;
  updateMessageStatus: (messageId: string, chatId: string, status: MessageDeliveryStatus) => void;
  startTyping: (chatId: string) => void;
  stopTyping: (chatId: string) => void;
}

export const useMessageStore = create<MessageState>((set, get) => ({
  messagesByChatId: {},
  isLoadingHistory: false,
  typingUsersByChatId: {},

  /**
   * Loads message history from backend REST endpoint.
   */
  loadHistory: async (chatId: string, token: string) => {
    if (!token || !chatId) return;
    set({ isLoadingHistory: true });

    const result = await getMessageHistory(token, chatId);
    if (result.ok) {
      const { messagesByChatId } = get();
      set({
        messagesByChatId: {
          ...messagesByChatId,
          [chatId]: result.data,
        },
        isLoadingHistory: false,
      });
    } else {
      set({ isLoadingHistory: false });
    }
  },

  /**
   * Optimistically creates message in store and emits to Socket.IO server.
   */
  sendMessage: (
    chatId: string,
    content: string,
    currentUserId: string,
    type: MessageType = 'text',
    mediaUrl: string | null = null,
    metadata: Record<string, unknown> | null = null
  ) => {
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const optimisticMessage: ChatMessage = {
      id: tempId,
      chatId,
      senderId: currentUserId,
      type,
      content: content.trim(),
      mediaUrl: mediaUrl || null,
      metadata: metadata || null,
      status: 'sending',
      replyToId: null,
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
    };

    const { messagesByChatId } = get();
    const existing = messagesByChatId[chatId] || [];

    // Optimistically insert into state
    set({
      messagesByChatId: {
        ...messagesByChatId,
        [chatId]: [...existing, optimisticMessage],
      },
    });

    // Emit over Socket.IO
    emitMessage(chatId, content.trim(), tempId, type, mediaUrl || undefined, metadata || null);
  },

  /**
   * Handles incoming message from Socket.IO server.
   * If clientTempId matches optimistic message, replaces it with confirmed message.
   */
  receiveMessage: (message: ChatMessage, clientTempId?: string) => {
    const { messagesByChatId } = get();
    const existing = messagesByChatId[message.chatId] || [];

    let updated: ChatMessage[];
    if (clientTempId) {
      // Replace optimistic message
      updated = existing.map((m) => (m.id === clientTempId ? message : m));
      // In case it wasn't present
      if (!updated.some((m) => m.id === message.id)) {
        updated.push(message);
      }
    } else {
      // Check if duplicate
      if (existing.some((m) => m.id === message.id)) {
        return;
      }
      updated = [...existing, message];
    }

    set({
      messagesByChatId: {
        ...messagesByChatId,
        [message.chatId]: updated,
      },
    });
  },

  /**
   * Tracks active typing users in a conversation room.
   */
  setUserTyping: (chatId: string, username: string, isTyping: boolean) => {
    const { typingUsersByChatId } = get();
    const current = typingUsersByChatId[chatId] || [];

    let updated: string[];
    if (isTyping) {
      updated = current.includes(username) ? current : [...current, username];
    } else {
      updated = current.filter((u) => u !== username);
    }

    set({
      typingUsersByChatId: {
        ...typingUsersByChatId,
        [chatId]: updated,
      },
    });
  },

  /**
   * Updates delivery status (sent, delivered, read) for a message.
   */
  updateMessageStatus: (messageId: string, chatId: string, status: MessageDeliveryStatus) => {
    const { messagesByChatId } = get();
    const existing = messagesByChatId[chatId];
    if (!existing) return;

    const updated = existing.map((m) =>
      m.id === messageId ? { ...m, status, updatedAt: new Date().toISOString() } : m
    );

    set({
      messagesByChatId: {
        ...messagesByChatId,
        [chatId]: updated,
      },
    });
  },

  startTyping: (chatId: string) => {
    emitTypingStart(chatId);
  },

  stopTyping: (chatId: string) => {
    emitTypingStop(chatId);
  },
}));
