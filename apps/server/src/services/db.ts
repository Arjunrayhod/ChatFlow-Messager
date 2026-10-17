/**
 * @file Database service layer supporting Supabase Postgres and in-memory development store.
 * Enforces RULE 0.1: Strictly zero phone numbers in database entities.
 * 
 * [HINGLISH GUIDE]:
 * Yeh Database Service hai.
 * Dual-Mode Support:
 * 1. Production Mode: Agar .env me Supabase URL & Key hai, to Supabase PostgreSQL se connect hota hai.
 * 2. Dev Fallback Mode: Agar database setup nahi hai, to ye automatic in-memory (Map) store me data save karta hai.
 * Isse aap bina kisi external DB setup ke instantly code run aur test kar sakte ho!
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import {
  User,
  UserPresenceStatus,
  Contact,
  UserProfile,
  ChatMessage,
  MessageType,
  MessageDeliveryStatus,
  StatusItem,
  StatusViewer,
  UserStoryGroup,
  CreateStatusDto,
  CallRecord,
  ChatExpense,
  ChatTask,
  ScheduledChatMessage,
} from '@chatflow/shared';
import fs from 'fs';
import path from 'path';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export class DatabaseService {
  private supabase: SupabaseClient | null = null;
  // [HINGLISH]: Local development ke liye in-memory store
  // Fast memory repository for dev mode & offline resilience
  private memoryUsers: Map<string, User> = new Map();
  // In-memory messages store: chatId -> ChatMessage[]
  private memoryMessages: Map<string, ChatMessage[]> = new Map();
  private memoryChatExpiry: Map<string, number> = new Map();
  private memoryHiddenMessages: Map<string, Set<string>> = new Map();
  private memoryPinnedMessages: Map<string, Set<string>> = new Map();
  private memoryChatExpenses: Map<string, ChatExpense[]> = new Map();
  private memoryChatTasks: Map<string, ChatTask[]> = new Map();
  private memoryScheduledMessages: Map<string, ScheduledChatMessage[]> = new Map();
  // In-memory status store: statusId -> StatusItem
  private memoryStatuses: Map<string, StatusItem> = new Map();
  // In-memory status views: statusId -> StatusViewer[]
  private memoryStatusViews: Map<string, StatusViewer[]> = new Map();
  // In-memory calls store: callId -> CallRecord
  private memoryCalls: Map<string, CallRecord> = new Map();

  constructor() {
    if (
      env.SUPABASE_URL &&
      env.SUPABASE_SERVICE_ROLE_KEY &&
      !env.SUPABASE_URL.includes('your-project')
    ) {
      try {
        this.supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
        logger.info('Supabase client initialized successfully.');
      } catch (err) {
        logger.warn({ err }, 'Failed to initialize Supabase client; utilizing resilient dev store.');
      }
    } else {
      logger.info('Running with development resilient database store.');
    }
  }

  /**
   * Finds a user by their unique Firebase UID.
   */
  async findUserByFirebaseUid(firebaseUid: string): Promise<User | null> {
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('users')
          .select('*')
          .eq('firebase_uid', firebaseUid)
          .maybeSingle();

        if (error) {
          logger.warn({ error }, 'Supabase findUserByFirebaseUid error, falling back to local');
        } else if (data) {
          return this.mapDbUserToEntity(data);
        }
      } catch (err) {
        logger.warn({ err }, 'Supabase query exception');
      }
    }

    for (const user of this.memoryUsers.values()) {
      if (user.firebaseUid === firebaseUid) {
        return user;
      }
    }
    return null;
  }

  /**
   * Finds a user by their unique @username.
   */
  async findUserByUsername(username: string): Promise<User | null> {
    const normalized = username.toLowerCase().replace(/^@/, '');

    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('users')
          .select('*')
          .eq('username', normalized)
          .maybeSingle();

        if (error) {
          logger.warn({ error }, 'Supabase findUserByUsername error');
        } else if (data) {
          return this.mapDbUserToEntity(data);
        }
      } catch (err) {
        logger.warn({ err }, 'Supabase query exception');
      }
    }

    for (const user of this.memoryUsers.values()) {
      if (user.username.toLowerCase() === normalized) {
        return user;
      }
    }
    return null;
  }

  /**
   * Finds a user by internal UUID.
   */
  async findUserById(id: string): Promise<User | null> {
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('users')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (error) {
          logger.warn({ error }, 'Supabase findUserById error');
        } else if (data) {
          return this.mapDbUserToEntity(data);
        }
      } catch (err) {
        logger.warn({ err }, 'Supabase query exception');
      }
    }

    return this.memoryUsers.get(id) || null;
  }

  /**
   * Creates a new user record.
   */
  async createUser(data: {
    firebaseUid: string;
    email: string;
    username: string;
    displayName: string;
    avatarUrl?: string | null;
    bio?: string | null;
  }): Promise<User> {
    const now = new Date().toISOString();
    const id = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const newUser: User = {
      id,
      firebaseUid: data.firebaseUid,
      email: data.email,
      username: data.username.toLowerCase().replace(/^@/, ''),
      displayName: data.displayName,
      avatarUrl: data.avatarUrl || null,
      bio: data.bio || null,
      presenceStatus: 'online' as UserPresenceStatus,
      lastSeen: now,
      createdAt: now,
      updatedAt: now,
    };

    if (this.supabase) {
      try {
        const { data: dbData, error } = await this.supabase
          .from('users')
          .insert({
            firebase_uid: newUser.firebaseUid,
            email: newUser.email,
            username: newUser.username,
            display_name: newUser.displayName,
            avatar_url: newUser.avatarUrl,
            bio: newUser.bio,
            presence_status: newUser.presenceStatus,
            last_seen: newUser.lastSeen,
          })
          .select()
          .single();

        if (!error && dbData) {
          const entity = this.mapDbUserToEntity(dbData);
          this.memoryUsers.set(entity.id, entity);
          return entity;
        }
        logger.warn({ error }, 'Supabase insert failed, using memory store');
      } catch (err) {
        logger.warn({ err }, 'Supabase insert exception');
      }
    }

    this.memoryUsers.set(newUser.id, newUser);
    return newUser;
  }

  /**
   * Updates an existing user record.
   */
  async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    const existing = await this.findUserById(id);
    if (!existing) return null;

    const updatedUser: User = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('users')
          .update({
            display_name: updatedUser.displayName,
            username: updatedUser.username,
            avatar_url: updatedUser.avatarUrl,
            bio: updatedUser.bio,
            presence_status: updatedUser.presenceStatus,
            last_seen: updatedUser.lastSeen,
            updated_at: updatedUser.updatedAt,
          })
          .eq('id', id)
          .select()
          .single();

        if (!error && data) {
          const entity = this.mapDbUserToEntity(data);
          this.memoryUsers.set(id, entity);
          return entity;
        }
      } catch (err) {
        logger.warn({ err }, 'Supabase update exception');
      }
    }

    this.memoryUsers.set(id, updatedUser);
    return updatedUser;
  }

  /**
   * Checks if a username is available.
   */
  async isUsernameAvailable(username: string, excludeUserId?: string): Promise<boolean> {
    const normalized = username.toLowerCase().replace(/^@/, '');
    const user = await this.findUserByUsername(normalized);
    if (!user) return true;
    if (excludeUserId && user.id === excludeUserId) return true;
    return false;
  }

  /**
   * Searches users by @username or display name.
   * Enforces RULE 0.1: Returns UserProfile without phone or private email.
   */
  async searchUsers(query: string, excludeUserId?: string): Promise<UserProfile[]> {
    const cleanQuery = query.trim().toLowerCase().replace(/^@/, '');
    if (!cleanQuery) return [];

    const results: UserProfile[] = [];

    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('users')
          .select('id, username, display_name, avatar_url, bio, presence_status, last_seen')
          .or(`username.ilike.%${cleanQuery}%,display_name.ilike.%${cleanQuery}%`)
          .limit(20);

        if (!error && data) {
          return data
            .filter((u) => u.id !== excludeUserId)
            .map((u) => ({
              id: String(u.id),
              username: String(u.username),
              displayName: String(u.display_name),
              avatarUrl: u.avatar_url ? String(u.avatar_url) : null,
              bio: u.bio ? String(u.bio) : null,
              presenceStatus: (u.presence_status as UserPresenceStatus) || 'offline',
              lastSeen: u.last_seen ? String(u.last_seen) : null,
            }));
        }
      } catch (err) {
        logger.warn({ err }, 'Supabase searchUsers exception');
      }
    }

    // In-memory fallback
    for (const user of this.memoryUsers.values()) {
      if (excludeUserId && user.id === excludeUserId) continue;
      if (
        user.username.toLowerCase().includes(cleanQuery) ||
        user.displayName.toLowerCase().includes(cleanQuery)
      ) {
        results.push({
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          bio: user.bio,
          presenceStatus: user.presenceStatus,
          lastSeen: user.lastSeen,
        });
      }
    }

    return results;
  }

  // Memory store for contacts: ownerId -> Map<contactUserId, Contact>
  private memoryContacts: Map<string, Map<string, Contact>> = new Map();

  /**
   * Retrieves all saved contacts for a given user.
   */
  async getContacts(ownerId: string): Promise<Contact[]> {
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('contacts')
          .select(`
            id,
            user_id,
            contact_user_id,
            nickname,
            created_at,
            contact_user:users!contacts_contact_user_id_fkey(
              id,
              username,
              display_name,
              avatar_url,
              bio,
              presence_status,
              last_seen
            )
          `)
          .eq('user_id', ownerId)
          .order('created_at', { ascending: false });

        if (!error && data) {
          return data.map((row: any) => ({
            id: String(row.id),
            ownerId: String(row.user_id),
            contactUserId: String(row.contact_user_id),
            nickname: row.nickname ? String(row.nickname) : null,
            createdAt: String(row.created_at),
            user: {
              id: String(row.contact_user.id),
              username: String(row.contact_user.username),
              displayName: String(row.contact_user.display_name),
              avatarUrl: row.contact_user.avatar_url ? String(row.contact_user.avatar_url) : null,
              bio: row.contact_user.bio ? String(row.contact_user.bio) : null,
              presenceStatus: row.contact_user.presence_status || 'offline',
              lastSeen: row.contact_user.last_seen ? String(row.contact_user.last_seen) : null,
            },
          }));
        }
      } catch (err) {
        logger.warn({ err }, 'Supabase getContacts exception');
      }
    }

    const userContactMap = this.memoryContacts.get(ownerId);
    const result: Contact[] = userContactMap ? Array.from(userContactMap.values()) : [];

    // [HINGLISH]: Active conversations discovery:
    // Agar kisi ne ownerId ke sath chat kiya hai (message bheja ya receive kiya),
    // to wo conversation automatically ownerId ke chat list me add ho jati hai.
    for (const [chatId, messages] of this.memoryMessages.entries()) {
      if (!messages || messages.length === 0) continue;

      let otherUserId: string | null = null;
      if (chatId.startsWith(ownerId + '_')) {
        otherUserId = chatId.substring(ownerId.length + 1);
      } else if (chatId.endsWith('_' + ownerId)) {
        otherUserId = chatId.substring(0, chatId.length - ownerId.length - 1);
      }

      if (otherUserId && !result.some((c) => c.contactUserId === otherUserId)) {
        const otherUser = await this.findUserById(otherUserId);
        if (otherUser) {
          const lastMsg = messages[messages.length - 1];
          result.push({
            id: `conv_${chatId}`,
            ownerId,
            contactUserId: otherUser.id,
            nickname: null,
            createdAt: lastMsg?.createdAt || new Date().toISOString(),
            user: {
              id: otherUser.id,
              username: otherUser.username,
              displayName: otherUser.displayName,
              avatarUrl: otherUser.avatarUrl,
              bio: otherUser.bio,
              presenceStatus: otherUser.presenceStatus,
              lastSeen: otherUser.lastSeen,
            },
          });
        }
      }
    }

    return result;
  }

  /**
   * Checks if a contact relationship already exists.
   */
  async hasContact(ownerId: string, contactUserId: string): Promise<boolean> {
    const contacts = await this.getContacts(ownerId);
    return contacts.some((c) => c.contactUserId === contactUserId);
  }

  /** Checks access to a deterministic direct conversation or a persisted group chat. */
  async canAccessChat(chatId: string, userId: string): Promise<boolean> {
    // Direct chat IDs are generated by sorting the two participant IDs and joining with "_".
    // Match the complete known ID at a boundary because in-memory IDs also contain underscores.
    const candidatePeerId = chatId.startsWith(`${userId}_`)
      ? chatId.slice(userId.length + 1)
      : chatId.endsWith(`_${userId}`)
        ? chatId.slice(0, -(userId.length + 1))
        : null;

    if (candidatePeerId && candidatePeerId !== userId) {
      const expectedChatId = [userId, candidatePeerId].sort().join('_');
      if (expectedChatId === chatId && (await this.findUserById(candidatePeerId))) {
        if ((await this.hasContact(userId, candidatePeerId)) ||
          (await this.hasContact(candidatePeerId, userId))) return true;
        if (this.memoryMessages.get(chatId)?.length) return true;
        if (this.supabase) {
          try {
            const { data, error } = await this.supabase
              .from('messages')
              .select('id')
              .eq('chat_id', chatId)
              .limit(1)
              .maybeSingle();
            if (!error && data) return true;
          } catch (err) {
            logger.warn({ err, chatId }, 'Supabase direct chat existence lookup failed');
          }
        }
        return false;
      }
    }

    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('chat_members')
          .select('id')
          .eq('chat_id', chatId)
          .eq('user_id', userId)
          .maybeSingle();
        if (!error && data) return true;
      } catch (err) {
        logger.warn({ err, chatId, userId }, 'Supabase chat membership lookup failed');
      }
    }

    return false;
  }

  /**
   * Adds a new contact relationship.
   */
  async addContact(
    ownerId: string,
    targetUser: UserProfile,
    nickname?: string
  ): Promise<Contact> {
    const now = new Date().toISOString();
    const contact: Contact = {
      id: `cnt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      ownerId,
      contactUserId: targetUser.id,
      nickname: nickname || null,
      createdAt: now,
      user: targetUser,
    };

    if (this.supabase) {
      try {
        const { error } = await this.supabase.from('contacts').upsert({
          user_id: ownerId,
          contact_user_id: targetUser.id,
          nickname: contact.nickname,
          created_at: contact.createdAt,
        }, { onConflict: 'user_id,contact_user_id', ignoreDuplicates: true });
        if (error) logger.warn({ error, ownerId, contactUserId: targetUser.id }, 'Supabase addContact failed');

        const owner = await this.findUserById(ownerId);
        if (owner) {
          const { error: reciprocalError } = await this.supabase.from('contacts').upsert({
            user_id: targetUser.id,
            contact_user_id: ownerId,
            nickname: null,
            created_at: contact.createdAt,
          }, { onConflict: 'user_id,contact_user_id', ignoreDuplicates: true });
          if (reciprocalError) {
            logger.warn({ error: reciprocalError, ownerId, contactUserId: targetUser.id }, 'Supabase reciprocal contact save failed');
          }
        }
      } catch (err) {
        logger.warn({ err }, 'Supabase addContact exception');
      }
    }

    if (!this.memoryContacts.has(ownerId)) {
      this.memoryContacts.set(ownerId, new Map());
    }
    this.memoryContacts.get(ownerId)!.set(targetUser.id, contact);

    // [HINGLISH]: Reciprocal contact - Dusre user ke contact list me bhi add karo
    // taaki do-tarfa chat inbox bina kisi extra step ke connect ho jaye
    const owner = await this.findUserById(ownerId);
    if (owner) {
      if (!this.memoryContacts.has(targetUser.id)) {
        this.memoryContacts.set(targetUser.id, new Map());
      }
      this.memoryContacts.get(targetUser.id)!.set(ownerId, {
        id: `cnt_${Date.now()}_reciprocal`,
        ownerId: targetUser.id,
        contactUserId: owner.id,
        nickname: null,
        createdAt: now,
        user: {
          id: owner.id,
          username: owner.username,
          displayName: owner.displayName,
          avatarUrl: owner.avatarUrl,
          bio: owner.bio,
          presenceStatus: owner.presenceStatus,
          lastSeen: owner.lastSeen,
        },
      });
    }

    return contact;
  }

  /**
   * Removes a contact relationship.
   */
  async removeContact(ownerId: string, contactUserId: string): Promise<boolean> {
    if (this.supabase) {
      try {
        await this.supabase
          .from('contacts')
          .delete()
          .eq('user_id', ownerId)
          .eq('contact_user_id', contactUserId);
      } catch (err) {
        logger.warn({ err }, 'Supabase removeContact exception');
      }
    }

    const userContactMap = this.memoryContacts.get(ownerId);
    if (userContactMap) {
      return userContactMap.delete(contactUserId);
    }
    return false;
  }

  /**
   * Persists a new chat message to database / memory store.
   */
  async saveMessage(
    chatId: string,
    senderId: string,
    content: string,
    type: MessageType = 'text',
    mediaUrl?: string | null,
    replyToId?: string | null,
    metadata?: Record<string, unknown> | null
  ): Promise<ChatMessage> {
    const now = new Date().toISOString();
    const disappearingSeconds = await this.getChatDisappearingSeconds(chatId);
    const expiresAt = disappearingSeconds > 0
      ? new Date(Date.now() + disappearingSeconds * 1000).toISOString()
      : null;
    const message: ChatMessage = {
      id: randomUUID(),
      chatId,
      senderId,
      type,
      content,
      mediaUrl: mediaUrl || null,
      metadata: metadata || null,
      status: 'sent',
      replyToId: replyToId || null,
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
      editedAt: null,
      expiresAt,
      isPinned: false,
    };

    if (this.supabase) {
      try {
        const { error } = await this.supabase.from('messages').insert({
          id: message.id,
          chat_id: message.chatId,
          sender_id: message.senderId,
          type: message.type,
          content: message.content,
          media_url: message.mediaUrl,
          metadata: message.metadata,
          status: message.status,
          reply_to_id: message.replyToId,
          created_at: message.createdAt,
          updated_at: message.updatedAt,
          expires_at: message.expiresAt,
        });
        if (error) throw error;
      } catch (err) {
        logger.error({ err, messageId: message.id }, 'Supabase saveMessage failed');
        throw err;
      }
    }

    if (!this.memoryMessages.has(chatId)) {
      this.memoryMessages.set(chatId, []);
    }
    this.memoryMessages.get(chatId)!.push(message);

    return message;
  }

  /**
   * Fetches message history for a given chatId.
   */
  async getMessages(chatId: string, limit = 50, userId?: string): Promise<ChatMessage[]> {
    if (this.supabase) {
      try {
        let query = this.supabase
          .from('messages')
          .select('*')
          .eq('chat_id', chatId)
          .order('created_at', { ascending: false })
          .limit(limit);
        if (userId) query = query.or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
        const { data, error } = await query;

        if (!error && data) {
          let rows = data;
          if (userId && rows.length) {
            const { data: hiddenRows } = await this.supabase
              .from('message_hidden_for')
              .select('message_id')
              .eq('user_id', userId)
              .in('message_id', rows.map((row: any) => String(row.id)));
            const hiddenIds = new Set((hiddenRows || []).map((row: any) => String(row.message_id)));
            rows = rows.filter((row: any) => !hiddenIds.has(String(row.id)));
          }
          const { data: pinnedRows } = await this.supabase
            .from('pinned_messages')
            .select('message_id')
            .eq('chat_id', chatId);
          const pinnedIds = new Set((pinnedRows || []).map((row: any) => String(row.message_id)));
          return rows.reverse().map((row: any) => ({
            id: String(row.id),
            chatId: String(row.chat_id),
            senderId: String(row.sender_id),
            type: (row.type as MessageType) || 'text',
            content: String(row.content),
            mediaUrl: row.media_url ? String(row.media_url) : null,
            metadata: row.metadata || null,
            status: (row.status as MessageDeliveryStatus) || 'sent',
            replyToId: row.reply_to_id ? String(row.reply_to_id) : null,
            createdAt: String(row.created_at),
            updatedAt: String(row.updated_at),
            isDeleted: Boolean(row.is_deleted),
            editedAt: row.edited_at ? String(row.edited_at) : null,
            expiresAt: row.expires_at ? String(row.expires_at) : null,
            isPinned: pinnedIds.has(String(row.id)),
          }));
        }
      } catch (err) {
        logger.warn({ err }, 'Supabase getMessages exception');
      }
    }

    const messages = this.memoryMessages.get(chatId) || [];
    const hidden = userId ? this.memoryHiddenMessages.get(userId) : undefined;
    const now = Date.now();
    return messages.filter((message) =>
      (!message.expiresAt || Date.parse(message.expiresAt) > now) &&
      !(hidden?.has(message.id))
    ).slice(-limit).map((message) => ({
      ...message,
      isPinned: this.memoryPinnedMessages.get(chatId)?.has(message.id) || false,
    }));
  }

  async getChatDisappearingSeconds(chatId: string): Promise<number> {
    if (this.supabase) {
      const { data, error } = await this.supabase.from('chat_preferences')
        .select('disappearing_seconds').eq('chat_id', chatId).maybeSingle();
      if (!error && data) return Number(data.disappearing_seconds) || 0;
    }
    return this.memoryChatExpiry.get(chatId) || 0;
  }

  async setChatDisappearingSeconds(chatId: string, userId: string, seconds: number): Promise<boolean> {
    if (![0, 86400, 604800, 7776000].includes(seconds)) return false;
    if (this.supabase) {
      const { error } = await this.supabase.from('chat_preferences').upsert({
        chat_id: chatId, updated_by: userId, disappearing_seconds: seconds,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'chat_id' });
      if (error) throw error;
    }
    this.memoryChatExpiry.set(chatId, seconds);
    return true;
  }

  async editMessage(chatId: string, messageId: string, senderId: string, content: string): Promise<ChatMessage | null> {
    if (this.supabase) {
      const { data, error } = await this.supabase.from('messages')
        .update({ content, edited_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', messageId).eq('chat_id', chatId).eq('sender_id', senderId)
        .eq('type', 'text')
        .gte('created_at', new Date(Date.now() - 15 * 60 * 1000).toISOString())
        .select('*').maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return this.mapMessageRow(data);
    }
    const msg = this.memoryMessages.get(chatId)?.find((m) => m.id === messageId && m.senderId === senderId);
    if (!msg || msg.type !== 'text' || Date.now() - Date.parse(msg.createdAt) > 15 * 60 * 1000) return null;
    msg.content = content;
    msg.editedAt = new Date().toISOString();
    msg.updatedAt = msg.editedAt;
    return { ...msg };
  }

  async hideMessageFor(chatId: string, messageId: string, userId: string, hidden: boolean): Promise<boolean> {
    if (this.supabase) {
      const { data: message, error: lookupError } = await this.supabase.from('messages')
        .select('id').eq('id', messageId).eq('chat_id', chatId).maybeSingle();
      if (lookupError) throw lookupError;
      if (!message) return false;
      const query = this.supabase.from('message_hidden_for');
      const result = hidden
        ? await query.upsert({ message_id: messageId, user_id: userId }, { onConflict: 'message_id,user_id' })
        : await query.delete().eq('message_id', messageId).eq('user_id', userId);
      if (result.error) throw result.error;
    }
    if (!this.supabase && !(this.memoryMessages.get(chatId) || []).some((message) => message.id === messageId)) return false;
    if (!this.memoryHiddenMessages.has(userId)) this.memoryHiddenMessages.set(userId, new Set());
    const hiddenSet = this.memoryHiddenMessages.get(userId)!;
    if (hidden) hiddenSet.add(messageId); else hiddenSet.delete(messageId);
    return true;
  }

  async setMessagePinned(chatId: string, messageId: string, userId: string, pinned: boolean): Promise<boolean> {
    if (this.supabase) {
      const { data: message, error: lookupError } = await this.supabase.from('messages')
        .select('id').eq('id', messageId).eq('chat_id', chatId).maybeSingle();
      if (lookupError) throw lookupError;
      if (!message) return false;
      const query = this.supabase.from('pinned_messages');
      const result = pinned
        ? await query.upsert({ chat_id: chatId, message_id: messageId, pinned_by: userId }, { onConflict: 'chat_id,message_id' })
        : await query.delete().eq('chat_id', chatId).eq('message_id', messageId);
      if (result.error) throw result.error;
    }
    if (!this.supabase && !(this.memoryMessages.get(chatId) || []).some((message) => message.id === messageId)) return false;
    if (!this.memoryPinnedMessages.has(chatId)) this.memoryPinnedMessages.set(chatId, new Set());
    const pins = this.memoryPinnedMessages.get(chatId)!;
    if (pinned) pins.add(messageId); else pins.delete(messageId);
    return true;
  }

  private mapMessageRow(row: any): ChatMessage {
    return {
      id: String(row.id), chatId: String(row.chat_id), senderId: String(row.sender_id),
      type: (row.type as MessageType) || 'text', content: String(row.content),
      mediaUrl: row.media_url ? String(row.media_url) : null, metadata: row.metadata || null,
      status: (row.status as MessageDeliveryStatus) || 'sent',
      replyToId: row.reply_to_id ? String(row.reply_to_id) : null,
      createdAt: String(row.created_at), updatedAt: String(row.updated_at),
      isDeleted: Boolean(row.is_deleted), editedAt: row.edited_at ? String(row.edited_at) : null,
      expiresAt: row.expires_at ? String(row.expires_at) : null,
    };
  }

  async deleteExpiredMessages(): Promise<number> {
    const now = new Date().toISOString();
    if (this.supabase) {
      const { data, error } = await this.supabase.from('messages').delete()
        .not('expires_at', 'is', null).lte('expires_at', now).select('id');
      if (error) throw error;
      return data?.length || 0;
    }
    let count = 0;
    for (const [chatId, messages] of this.memoryMessages.entries()) {
      const active = messages.filter((message) => {
        const expired = Boolean(message.expiresAt && Date.parse(message.expiresAt) <= Date.now());
        if (expired) count += 1;
        return !expired;
      });
      this.memoryMessages.set(chatId, active);
    }
    return count;
  }

  async createChatExpense(data: Omit<ChatExpense, 'id' | 'createdAt'>): Promise<ChatExpense> {
    const expense: ChatExpense = { ...data, id: randomUUID(), createdAt: new Date().toISOString() };
    if (this.supabase) {
      const { data: row, error } = await this.supabase.from('chat_expenses').insert({
        chat_id: expense.chatId, created_by: expense.createdBy, title: expense.title,
        amount: expense.amount, currency: expense.currency, paid_by: expense.paidBy,
        split_between: expense.splitBetween,
      }).select('*').single();
      if (error) throw error;
      return { id: String(row.id), chatId: String(row.chat_id), createdBy: String(row.created_by),
        title: String(row.title), amount: Number(row.amount), currency: String(row.currency),
        paidBy: String(row.paid_by), splitBetween: row.split_between || [], createdAt: String(row.created_at) };
    }
    this.memoryChatExpenses.set(expense.chatId, [...(this.memoryChatExpenses.get(expense.chatId) || []), expense]);
    return expense;
  }

  async getChatExpenses(chatId: string): Promise<ChatExpense[]> {
    if (this.supabase) {
      const { data, error } = await this.supabase.from('chat_expenses').select('*').eq('chat_id', chatId).order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((row: any) => ({ id: String(row.id), chatId: String(row.chat_id), createdBy: String(row.created_by),
        title: String(row.title), amount: Number(row.amount), currency: String(row.currency), paidBy: String(row.paid_by),
        splitBetween: row.split_between || [], createdAt: String(row.created_at) }));
    }
    return this.memoryChatExpenses.get(chatId) || [];
  }

  async createChatTask(data: Omit<ChatTask, 'id' | 'createdAt' | 'completedAt'>): Promise<ChatTask> {
    const task: ChatTask = { ...data, id: randomUUID(), completedAt: null, createdAt: new Date().toISOString() };
    if (this.supabase) {
      const { data: row, error } = await this.supabase.from('chat_tasks').insert({
        chat_id: task.chatId, created_by: task.createdBy, assigned_to: task.assignedTo,
        title: task.title, body: task.body, due_at: task.dueAt,
      }).select('*').single();
      if (error) throw error;
      return { id: String(row.id), chatId: String(row.chat_id), createdBy: String(row.created_by), assignedTo: row.assigned_to || null,
        title: String(row.title), body: row.body || null, dueAt: row.due_at || null, completedAt: row.completed_at || null, createdAt: String(row.created_at) };
    }
    this.memoryChatTasks.set(task.chatId, [...(this.memoryChatTasks.get(task.chatId) || []), task]);
    return task;
  }

  async getChatTasks(chatId: string): Promise<ChatTask[]> {
    if (this.supabase) {
      const { data, error } = await this.supabase.from('chat_tasks').select('*').eq('chat_id', chatId).order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((row: any) => ({ id: String(row.id), chatId: String(row.chat_id), createdBy: String(row.created_by),
        assignedTo: row.assigned_to || null, title: String(row.title), body: row.body || null,
        dueAt: row.due_at || null, completedAt: row.completed_at || null, createdAt: String(row.created_at) }));
    }
    return this.memoryChatTasks.get(chatId) || [];
  }

  async completeChatTask(chatId: string, taskId: string, completed: boolean): Promise<ChatTask | null> {
    if (this.supabase) {
      const { data, error } = await this.supabase.from('chat_tasks').update({ completed_at: completed ? new Date().toISOString() : null })
        .eq('chat_id', chatId).eq('id', taskId).select('*').maybeSingle();
      if (error) throw error;
      return data ? { id: String(data.id), chatId: String(data.chat_id), createdBy: String(data.created_by), assignedTo: data.assigned_to || null,
        title: String(data.title), body: data.body || null, dueAt: data.due_at || null, completedAt: data.completed_at || null, createdAt: String(data.created_at) } : null;
    }
    const task = (this.memoryChatTasks.get(chatId) || []).find((item) => item.id === taskId);
    if (!task) return null;
    task.completedAt = completed ? new Date().toISOString() : null;
    return task;
  }

  async createScheduledMessage(data: { chatId: string; senderId: string; content: string; sendAt: string }): Promise<ScheduledChatMessage> {
    const scheduled: ScheduledChatMessage = { id: randomUUID(), chatId: data.chatId, senderId: data.senderId, content: data.content,
      sendAt: data.sendAt, status: 'pending', createdAt: new Date().toISOString() };
    if (this.supabase) {
      const { data: row, error } = await this.supabase.from('scheduled_messages').insert({
        chat_id: data.chatId, sender_id: data.senderId, content: data.content, send_at: data.sendAt,
      }).select('*').single();
      if (error) throw error;
      return { id: String(row.id), chatId: String(row.chat_id), content: String(row.content), sendAt: String(row.send_at), status: row.status, createdAt: String(row.created_at) };
    }
    this.memoryScheduledMessages.set(data.chatId, [...(this.memoryScheduledMessages.get(data.chatId) || []), scheduled]);
    return scheduled;
  }

  async claimDueScheduledMessages(): Promise<Array<{ id: string; chatId: string; senderId: string; content: string }>> {
    if (this.supabase) {
      const { data, error } = await this.supabase.from('scheduled_messages').select('id,chat_id,sender_id,content')
        .eq('status', 'pending').lte('send_at', new Date().toISOString()).limit(50);
      if (error) throw error;
      const claimed: Array<{ id: string; chatId: string; senderId: string; content: string }> = [];
      for (const row of data || []) {
        const { data: claim, error: claimError } = await this.supabase.from('scheduled_messages')
          .update({ status: 'sending' }).eq('id', row.id).eq('status', 'pending').select('id').maybeSingle();
        if (claimError) throw claimError;
        if (claim) claimed.push({ id: String(row.id), chatId: String(row.chat_id), senderId: String(row.sender_id), content: String(row.content) });
      }
      return claimed;
    }
    return Array.from(this.memoryScheduledMessages.values()).flat()
      .filter((item) => item.status === 'pending' && Date.parse(item.sendAt) <= Date.now())
      .map((item) => { item.status = 'sending' as ScheduledChatMessage['status']; return { id: item.id, chatId: item.chatId, senderId: item.senderId || '', content: item.content }; });
  }

  async finishScheduledMessage(id: string, messageId: string | null, failed = false): Promise<void> {
    if (this.supabase) {
      const { error } = await this.supabase.from('scheduled_messages').update({
        status: failed ? 'failed' : 'sent', sent_message_id: messageId,
      }).eq('id', id).eq('status', 'sending');
      if (error) throw error;
      return;
    }
    for (const entries of this.memoryScheduledMessages.values()) {
      const scheduled = entries.find((item) => item.id === id);
      if (scheduled) scheduled.status = failed ? 'failed' : 'sent';
    }
  }

  /**
   * Updates message delivery / read status.
   */
  async updateMessageStatus(
    messageId: string,
    chatId: string,
    status: MessageDeliveryStatus
  ): Promise<boolean> {
    if (this.supabase) {
      try {
        await this.supabase
          .from('messages')
          .update({ status, updated_at: new Date().toISOString() })
          .eq('id', messageId)
          .eq('chat_id', chatId);
      } catch (err) {
        logger.warn({ err }, 'Supabase updateMessageStatus exception');
      }
    }

    const messages = this.memoryMessages.get(chatId);
    if (messages) {
      const msg = messages.find((m) => m.id === messageId);
      if (msg) {
        msg.status = status;
        msg.updatedAt = new Date().toISOString();
        return true;
      }
    }
    return false;
  }

  /**
   * Creates a new status / story (24-hour expiration).
   */
  async createStatus(userId: string, data: CreateStatusDto): Promise<StatusItem> {
    const user = await this.findUserById(userId);
    const id = randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

    const statusItem: StatusItem = {
      id,
      userId,
      user: user
        ? {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
            bio: user.bio,
            presenceStatus: user.presenceStatus,
            lastSeen: user.lastSeen,
          }
        : undefined,
      mediaUrl: data.mediaUrl || null,
      mediaType: data.mediaType,
      caption: data.caption || null,
      backgroundColor: data.backgroundColor || '#075E54',
      durationSeconds: data.durationSeconds || (data.mediaType === 'video' ? 15 : 5),
      createdAt: now.toISOString(),
      expiresAt,
      viewersCount: 0,
      hasViewed: false,
      isOwn: true,
      viewers: [],
    };

    if (this.supabase) {
      try {
        const { error } = await this.supabase.from('statuses').insert({
          id: statusItem.id,
          user_id: userId,
          media_url: statusItem.mediaUrl,
          media_type: statusItem.mediaType,
          caption: statusItem.caption,
          background_color: statusItem.backgroundColor,
          duration_seconds: statusItem.durationSeconds,
          created_at: statusItem.createdAt,
          expires_at: statusItem.expiresAt,
        });
        if (error) throw error;
      } catch (err) {
        logger.error({ err, statusId: statusItem.id }, 'Supabase createStatus failed');
        throw err;
      }
    }

    this.memoryStatuses.set(id, statusItem);
    this.memoryStatusViews.set(id, []);
    return statusItem;
  }

  /**
   * Fetches status feed: user's own active stories + active stories from contacts.
   */
  async getStatusFeed(currentUserId: string): Promise<{ myStories: StatusItem[]; contactStories: UserStoryGroup[] }> {
    const now = new Date();

    if (this.supabase) {
      try {
        const contacts = await this.getContacts(currentUserId);
        const contactIds = new Set(contacts.map((contact) => contact.contactUserId));
        const { data: rows, error } = await this.supabase
          .from('statuses')
          .select('*, user:users!statuses_user_id_fkey(id, username, display_name, avatar_url, bio, presence_status, last_seen)')
          .in('user_id', [currentUserId, ...contactIds])
          .gt('expires_at', now.toISOString())
          .order('created_at', { ascending: true });

        if (!error && rows) {
          const { data: viewRows, error: viewsError } = await this.supabase
            .from('status_views')
            .select('status_id, viewer_id, viewed_at, has_screenshotted, screenshotted_at, viewer:users!status_views_viewer_id_fkey(id, username, display_name, avatar_url)')
            .in('status_id', rows.map((row) => String(row.id)));
          if (viewsError) logger.warn({ error: viewsError }, 'Supabase status views query failed');

          const viewsByStatus = new Map<string, StatusViewer[]>();
          for (const row of viewRows || []) {
            const viewer = Array.isArray(row.viewer) ? row.viewer[0] : row.viewer;
            if (!viewer) continue;
            const viewers = viewsByStatus.get(String(row.status_id)) || [];
            viewers.push({
              userId: String(row.viewer_id),
              username: String(viewer.username),
              displayName: String(viewer.display_name),
              avatarUrl: viewer.avatar_url ? String(viewer.avatar_url) : null,
              viewedAt: String(row.viewed_at),
              hasScreenshotted: Boolean(row.has_screenshotted),
              screenshottedAt: row.screenshotted_at ? String(row.screenshotted_at) : null,
            });
            viewsByStatus.set(String(row.status_id), viewers);
          }

          const activeStatuses: StatusItem[] = rows.map((row) => {
            const linkedUser = Array.isArray(row.user) ? row.user[0] : row.user;
            const viewers = viewsByStatus.get(String(row.id)) || [];
            return {
              id: String(row.id),
              userId: String(row.user_id),
              user: linkedUser ? {
                id: String(linkedUser.id),
                username: String(linkedUser.username),
                displayName: String(linkedUser.display_name),
                avatarUrl: linkedUser.avatar_url ? String(linkedUser.avatar_url) : null,
                bio: linkedUser.bio ? String(linkedUser.bio) : null,
                presenceStatus: (linkedUser.presence_status as UserPresenceStatus) || 'offline',
                lastSeen: linkedUser.last_seen ? String(linkedUser.last_seen) : null,
              } : undefined,
              mediaUrl: row.media_url ? String(row.media_url) : null,
              mediaType: row.media_type as StatusItem['mediaType'],
              caption: row.caption ? String(row.caption) : null,
              backgroundColor: String(row.background_color || '#075E54'),
              durationSeconds: Number(row.duration_seconds || 5),
              createdAt: String(row.created_at),
              expiresAt: String(row.expires_at),
              viewersCount: viewers.length,
              hasViewed: viewers.some((viewer) => viewer.userId === currentUserId),
              isOwn: String(row.user_id) === currentUserId,
              viewers: String(row.user_id) === currentUserId ? viewers : undefined,
            };
          });

          const myStories = activeStatuses.filter((status) => status.userId === currentUserId);
          const grouped = new Map<string, StatusItem[]>();
          for (const status of activeStatuses) {
            if (status.userId === currentUserId || !contactIds.has(status.userId)) continue;
            const stories = grouped.get(status.userId) || [];
            stories.push(status);
            grouped.set(status.userId, stories);
          }

          const contactStories: UserStoryGroup[] = Array.from(grouped.entries()).map(([userId, stories]) => {
            const first = stories[0]!;
            const last = stories[stories.length - 1]!;
            return {
              userId,
              username: first.user?.username || 'unknown',
              displayName: first.user?.displayName || 'User',
              avatarUrl: first.user?.avatarUrl || null,
              hasUnseen: stories.some((story) => !story.hasViewed),
              lastUpdated: last.createdAt,
              stories,
            };
          });
          contactStories.sort((a, b) => {
            if (a.hasUnseen !== b.hasUnseen) return a.hasUnseen ? -1 : 1;
            return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
          });
          return { myStories, contactStories };
        }
        if (error) logger.warn({ error }, 'Supabase status feed query failed, using memory store');
      } catch (err) {
        logger.warn({ err }, 'Supabase status feed exception, using memory store');
      }
    }

    // 1. Find all active statuses
    const allStatuses = Array.from(this.memoryStatuses.values()).filter(
      (s) => new Date(s.expiresAt) > now
    );

    // 2. Separate user's own stories
    const myStories = allStatuses
      .filter((s) => s.userId === currentUserId)
      .map((s) => {
        const viewers = this.memoryStatusViews.get(s.id) || [];
        return {
          ...s,
          isOwn: true,
          viewersCount: viewers.length,
          viewers,
        };
      })
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    // 3. Get user's contacts
    const contacts = await this.getContacts(currentUserId);
    const contactUserIds = new Set(contacts.map((c) => c.contactUserId));

    const contactStoriesMap = new Map<string, StatusItem[]>();

    for (const status of allStatuses) {
      if (status.userId === currentUserId) continue;

      // In development mode or if contacts exist, match contacts or include users
      if (contactUserIds.size > 0 && !contactUserIds.has(status.userId)) {
        continue;
      }

      const existing = contactStoriesMap.get(status.userId) || [];
      const viewers = this.memoryStatusViews.get(status.id) || [];
      const hasViewed = viewers.some((v) => v.userId === currentUserId);

      existing.push({
        ...status,
        hasViewed,
        viewersCount: viewers.length,
      });
      contactStoriesMap.set(status.userId, existing);
    }

    // Build UserStoryGroup
    const contactStories: UserStoryGroup[] = [];
    for (const [userId, stories] of contactStoriesMap.entries()) {
      if (stories.length === 0) continue;
      stories.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      const firstStory = stories[0]!;
      const lastStory = stories[stories.length - 1]!;
      const u = firstStory.user || (await this.findUserById(userId));
      const hasUnseen = stories.some((s) => !s.hasViewed);
      const lastUpdated = lastStory.createdAt;

      contactStories.push({
        userId,
        username: u?.username || 'unknown',
        displayName: u?.displayName || 'User',
        avatarUrl: u?.avatarUrl || null,
        hasUnseen,
        lastUpdated,
        stories,
      });
    }

    // Sort: users with unseen stories first, then by last updated
    contactStories.sort((a, b) => {
      if (a.hasUnseen && !b.hasUnseen) return -1;
      if (!a.hasUnseen && b.hasUnseen) return 1;
      return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
    });

    return { myStories, contactStories };
  }

  /**
   * Records a view on a status update (and tracks if viewer screenshotted).
   */
  async recordStatusView(
    statusId: string,
    viewerId: string,
    hasScreenshotted = false
  ): Promise<{ success: boolean; viewersCount: number }> {
    let status = this.memoryStatuses.get(statusId);
    if (!status && this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('statuses')
          .select('id, user_id, media_url, media_type, caption, background_color, duration_seconds, created_at, expires_at')
          .eq('id', statusId)
          .gt('expires_at', new Date().toISOString())
          .maybeSingle();
        if (!error && data) {
          const user = await this.findUserById(String(data.user_id));
          status = {
            id: String(data.id),
            userId: String(data.user_id),
            user: user ? {
              id: user.id, username: user.username, displayName: user.displayName,
              avatarUrl: user.avatarUrl, bio: user.bio,
              presenceStatus: user.presenceStatus, lastSeen: user.lastSeen,
            } : undefined,
            mediaUrl: data.media_url ? String(data.media_url) : null,
            mediaType: data.media_type as StatusItem['mediaType'],
            caption: data.caption ? String(data.caption) : null,
            backgroundColor: String(data.background_color || '#075E54'),
            durationSeconds: Number(data.duration_seconds || 5),
            createdAt: String(data.created_at),
            expiresAt: String(data.expires_at),
            viewersCount: 0, hasViewed: false, isOwn: false, viewers: [],
          };
          this.memoryStatuses.set(statusId, status);
        }
      } catch (err) {
        logger.warn({ err, statusId }, 'Supabase status lookup failed');
      }
    }
    if (!status) return { success: false, viewersCount: 0 };

    // Don't count owner viewing their own status
    if (status.userId === viewerId) {
      const existing = this.memoryStatusViews.get(statusId) || [];
      return { success: true, viewersCount: existing.length };
    }

    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('status_views')
          .select('viewer_id, viewed_at, has_screenshotted, screenshotted_at, viewer:users!status_views_viewer_id_fkey(id, username, display_name, avatar_url)')
          .eq('status_id', statusId);
        if (!error && data) {
          this.memoryStatusViews.set(statusId, data.flatMap((row) => {
            const user = Array.isArray(row.viewer) ? row.viewer[0] : row.viewer;
            if (!user) return [];
            return [{
              userId: String(row.viewer_id),
              username: String(user.username),
              displayName: String(user.display_name),
              avatarUrl: user.avatar_url ? String(user.avatar_url) : null,
              viewedAt: String(row.viewed_at),
              hasScreenshotted: Boolean(row.has_screenshotted),
              screenshottedAt: row.screenshotted_at ? String(row.screenshotted_at) : null,
            }];
          }));
        } else if (error) {
          logger.warn({ error, statusId }, 'Supabase status viewers lookup failed');
        }
      } catch (err) {
        logger.warn({ err, statusId }, 'Supabase status viewers query exception');
      }
    }

    const viewers = this.memoryStatusViews.get(statusId) || [];
    const existingIndex = viewers.findIndex((v) => v.userId === viewerId);

    if (existingIndex >= 0) {
      const existingViewer = viewers[existingIndex];
      if (existingViewer && hasScreenshotted && !existingViewer.hasScreenshotted) {
        existingViewer.hasScreenshotted = true;
        existingViewer.screenshottedAt = new Date().toISOString();
      }
    } else {
      const viewerUser = await this.findUserById(viewerId);
      if (viewerUser) {
        viewers.push({
          userId: viewerUser.id,
          username: viewerUser.username,
          displayName: viewerUser.displayName,
          avatarUrl: viewerUser.avatarUrl,
          viewedAt: new Date().toISOString(),
          hasScreenshotted: !!hasScreenshotted,
          screenshottedAt: hasScreenshotted ? new Date().toISOString() : null,
        });
      }
    }

    this.memoryStatusViews.set(statusId, viewers);
    status.viewersCount = viewers.length;

    if (this.supabase) {
      try {
        const { error } = await this.supabase.from('status_views').upsert({
          status_id: statusId,
          viewer_id: viewerId,
          viewed_at: new Date().toISOString(),
          has_screenshotted: hasScreenshotted,
          screenshotted_at: hasScreenshotted ? new Date().toISOString() : null,
        });
        if (error) logger.warn({ error, statusId, viewerId }, 'Supabase status view upsert failed');
      } catch (err) {
        logger.warn({ err }, 'Supabase recordStatusView exception');
      }
    }

    return { success: true, viewersCount: viewers.length };
  }

  /**
   * Returns all viewers of a user's own status.
   */
  async getStatusViewers(statusId: string, ownerId: string): Promise<StatusViewer[]> {
    let status = this.memoryStatuses.get(statusId);
    if (!status && this.supabase) {
      try {
        const { data } = await this.supabase
          .from('statuses')
          .select('id, user_id')
          .eq('id', statusId)
          .eq('user_id', ownerId)
          .maybeSingle();
        if (data) status = { id: String(data.id), userId: String(data.user_id) } as StatusItem;
      } catch (err) {
        logger.warn({ err, statusId }, 'Supabase status ownership lookup failed');
      }
    }
    if (!status || status.userId !== ownerId) return [];

    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('status_views')
          .select('viewer_id, viewed_at, has_screenshotted, screenshotted_at, viewer:users!status_views_viewer_id_fkey(id, username, display_name, avatar_url)')
          .eq('status_id', statusId);
        if (!error && data) {
          const viewers = data.flatMap((row) => {
            const user = Array.isArray(row.viewer) ? row.viewer[0] : row.viewer;
            if (!user) return [];
            return [{
              userId: String(row.viewer_id),
              username: String(user.username),
              displayName: String(user.display_name),
              avatarUrl: user.avatar_url ? String(user.avatar_url) : null,
              viewedAt: String(row.viewed_at),
              hasScreenshotted: Boolean(row.has_screenshotted),
              screenshottedAt: row.screenshotted_at ? String(row.screenshotted_at) : null,
            }];
          });
          this.memoryStatusViews.set(statusId, viewers);
          return viewers;
        }
      } catch (err) {
        logger.warn({ err, statusId }, 'Supabase status viewers query exception');
      }
    }
    return this.memoryStatusViews.get(statusId) || [];
  }

  async getStatusOwnerId(statusId: string): Promise<string | null> {
    const cached = this.memoryStatuses.get(statusId);
    if (cached) return cached.userId;
    if (!this.supabase) return null;
    try {
      const { data, error } = await this.supabase
        .from('statuses')
        .select('user_id')
        .eq('id', statusId)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();
      if (error) logger.warn({ error, statusId }, 'Supabase status owner lookup failed');
      return data?.user_id ? String(data.user_id) : null;
    } catch (err) {
      logger.warn({ err, statusId }, 'Supabase status owner lookup exception');
      return null;
    }
  }

  /**
   * Deletes a status before expiration.
   */
  async deleteStatus(statusId: string, ownerId: string): Promise<boolean> {
    let status = this.memoryStatuses.get(statusId);
    if (!status && this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('statuses')
          .select('id, user_id, media_url')
          .eq('id', statusId)
          .eq('user_id', ownerId)
          .maybeSingle();
        if (!error && data) {
          status = { id: String(data.id), userId: String(data.user_id), mediaUrl: data.media_url ? String(data.media_url) : null } as StatusItem;
        }
      } catch (err) {
        logger.warn({ err, statusId }, 'Supabase status lookup for deletion failed');
      }
    }
    if (!status) return false;
    if (status.userId !== ownerId) return false;

    // Delete associated media file if local upload
    if (status.mediaUrl && status.mediaUrl.startsWith('/uploads/')) {
      try {
        const filePath = path.resolve(__dirname, '..', '..', status.mediaUrl.replace(/^\//, ''));
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (err) {
        logger.warn({ err }, 'Failed to delete status media file from disk');
      }
    }

    this.memoryStatuses.delete(statusId);
    this.memoryStatusViews.delete(statusId);

    if (this.supabase) {
      try {
        await this.supabase.from('statuses').delete().eq('id', statusId);
      } catch (err) {
        logger.warn({ err }, 'Supabase deleteStatus exception');
      }
    }

    return true;
  }

  /**
   * Prunes expired statuses older than 24 hours and cleans storage.
   */
  async deleteExpiredStatuses(): Promise<number> {
    const now = new Date();
    let deletedCount = 0;

    for (const [id, status] of this.memoryStatuses.entries()) {
      if (new Date(status.expiresAt) <= now) {
        if (status.mediaUrl && status.mediaUrl.startsWith('/uploads/')) {
          try {
            const filePath = path.resolve(__dirname, '..', '..', status.mediaUrl.replace(/^\//, ''));
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
          } catch {
            // ignore
          }
        }
        this.memoryStatuses.delete(id);
        this.memoryStatusViews.delete(id);
        deletedCount++;
      }
    }

    if (this.supabase) {
      try {
        await this.supabase.from('statuses').delete().lte('expires_at', now.toISOString());
      } catch (err) {
        logger.warn({ err }, 'Supabase deleteExpiredStatuses exception');
      }
    }

    return deletedCount;
  }

  /**
   * Persists a new Call Record (Dual-Mode: in-memory and Supabase).
   * Strict adherence to RULE 0.1: No phone numbers stored.
   */
  async createCallRecord(call: CallRecord): Promise<CallRecord> {
    this.memoryCalls.set(call.id, call);

    if (this.supabase) {
      try {
        await this.supabase.from('calls').insert({
          id: call.id,
          caller_id: call.callerId,
          caller_username: call.callerUsername,
          caller_display_name: call.callerDisplayName,
          caller_avatar_url: call.callerAvatarUrl || null,
          receiver_id: call.receiverId,
          receiver_username: call.receiverUsername,
          receiver_display_name: call.receiverDisplayName,
          receiver_avatar_url: call.receiverAvatarUrl || null,
          type: call.type,
          status: call.status,
          started_at: call.startedAt,
          answered_at: call.answeredAt || null,
          ended_at: call.endedAt || null,
          duration_seconds: call.durationSeconds,
        });
      } catch (err) {
        logger.warn({ err, callId: call.id }, 'Supabase createCallRecord error, saved to memory');
      }
    }

    return call;
  }

  /**
   * Updates an existing call record (e.g. status connected/ended, duration).
   */
  async updateCallRecord(callId: string, updates: Partial<CallRecord>): Promise<CallRecord | null> {
    const existing = this.memoryCalls.get(callId);
    if (existing) {
      const updated = { ...existing, ...updates };
      this.memoryCalls.set(callId, updated);

      if (this.supabase) {
        try {
          const dbUpdates: Record<string, unknown> = {};
          if (updates.status) dbUpdates.status = updates.status;
          if (updates.answeredAt) dbUpdates.answered_at = updates.answeredAt;
          if (updates.endedAt) dbUpdates.ended_at = updates.endedAt;
          if (typeof updates.durationSeconds === 'number') dbUpdates.duration_seconds = updates.durationSeconds;

          await this.supabase.from('calls').update(dbUpdates).eq('id', callId);
        } catch (err) {
          logger.warn({ err, callId }, 'Supabase updateCallRecord error');
        }
      }

      return updated;
    }

    if (this.supabase) {
      try {
        const dbUpdates: Record<string, unknown> = {};
        if (updates.status) dbUpdates.status = updates.status;
        if (updates.answeredAt) dbUpdates.answered_at = updates.answeredAt;
        if (updates.endedAt) dbUpdates.ended_at = updates.endedAt;
        if (typeof updates.durationSeconds === 'number') dbUpdates.duration_seconds = updates.durationSeconds;

        const { data, error } = await this.supabase
          .from('calls')
          .update(dbUpdates)
          .eq('id', callId)
          .select()
          .maybeSingle();

        if (!error && data) {
          return this.mapDbCallToEntity(data);
        }
      } catch (err) {
        logger.warn({ err, callId }, 'Supabase updateCallRecord error');
      }
    }

    return null;
  }

  /**
   * Finds a call record by its ID.
   */
  async findCallById(callId: string): Promise<CallRecord | null> {
    if (this.memoryCalls.has(callId)) {
      return this.memoryCalls.get(callId)!;
    }

    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('calls')
          .select('*')
          .eq('id', callId)
          .maybeSingle();

        if (!error && data) {
          return this.mapDbCallToEntity(data);
        }
      } catch (err) {
        logger.warn({ err, callId }, 'Supabase findCallById error');
      }
    }

    return null;
  }

  /**
   * Retrieves all call logs for a user (as caller or receiver), sorted descending by start time.
   */
  async getUserCalls(userId: string): Promise<CallRecord[]> {
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('calls')
          .select('*')
          .or(`caller_id.eq.${userId},receiver_id.eq.${userId}`)
          .order('started_at', { ascending: false });

        if (!error && data) {
          return data.map((row) => this.mapDbCallToEntity(row));
        }
      } catch (err) {
        logger.warn({ err, userId }, 'Supabase getUserCalls error, falling back to memory');
      }
    }

    const calls = Array.from(this.memoryCalls.values())
      .filter((c) => c.callerId === userId || c.receiverId === userId)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

    return calls;
  }

  /**
   * Deletes a specific call record.
   */
  async deleteCallRecord(callId: string, userId: string): Promise<boolean> {
    const call = this.memoryCalls.get(callId);
    if (call && (call.callerId === userId || call.receiverId === userId)) {
      this.memoryCalls.delete(callId);
    }

    if (this.supabase) {
      try {
        await this.supabase
          .from('calls')
          .delete()
          .eq('id', callId)
          .or(`caller_id.eq.${userId},receiver_id.eq.${userId}`);
      } catch (err) {
        logger.warn({ err, callId }, 'Supabase deleteCallRecord error');
      }
    }

    return true;
  }

  /**
   * Clears all call records for a user.
   */
  async clearUserCalls(userId: string): Promise<boolean> {
    for (const [id, call] of this.memoryCalls.entries()) {
      if (call.callerId === userId || call.receiverId === userId) {
        this.memoryCalls.delete(id);
      }
    }

    if (this.supabase) {
      try {
        await this.supabase
          .from('calls')
          .delete()
          .or(`caller_id.eq.${userId},receiver_id.eq.${userId}`);
      } catch (err) {
        logger.warn({ err, userId }, 'Supabase clearUserCalls error');
      }
    }

    return true;
  }

  /**
   * Maps raw snake_case database row to canonical CallRecord entity.
   */
  private mapDbCallToEntity(row: Record<string, unknown>): CallRecord {
    return {
      id: String(row.id),
      callerId: String(row.caller_id),
      callerUsername: String(row.caller_username),
      callerDisplayName: String(row.caller_display_name),
      callerAvatarUrl: row.caller_avatar_url ? String(row.caller_avatar_url) : undefined,
      receiverId: String(row.receiver_id),
      receiverUsername: String(row.receiver_username),
      receiverDisplayName: String(row.receiver_display_name),
      receiverAvatarUrl: row.receiver_avatar_url ? String(row.receiver_avatar_url) : undefined,
      type: row.type as CallRecord['type'],
      status: row.status as CallRecord['status'],
      startedAt: String(row.started_at),
      answeredAt: row.answered_at ? String(row.answered_at) : undefined,
      endedAt: row.ended_at ? String(row.ended_at) : undefined,
      durationSeconds: Number(row.duration_seconds || 0),
    };
  }

  /**
   * Maps raw snake_case database row to canonical User entity.
   */
  private mapDbUserToEntity(row: Record<string, unknown>): User {
    return {
      id: String(row.id),
      firebaseUid: String(row.firebase_uid),
      email: String(row.email),
      username: String(row.username),
      displayName: String(row.display_name),
      avatarUrl: row.avatar_url ? String(row.avatar_url) : null,
      bio: row.bio ? String(row.bio) : null,
      presenceStatus: (row.presence_status as UserPresenceStatus) || 'offline',
      lastSeen: row.last_seen ? String(row.last_seen) : null,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }
}

export const db = new DatabaseService();
