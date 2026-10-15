/**
 * @file Firebase Client SDK initialization for Real Google Authentication.
 * Enforces RULE 0.1: No phone numbers collected, stored, or processed.
 * 
 * [HINGLISH GUIDE]:
 * Yeh Real Firebase Client initialization hai:
 * 1. GoogleAuthProvider se real Google Login popup kholta hai.
 * 2. User apna personal @gmail.com account choose karta hai.
 * 3. Real Firebase ID Token aur Google profile (@gmail.com, displayName, photoURL) backend ko sync karta hai.
 */

import { initializeApp, getApps, getApp } from '@firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  User as FirebaseUser,
} from '@firebase/auth';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '',
};

export const isFirebaseConfigured = (): boolean => {
  const key = process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '';
  return Boolean(
    key &&
    !key.includes('FakeKey') &&
    !key.includes('your-api-key') &&
    key.length > 10
  );
};

export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

/**
 * Triggers official Google Sign-In popup.
 * Returns authenticated Firebase user with real @gmail.com email.
 */
export async function signInWithGoogleReal(): Promise<{
  user: FirebaseUser;
  idToken: string;
}> {
  const result = await signInWithPopup(auth, googleProvider);
  const idToken = await result.user.getIdToken();
  return {
    user: result.user,
    idToken,
  };
}

/**
 * Signs out from Firebase Client Auth.
 */
export async function signOutFromFirebase(): Promise<void> {
  try {
    await firebaseSignOut(auth);
  } catch {
    // Ignore signout cleanup errors
  }
}
