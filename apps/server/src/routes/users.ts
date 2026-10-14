/**
 * @file User management and onboarding API routes.
 * Enforces RULE 0.1: No phone numbers collected, stored, or processed.
 * Enforces RULE 0.5: Standardized { ok, data/error } response envelope.
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
  displayName: z.string().trim().min(1).max(50).optional(),
  bio: z.string().trim().max(140).optional(),
  avatarUrl: z.string().trim().optional(),
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
        'Invalid profile update data',
        parseResult.error.flatten()
      )
    );
    return;
  }

  const updated = await db.updateUser(user.id, parseResult.data);
  res.status(200).json(createSuccessResponse(updated));
});
