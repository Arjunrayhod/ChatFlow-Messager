/**
 * @file Database service layer supporting Supabase Postgres and in-memory development store.
 * Enforces RULE 0.1: Strictly zero phone numbers in database entities.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { User, UserPresenceStatus } from '@chatflow/shared';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export class DatabaseService {
  private supabase: SupabaseClient | null = null;
  // Fast memory repository for dev mode & offline resilience
  private memoryUsers: Map<string, User> = new Map();

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
