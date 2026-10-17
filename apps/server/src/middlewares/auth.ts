/**
 * @file Firebase Authentication verification middleware.
 * Enforces RULE 0.6: Firebase ID token required on authenticated routes.
 * 
 * [HINGLISH GUIDE]:
 * Yeh authentication middleware hai.
 * Protected routes (jaise /api/users/me ya /api/contacts) par user verify karta hai.
 * Dev mode me ye bina real Firebase key ke bhi 'dev_token_' accept kar leta hai
 * taaki testing aasan rahe.
 */

import { Request, Response, NextFunction } from 'express';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { createErrorResponse } from '@chatflow/shared';
import { env } from '../config/env';
import { logger } from '../utils/logger';

declare global {
  namespace Express {
    interface Request {
      uid: string;
      userEmail: string;
    }
  }
}

let firebaseInitialized = false;

// [HINGLISH]: Agar .env me real Firebase keys hain to Admin SDK initialize karo,
// warna local development mode me run karo (no crash).
// Initialize Firebase Admin if valid credentials are provided
if (
  env.FIREBASE_PROJECT_ID &&
  env.FIREBASE_CLIENT_EMAIL &&
  env.FIREBASE_PRIVATE_KEY &&
  !env.FIREBASE_PRIVATE_KEY.includes('FakeKey') &&
  !env.FIREBASE_PRIVATE_KEY.includes('MIIEvgIBADANBg...==')
) {
  try {
    if (getApps().length === 0) {
      initializeApp({
        credential: cert({
          projectId: env.FIREBASE_PROJECT_ID,
          clientEmail: env.FIREBASE_CLIENT_EMAIL,
          privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
    }
    firebaseInitialized = true;
    logger.info('Firebase Admin SDK initialized successfully.');
  } catch (err) {
    logger.warn({ err }, 'Failed to initialize Firebase Admin SDK; running in dev-tolerant mode.');
  }
} else {
  logger.info('Firebase Admin SDK running in development mode.');
}

/**
 * Middleware that validates the Firebase Bearer token and binds req.uid.
 * [HINGLISH]: Header se 'Bearer <token>' nikalta hai aur user verify karta hai.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json(
      createErrorResponse(
        'AUTH_REQUIRED',
        'Authorization Bearer token is required'
      )
    );
    return;
  }

  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token) {
    res.status(401).json(
      createErrorResponse(
        'AUTH_REQUIRED',
        'Malformed Bearer token provided'
      )
    );
    return;
  }

  try {
    const identity = await verifyAuthToken(token);
    if (identity) {
      req.uid = identity.uid;
      req.userEmail = identity.email;
      next();
      return;
    }
  } catch (err) {
    logger.warn({ err }, 'Authentication token verification failed');
  }

  res.status(401).json(
    createErrorResponse(
      'AUTH_REQUIRED',
      'Invalid or expired Google authentication token'
    )
  );
}

/** Verifies an authentication token and returns its trusted identity. */
export async function verifyAuthToken(
  token: string
): Promise<{ uid: string; email: string } | null> {
  if (firebaseInitialized) {
    try {
      const decodedToken = await getAuth().verifyIdToken(token);
      return { uid: decodedToken.uid, email: decodedToken.email || '' };
    } catch {
      // Let the Google ID-token verifier handle Google OAuth tokens below.
    }
  }

  if (token.length > 50 && !token.startsWith('dev_token_')) {
    try {
      const googleRes = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`
      );
      if (googleRes.ok) {
        const payload = (await googleRes.json()) as { sub?: string; email?: string };
        if (payload.sub && payload.email) {
          return { uid: payload.sub, email: payload.email };
        }
      }
    } catch (err) {
      logger.warn({ err }, 'Google token verification request failed');
    }
  }

  if (env.NODE_ENV !== 'production' && token.startsWith('dev_token_')) {
    const parts = token.replace('dev_token_', '').split(':');
    return {
      uid: parts[0] || 'dev_user_123',
      email: parts[1] || 'dev.user@gmail.com',
    };
  }

  return null;
}
