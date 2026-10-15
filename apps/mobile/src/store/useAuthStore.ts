/**
 * @file Zustand state store for User Authentication and Profile Onboarding.
 * Enforces RULE 0.1: Identity strictly anchored to Firebase UID + @username.
 */

import { create } from 'zustand';
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

  signInWithGoogle: (email?: string, uid?: string) => Promise<boolean>;
  checkUsername: (username: string) => Promise<CheckUsernameResponse>;
  onboardUser: (dto: CreateUserDto) => Promise<boolean>;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isOnboarded: false,
  isLoading: false,
  error: null,

  /**
   * Performs Google authentication and synchronizes user session.
   * Prompts real Google Account picker on Web / Mobile.
   */
  signInWithGoogle: async (fallbackEmail?: string, fallbackUid?: string) => {
    set({ isLoading: true, error: null });

    try {
      let token: string;

      if (isFirebaseConfigured() && !fallbackUid) {
        // [HINGLISH]: Real Google Sign-In popup with personal @gmail.com account
        const { idToken } = await signInWithGoogleReal();
        token = idToken;
      } else if (fallbackEmail && fallbackUid) {
        token = `dev_token_${fallbackUid}:${fallbackEmail}`;
      } else {
        throw new Error(
          'Firebase API Key required in .env for live Google Sign-In. Set EXPO_PUBLIC_FIREBASE_API_KEY from console.firebase.google.com.'
        );
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
}));
