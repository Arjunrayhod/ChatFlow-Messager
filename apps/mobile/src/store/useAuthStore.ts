/**
 * @file Zustand state store for User Authentication and Profile Onboarding.
 * Enforces RULE 0.1: Identity strictly anchored to Firebase UID + @username.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { User, CreateUserDto, CheckUsernameResponse } from '@chatflow/shared';
import {
  checkUsernameAvailability,
  syncUserSession,
  onboardUserProfile,
  getCurrentUserProfile,
} from '../services/api';
import { disconnectSocket } from '../services/socket';
import {
  signInWithGoogleReal,
  signOutFromFirebase,
  isFirebaseConfigured,
} from '../services/firebase';

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isOnboarded: boolean;
  isLoading: boolean;
  error: string | null;

  signInWithGoogle: (gmailAddress?: string, explicitUid?: string) => Promise<boolean>;
  checkUsername: (username: string) => Promise<CheckUsernameResponse>;
  onboardUser: (dto: CreateUserDto) => Promise<boolean>;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

// Cross-platform safe storage for web and native
const webSafeStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch {
      // Fallback
    }
    return null;
  },
  setItem: (key: string, value: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch {
      // Fallback
    }
  },
  removeItem: (key: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch {
      // Fallback
    }
  },
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isOnboarded: false,
      isLoading: false,
      error: null,

      /**
       * Performs Google authentication and synchronizes user session.
       * Strictly enforces real @gmail.com identity (RULE 0.1).
       */
      signInWithGoogle: async (gmailAddress?: string, explicitUid?: string) => {
        set({ isLoading: true, error: null });

        try {
          let token: string;

          if (isFirebaseConfigured()) {
            // [HINGLISH]: Live Firebase Google popup; optional email narrows account selection.
            const { idToken } = await signInWithGoogleReal(gmailAddress);
            token = idToken;
          } else if (gmailAddress) {
            const cleanEmail = gmailAddress.trim().toLowerCase();
            const isValidEmail = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(cleanEmail);
            if (!isValidEmail || (!cleanEmail.endsWith('@gmail.com') && !cleanEmail.endsWith('@googlemail.com'))) {
              throw new Error('Please enter a valid personal Gmail address (@gmail.com)');
            }
            const uid = explicitUid || `google_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`;
            token = `dev_token_${uid}:${cleanEmail}`;
          } else {
            throw new Error('Please enter your Gmail address to continue with Google');
          }

          const syncResult = await syncUserSession(token);

          if (syncResult.ok) {
            const { user, isOnboarded } = syncResult.data;
            set({
              token,
              user,
              isAuthenticated: true,
              isOnboarded,
              isLoading: false,
              error: null,
            });
            return true;
          } else {
            set({
              isLoading: false,
              error: syncResult.error.message,
            });
            return false;
          }
        } catch (err: any) {
          set({
            isLoading: false,
            error: err?.message || 'Google Sign-In failed',
          });
          return false;
        }
      },

  /**
   * Queries real-time availability of an @username.
   */
  checkUsername: async (username: string): Promise<CheckUsernameResponse> => {
    const result = await checkUsernameAvailability(username);
    if (result.ok) {
      return result.data;
    }
    return {
      username,
      available: false,
      reason: result.error.message,
    };
  },

  /**
   * Completes onboarding and sets up canonical @username.
   */
  onboardUser: async (dto: CreateUserDto): Promise<boolean> => {
    const { token } = get();
    if (!token) {
      set({ error: 'Authentication session expired' });
      return false;
    }

    set({ isLoading: true, error: null });
    const result = await onboardUserProfile(token, dto);

    if (result.ok) {
      set({
        user: result.data,
        isOnboarded: true,
        isLoading: false,
        error: null,
      });
      return true;
    } else {
      set({
        isLoading: false,
        error: result.error.message,
      });
      return false;
    }
  },

  /**
   * Fetches latest user profile data from server.
   */
  refreshProfile: async () => {
    const { token } = get();
    if (!token) return;

    const result = await getCurrentUserProfile(token);
    if (result.ok) {
      set({ user: result.data });
    }
  },

  /**
   * Clears active authentication session and profile data.
   */
  signOut: async () => {
    disconnectSocket();
    await signOutFromFirebase();
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      isOnboarded: false,
      error: null,
    });
  },
}),
    {
      name: 'chatflow_auth_session',
      storage: createJSONStorage(() => webSafeStorage),
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        isOnboarded: state.isOnboarded,
      }),
    }
  )
);

