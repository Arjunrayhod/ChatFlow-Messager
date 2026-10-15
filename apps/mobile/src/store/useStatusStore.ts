/**
 * @file Zustand store for WhatsApp-style 24-hour Statuses & Stories.
 * Manages own stories, contacts' stories, viewing state, and Snapchat screenshot alerts.
 * 
 * Strict compliance with RULE 0.1 (Zero phone numbers).
 * 
 * [HINGLISH GUIDE]:
 * Yeh Status / Stories ka Zustand Global Store hai:
 * 1. myStories: User ke apne active 24h statuses
 * 2. contactStories: Dosto ke statuses (unseen/seen rings ke sath)
 * 3. viewStory: Story dekhte hi view count update karta hai
 * 4. triggerScreenshotAlert: Snapchat jaisa real-time screenshot alert trigger karta hai!
 */

import { create } from 'zustand';
import { StatusItem, UserStoryGroup } from '@chatflow/shared';
import * as api from '../services/api';
import { getSocket } from '../services/socket';

export interface ScreenshotAlertNotice {
  targetType: 'status' | 'chat';
  targetId: string;
  takerUserId: string;
  takerUsername: string;
  takerDisplayName: string;
  timestamp: string;
}

export interface StatusState {
  myStories: StatusItem[];
  contactStories: UserStoryGroup[];
  isLoadingFeed: boolean;
  isPublishing: boolean;
  activeScreenshotNotice: ScreenshotAlertNotice | null;

  // Actions
  fetchFeed: (token: string) => Promise<void>;
  createTextStory: (
    token: string,
    content: string,
    backgroundColor: string
  ) => Promise<boolean>;
  uploadMediaStory: (
    token: string,
    payload: api.UploadStatusMediaPayload
  ) => Promise<boolean>;
  markStoryViewed: (
    token: string,
    statusId: string,
    hasScreenshotted?: boolean
  ) => Promise<void>;
  deleteStory: (token: string, statusId: string) => Promise<boolean>;
  reportScreenshot: (
    token: string,
    statusId: string,
    ownerId: string,
    takerUserId: string,
    takerUsername: string,
    takerDisplayName: string
  ) => Promise<void>;
  setScreenshotNotice: (notice: ScreenshotAlertNotice | null) => void;
}

export const useStatusStore = create<StatusState>((set, get) => ({
  myStories: [],
  contactStories: [],
  isLoadingFeed: false,
  isPublishing: false,
  activeScreenshotNotice: null,

  fetchFeed: async (token: string) => {
    set({ isLoadingFeed: true });
    try {
      const res = await api.fetchStatusFeed(token);
      if (res.ok && res.data) {
        set({
          myStories: res.data.myStories,
          contactStories: res.data.contactStories,
          isLoadingFeed: false,
        });
      } else {
        set({ isLoadingFeed: false });
      }
    } catch {
      set({ isLoadingFeed: false });
    }
  },

  createTextStory: async (token: string, content: string, backgroundColor: string) => {
    set({ isPublishing: true });
    try {
      const res = await api.createTextStatus(token, {
        mediaType: 'text',
        caption: content,
        backgroundColor,
        durationSeconds: 6,
      });

      if (res.ok && res.data) {
        set((state) => ({
          myStories: [...state.myStories, res.data],
          isPublishing: false,
        }));

        // Broadcast to contacts via socket
        const socket = getSocket();
        if (socket?.connected) {
          socket.emit('status_published', {
            statusId: res.data.id,
            userId: res.data.userId,
          });
        }
        return true;
      }
      set({ isPublishing: false });
      return false;
    } catch {
      set({ isPublishing: false });
      return false;
    }
  },

  uploadMediaStory: async (token: string, payload: api.UploadStatusMediaPayload) => {
    set({ isPublishing: true });
    try {
      const res = await api.uploadStatusMedia(token, payload);
      if (res.ok && res.data) {
        set((state) => ({
          myStories: [...state.myStories, res.data],
          isPublishing: false,
        }));

        const socket = getSocket();
        if (socket?.connected) {
          socket.emit('status_published', {
            statusId: res.data.id,
            userId: res.data.userId,
          });
        }
        return true;
      }
      set({ isPublishing: false });
      return false;
    } catch {
      set({ isPublishing: false });
      return false;
    }
  },

  markStoryViewed: async (token: string, statusId: string, hasScreenshotted = false) => {
    // Optimistically update local contact stories
    set((state) => ({
      contactStories: state.contactStories.map((group) => {
        const updatedStories = group.stories.map((s) =>
          s.id === statusId ? { ...s, hasViewed: true } : s
        );
        const hasUnseen = updatedStories.some((s) => !s.hasViewed);
        return {
          ...group,
          stories: updatedStories,
          hasUnseen,
        };
      }),
    }));

    try {
      await api.recordStatusView(token, statusId, hasScreenshotted);
    } catch {
      // ignore
    }
  },

  deleteStory: async (token: string, statusId: string) => {
    try {
      const res = await api.deleteStatus(token, statusId);
      if (res.ok) {
        set((state) => ({
          myStories: state.myStories.filter((s) => s.id !== statusId),
        }));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  reportScreenshot: async (
    token: string,
    statusId: string,
    ownerId: string,
    takerUserId: string,
    takerUsername: string,
    takerDisplayName: string
  ) => {
    // 1. Send via REST endpoint
    void api.reportScreenshotAlert(token, statusId);

    // 2. Emit real-time socket event
    const socket = getSocket();
    if (socket?.connected) {
      socket.emit('screenshot_alert', {
        targetType: 'status',
        targetId: statusId,
        ownerId,
        takerUserId,
        takerUsername,
        takerDisplayName,
      });
    }

    // 3. If viewer is looking at own status, update local view list
    const notice: ScreenshotAlertNotice = {
      targetType: 'status',
      targetId: statusId,
      takerUserId,
      takerUsername,
      takerDisplayName,
      timestamp: new Date().toISOString(),
    };
    get().setScreenshotNotice(notice);
  },

  setScreenshotNotice: (notice) => {
    set({ activeScreenshotNotice: notice });
    if (notice) {
      // Auto dismiss after 6 seconds
      setTimeout(() => {
        set({ activeScreenshotNotice: null });
      }, 6000);
    }
  },
}));
