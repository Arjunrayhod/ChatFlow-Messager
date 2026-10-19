/**
 * @file User management and onboarding API routes.
 * Enforces RULE 0.1: No phone numbers collected, stored, or processed.
 * Enforces RULE 0.5: Standardized { ok, data/error } response envelope.
 * 
 * [HINGLISH GUIDE]:
 * Is file me user se jude sabhi routes hain:
 * 1. GET /search -> @username ya display name se users search karta hai (contacts add karne ke liye)
 * 2. GET /check-username -> Live typing par check karta hai ki @username already taken hai ya available
 * 3. POST /sync -> Login ke baad check karta hai ki user pehle se onboarded hai ya new user hai
 * 4. POST /onboard -> New user ka profile create karta hai (@username, displayName, bio)
 * 5. GET /me -> Logged-in user ki profile fetch karta hai
 * 6. PATCH /me -> Profile update karne ke liye (bio, avatar, displayName)
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  createSuccessResponse,
  createErrorResponse,
  SyncUserResponse,
  CheckUsernameResponse,
} from '@chatflow/shared';
import { requireAuth } from '../middlewares/auth';
import { db } from '../services/db';

export const usersRouter: Router = Router();

// Validation Schemas
const usernameQuerySchema = z.object({
  username: z
    .string()
    .trim()
    .transform((val) => val.replace(/^@/, ''))
    .refine((val) => /^[a-zA-Z0-9_]{3,20}$/.test(val), {
      message: 'Username must be 3-20 characters and contain only letters, numbers, and underscores',
    }),
});

const onboardSchema = z.object({
  username: z
    .string()
    .trim()
    .transform((val) => val.replace(/^@/, ''))
    .refine((val) => /^[a-zA-Z0-9_]{3,20}$/.test(val), {
      message: 'Username must be 3-20 characters and contain only letters, numbers, and underscores',
    }),
  displayName: z.string().trim().min(1, 'Display name is required').max(50),
  bio: z.string().trim().max(140).optional(),
  avatarUrl: z.string().trim().optional(),
});

const updateProfileSchema = z.object({
  username: z
    .string()
    .trim()
    .transform((val) => val.replace(/^@/, ''))
    .refine((val) => /^[a-zA-Z0-9_]{3,20}$/.test(val), {
      message: 'Username must be 3-20 characters and contain only letters, numbers, and underscores',
    })
    .optional(),
  displayName: z.string().trim().min(1).max(50).optional(),
  bio: z.string().trim().max(140).optional(),
  avatarUrl: z.string().trim().optional(),
});

const searchQuerySchema = z.object({
  q: z.string().trim().min(1, 'Search query is required').max(50),
});

const pushTokenSchema = z.object({
  token: z.string().trim().min(20).max(512).regex(/^(Exponent|Expo)PushToken\[[^\]]+\]$/),
  platform: z.enum(['ios', 'android']),
});

usersRouter.put('/push-token', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const parsed = pushTokenSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(createErrorResponse('VALIDATION_FAILED', 'Invalid Expo push token'));
    return;
  }
  const user = await db.findUserByFirebaseUid(req.uid);
  if (!user) {
    res.status(404).json(createErrorResponse('NOT_FOUND', 'User profile not found. Complete onboarding first.'));
    return;
  }
  try {
    await db.savePushToken(user.id, parsed.data.token, parsed.data.platform);
    res.status(200).json(createSuccessResponse({ registered: true }));
  } catch {
    res.status(500).json(createErrorResponse('INTERNAL_ERROR', 'Could not register push notifications'));
  }
});

usersRouter.delete('/push-token', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const parsed = z.object({ token: pushTokenSchema.shape.token }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(createErrorResponse('VALIDATION_FAILED', 'Invalid Expo push token'));
    return;
  }
  const user = await db.findUserByFirebaseUid(req.uid);
  if (!user) {
    res.status(404).json(createErrorResponse('NOT_FOUND', 'User profile not found'));
    return;
  }
  await db.removePushToken(parsed.data.token, user.id);
  res.status(200).json(createSuccessResponse({ removed: true }));
});

/**
 * GET /api/users/search?q=...
 * Search users by unique @username or display name.
 * Enforces RULE 0.1: No phone numbers involved or exposed.
 */
