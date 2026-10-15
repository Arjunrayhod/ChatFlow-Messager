/**
 * @file Status and Stories types for ChatFlow.
 * Supports WhatsApp-style ephemeral statuses (Photos, Videos, Text)
 * with 24-hour expiration, viewer tracking, and Snapchat-style screenshot alerts.
 * 
 * Strict compliance with RULE 0.1: ZERO phone numbers.
 * 
 * [HINGLISH GUIDE]:
 * Yeh Status / Stories ke TypeScript types hain:
 * 1. StatusMediaType: 'text', 'image', 'video'
 * 2. StatusItem: Ek single story jo 24 ghante baad expire ho jayegi.
 * 3. StatusViewer: Jis user ne status dekha hai (aur kya usne screenshot liya hai!).
 * 4. UserStoryGroup: Ek user ke sabhi active unexpired statuses ka group (tray me dikhane ke liye).
 */

import { UserProfile } from './user';

/** Supported status media types. */
export type StatusMediaType = 'text' | 'image' | 'video';

/** Viewer entry tracking who viewed a status and if they screenshotted. */
export interface StatusViewer {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  viewedAt: string;
  hasScreenshotted?: boolean;
  screenshottedAt?: string | null;
}

/** Individual status / story entity. */
export interface StatusItem {
  id: string;
  userId: string;
  user?: UserProfile;
  mediaUrl?: string | null;
  mediaType: StatusMediaType;
  caption?: string | null;
  backgroundColor?: string | null;
  durationSeconds: number;
  createdAt: string;
  expiresAt: string;
  viewersCount: number;
  hasViewed?: boolean;
  isOwn?: boolean;
  viewers?: StatusViewer[];
}

/** Grouped stories for a user in the stories tray. */
export interface UserStoryGroup {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  hasUnseen: boolean;
  lastUpdated: string;
  stories: StatusItem[];
}

/** DTO for publishing a new status update. */
export interface CreateStatusDto {
  mediaType: StatusMediaType;
  mediaUrl?: string | null;
  caption?: string | null;
  backgroundColor?: string | null;
  durationSeconds?: number;
}

/** Payload when screenshot is detected. */
export interface ScreenshotAlertPayload {
  targetType: 'status' | 'chat';
  targetId: string;
  ownerId: string;
  takerUserId: string;
  takerUsername: string;
  takerDisplayName: string;
  timestamp: string;
}
