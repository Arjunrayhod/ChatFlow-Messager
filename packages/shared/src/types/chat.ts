/**
 * @file Chat, Conversation, and Message types for ChatFlow.
 */

import { UserProfile } from './user';

/** Supported conversation types. */
export type ChatType = 'direct' | 'group';

/** Member roles within a conversation. */
export type ChatRole = 'admin' | 'member';

/** Supported media and message payload formats. */
export type MessageType =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'location';

/** Lifecycle status for a chat message. */
export type MessageDeliveryStatus =
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'read';

/** Single message entity. */
export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  type: MessageType;
  content: string;
  mediaUrl?: string | null;
  metadata?: Record<string, unknown> | null;
  status: MessageDeliveryStatus;
  replyToId?: string | null;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
  editedAt?: string | null;
  expiresAt?: string | null;
  isPinned?: boolean;
}

/** Participant in a conversation. */
export interface ChatMember {
  id: string;
  chatId: string;
  userId: string;
  role: ChatRole;
  joinedAt: string;
  lastReadMessageId?: string | null;
  user?: UserProfile;
}

/** Summary for conversation list view. */
export interface ChatSummary {
  id: string;
  type: ChatType;
  name: string;
  avatarUrl: string | null;
  lastMessage?: ChatMessage | null;
  unreadCount: number;
  updatedAt: string;
  participants: UserProfile[];
}

export interface ChatExpense {
  id: string;
  chatId: string;
  createdBy: string;
  title: string;
  amount: number;
  currency: string;
  paidBy: string;
  splitBetween: string[];
  createdAt: string;
}

export interface ChatTask {
  id: string;
  chatId: string;
  createdBy: string;
  assignedTo: string | null;
  title: string;
  body: string | null;
  dueAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface ScheduledChatMessage {
  id: string;
  chatId: string;
  senderId?: string;
  content: string;
  sendAt: string;
  status: 'pending' | 'sending' | 'sent' | 'cancelled' | 'failed';
  createdAt: string;
}
