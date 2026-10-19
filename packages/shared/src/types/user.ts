/**
 * @file User entity and profile types for ChatFlow.
 * Enforces RULE 0.1: Identity strictly via Firebase UID and @username.
 */

/** User presence state. */
export type UserPresenceStatus = 'online' | 'offline' | 'away';

/** Canonical User entity. */
export interface User {
  id: string;
  firebaseUid: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  presenceStatus: UserPresenceStatus;
  lastSeen: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Publicly viewable user profile for discovery and chat header. */
export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  presenceStatus: UserPresenceStatus;
  lastSeen: string | null;
}

/** Payload for initial profile onboarding after Google Sign-in. */
export interface CreateUserDto {
  username: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
}

/** Payload for updating user profile. */
export interface UpdateUserDto {
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
}

/** Contact relationship item. */
export interface Contact {
  id: string;
  ownerId: string;
  contactUserId: string;
  nickname: string | null;
  createdAt: string;
  user: UserProfile;
  lastMessage?: string | null;
  lastMessageTimestamp?: string | null;
  unreadCount?: number;
}

/** Response payload for user synchronization with Firebase auth. */
export interface SyncUserResponse {
  user: User | null;
  isOnboarded: boolean;
}

/** Response payload for username availability verification. */
export interface CheckUsernameResponse {
  username: string;
  available: boolean;
  reason?: string;
}

/** Payload for adding a contact by their unique @username. */
export interface AddContactDto {
  username: string;
  nickname?: string;
}

/** Result of contact removal. */
export interface RemoveContactResponse {
  removed: boolean;
  contactUserId: string;
}


