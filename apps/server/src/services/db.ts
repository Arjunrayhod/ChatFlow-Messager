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
import {
  User,
  UserPresenceStatus,
  Contact,
  UserProfile,
  ChatMessage,
  MessageType,
  MessageDeliveryStatus,
} from '@chatflow/shared';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export class DatabaseService {
  private supabase: SupabaseClient | null = null;
  // [HINGLISH]: Local development ke liye in-memory store
  // Fast memory repository for dev mode & offline resilience
  private memoryUsers: Map<string, User> = new Map();
  // In-memory messages store: chatId -> ChatMessage[]
  private memoryMessages: Map<string, ChatMessage[]> = new Map();

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
        await this.supabase.from('contacts').insert({
          user_id: ownerId,
          contact_user_id: targetUser.id,
          nickname: contact.nickname,
          created_at: contact.createdAt,
        });
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
    const message: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
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
    };

    if (this.supabase) {
      try {
        await this.supabase.from('messages').insert({
          id: message.id,
          chat_id: message.chatId,
          sender_id: message.senderId,
          type: message.type,
          content: message.content,
          media_url: message.mediaUrl,
          status: message.status,
          reply_to_id: message.replyToId,
          created_at: message.createdAt,
          updated_at: message.updatedAt,
        });
      } catch (err) {
        logger.warn({ err }, 'Supabase saveMessage exception');
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
  async getMessages(chatId: string, limit = 50): Promise<ChatMessage[]> {
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('messages')
          .select('*')
          .eq('chat_id', chatId)
          .order('created_at', { ascending: true })
          .limit(limit);

        if (!error && data) {
          return data.map((row: any) => ({
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
          }));
        }
      } catch (err) {
        logger.warn({ err }, 'Supabase getMessages exception');
      }
    }

    const messages = this.memoryMessages.get(chatId) || [];
    return messages.slice(-limit);
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
          .eq('id', messageId);
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