usersRouter.get('/search', async (req: Request, res: Response): Promise<void> => {
  const parseResult = searchQuerySchema.safeParse(req.query);
  if (!parseResult.success) {
    res.status(200).json(createSuccessResponse([]));
    return;
  }

  const { q } = parseResult.data;
  const currentUserId = req.uid || undefined;
  const results = await db.searchUsers(q, currentUserId);

  res.status(200).json(createSuccessResponse(results));
});

/**
 * GET /api/users/check-username?username=...
 * Public validation endpoint for live onboarding check.
 */
usersRouter.get('/check-username', async (req: Request, res: Response): Promise<void> => {
  const parseResult = usernameQuerySchema.safeParse(req.query);

  if (!parseResult.success) {
    const rawUsername = String(req.query.username || '');
    const payload: CheckUsernameResponse = {
      username: rawUsername,
      available: false,
      reason: parseResult.error.issues[0]?.message || 'Invalid username format',
    };
    res.status(200).json(createSuccessResponse(payload));
    return;
  }

  const { username } = parseResult.data;
  const available = await db.isUsernameAvailable(username);

  const payload: CheckUsernameResponse = {
    username,
    available,
    reason: available ? undefined : 'Username is already taken',
  };

  res.status(200).json(createSuccessResponse(payload));
});

/**
 * POST /api/users/sync
 * Verifies Firebase session and checks if onboarding profile exists.
 */
usersRouter.post('/sync', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const existingUser = await db.findUserByFirebaseUid(req.uid);

  const payload: SyncUserResponse = {
    user: existingUser,
    isOnboarded: !!existingUser && !!existingUser.username,
  };

  res.status(200).json(createSuccessResponse(payload));
});

/**
 * POST /api/users/onboard
 * Complete user profile setup with unique @username.
 */
usersRouter.post('/onboard', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const parseResult = onboardSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json(
      createErrorResponse(
        'VALIDATION_FAILED',
        parseResult.error.issues[0]?.message || 'Invalid onboarding data',
        parseResult.error.flatten()
      )
    );
    return;
  }

  const { username, displayName, bio, avatarUrl } = parseResult.data;

  // Check username availability
  const isAvailable = await db.isUsernameAvailable(username);
  if (!isAvailable) {
    res.status(409).json(
      createErrorResponse(
        'CONFLICT',
        `Username @${username} is already taken. Please choose another.`
      )
    );
    return;
  }

  const existingUser = await db.findUserByFirebaseUid(req.uid);

  if (existingUser) {
    // Update existing user with chosen username
    const updated = await db.updateUser(existingUser.id, {
      username,
      displayName,
      bio: bio || existingUser.bio,
      avatarUrl: avatarUrl || existingUser.avatarUrl,
    });
    res.status(200).json(createSuccessResponse(updated));
    return;
  }

  // Create new user profile anchored strictly to Firebase UID + email (NO PHONE)
  const created = await db.createUser({
    firebaseUid: req.uid,
    email: req.userEmail,
    username,
    displayName,
    bio,
    avatarUrl,
  });

  res.status(201).json(createSuccessResponse(created));
});

/**
 * GET /api/users/me
 * Retrieves currently logged-in user profile.
 */
usersRouter.get('/me', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = await db.findUserByFirebaseUid(req.uid);
  if (!user) {
    res.status(404).json(
      createErrorResponse(
        'NOT_FOUND',
        'User profile has not been created yet'
      )
    );
    return;
  }

  res.status(200).json(createSuccessResponse(user));
});

/**
 * PATCH /api/users/me
 * Updates editable profile attributes.
 */
usersRouter.patch('/me', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = await db.findUserByFirebaseUid(req.uid);
  if (!user) {
    res.status(404).json(
      createErrorResponse(
        'NOT_FOUND',
        'User profile not found'
      )
    );
    return;
  }

  const parseResult = updateProfileSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json(
      createErrorResponse(
        'VALIDATION_FAILED',
        parseResult.error.issues[0]?.message || 'Invalid profile update data',
        parseResult.error.flatten()
      )
    );
    return;
  }

  const { username, ...otherUpdates } = parseResult.data;

  if (username && username.toLowerCase() !== user.username.toLowerCase()) {
    const isAvailable = await db.isUsernameAvailable(username);
    if (!isAvailable) {
      res.status(409).json(
        createErrorResponse(
          'CONFLICT',
          `Username @${username} is already taken. Please choose another.`
        )
      );
      return;
    }
  }

  const updated = await db.updateUser(user.id, {
    ...otherUpdates,
    ...(username ? { username } : {}),
  });

  res.status(200).json(createSuccessResponse(updated));
});
