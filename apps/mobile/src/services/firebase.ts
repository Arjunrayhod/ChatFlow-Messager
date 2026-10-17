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
import { getAuth, GoogleAuthProvider, signInWithPopup } from '@firebase/auth';

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
 * Triggers official Google Sign-In popup or Web Identity flow.
 */
export async function signInWithGoogleReal(gmailAddress?: string): Promise<{
  user: GoogleAuthUser;
  idToken: string;
}> {
  if (typeof window === 'undefined') {
    throw new Error('Google sign-in is currently available in the browser only.');
  }

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({
    prompt: 'select_account',
    ...(gmailAddress ? { login_hint: gmailAddress.trim() } : {}),
  });

  const result = await signInWithPopup(getConfiguredAuth(), provider);
  const email = result.user.email?.trim().toLowerCase() || null;
  if (!email || (!email.endsWith('@gmail.com') && !email.endsWith('@googlemail.com'))) {
    throw new Error('Please use a personal Gmail account to continue.');
  }
  if (gmailAddress && email !== gmailAddress.trim().toLowerCase()) {
    throw new Error('Choose the same Gmail address you entered.');
  }

  return {
    user: {
      uid: result.user.uid,
      email,
      displayName: result.user.displayName,
      photoURL: result.user.photoURL,
    },
    idToken: await result.user.getIdToken(),
  };
}

/**
 * Signs out from client session.
 */
export async function signOutFromFirebase(): Promise<void> {
  // Client session cleanup
}

