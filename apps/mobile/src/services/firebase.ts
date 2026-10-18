/**
 * @file Firebase & Google Authentication Service.
 * Enforces RULE 0.1: Identity strictly anchored to Google UID + @username (NO phone numbers).
 * 
 * [HINGLISH GUIDE]:
 * Yeh Google Authentication Client Service hai:
 * 1. Web aur mobile dono par bina Metro bundler crash kiye Google authentication support karta hai.
 * 2. User apna personal @gmail.com account choose karke login karta hai.
 * 3. Token verify ho kar backend se sync hota hai.
 */

import { initializeApp, getApps } from '@firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
  signOut,
} from '@firebase/auth';
import { Platform } from 'react-native';

export interface GoogleAuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

const getConfiguredAuth = () => {
  const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '';
  const authDomain = process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || '';
  const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || '';
  if (!apiKey || !authDomain || !projectId) {
    throw new Error('Firebase web configuration is missing.');
  }

  const app = getApps()[0] ?? initializeApp({ apiKey, authDomain, projectId });
  return getAuth(app);
};

export const isFirebaseConfigured = (): boolean => {
  const key = process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '';
  const authDomain = process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || '';
  const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || '';
  return Boolean(
    key &&
    !key.includes('FakeKey') &&
    !key.includes('your-api-key') &&
    key.length > 10 &&
    authDomain &&
    projectId
  );
};

/**
 * Uses the browser popup on web and the native Google account picker in Android/iOS builds.
 */
export async function signInWithGoogleReal(gmailAddress?: string): Promise<{
  user: GoogleAuthUser;
  idToken: string;
}> {
  let user: GoogleAuthUser;
  let idToken: string;

  if (Platform.OS === 'web') {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: 'select_account',
      ...(gmailAddress ? { login_hint: gmailAddress.trim() } : {}),
    });
    const result = await signInWithPopup(getConfiguredAuth(), provider);
    user = {
      uid: result.user.uid,
      email: result.user.email,
      displayName: result.user.displayName,
      photoURL: result.user.photoURL,
    };
    idToken = await result.user.getIdToken();
  } else {
    const webClientId = process.env.EXPO_PUBLIC_FIREBASE_WEB_CLIENT_ID || '';
    if (!webClientId.endsWith('.apps.googleusercontent.com')) {
      throw new Error('Google Sign-In configuration is missing. Rebuild the APK after updating its Firebase config.');
    }

    // Load only on native so the web bundle never initializes the native module.
    const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
    GoogleSignin.configure({ webClientId });
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response: any = await GoogleSignin.signIn();
    if (response?.type === 'cancelled') {
      throw new Error('Google sign-in was cancelled. Please try again.');
    }
    const account = response?.data ?? response;
    const googleIdToken = account?.idToken;
    if (!googleIdToken || !account?.user?.id) {
      throw new Error('Google did not return an ID token. Check the Firebase Android SHA-1 and try again.');
    }

    const credential = GoogleAuthProvider.credential(googleIdToken);
    const result = await signInWithCredential(getConfiguredAuth(), credential);
    user = {
      uid: result.user.uid,
      email: result.user.email || account.user.email || null,
      displayName: result.user.displayName || account.user.name || null,
      photoURL: result.user.photoURL || account.user.photo || null,
    };
    idToken = await result.user.getIdToken();
  }

  const email = user.email?.trim().toLowerCase() || null;
  if (!email || (!email.endsWith('@gmail.com') && !email.endsWith('@googlemail.com'))) {
    throw new Error('Please use a personal Gmail account to continue.');
  }
  if (gmailAddress && email !== gmailAddress.trim().toLowerCase()) {
    throw new Error('Choose the same Gmail address you entered.');
  }

  return {
    user: {
      uid: user.uid,
      email,
      displayName: user.displayName,
      photoURL: user.photoURL,
    },
    idToken,
  };
}

/**
 * Signs out from client session.
 */
export async function signOutFromFirebase(): Promise<void> {
  if (Platform.OS !== 'web') {
    try {
      const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
      await GoogleSignin.signOut();
    } catch {
      // Continue clearing the Firebase session even if Google sign-out is unavailable.
    }
  }

  const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '';
  if (apiKey) await signOut(getConfiguredAuth());
}

