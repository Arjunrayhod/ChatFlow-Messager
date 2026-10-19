/**
 * @file Contact management API routes for ChatFlow.
 * Enforces RULE 0.1: Contacts discovered strictly by @username, NEVER by phone numbers.
 * Enforces RULE 0.5: Consistent { ok, data/error } response format.
 * 
 * [HINGLISH GUIDE]:
 * Yeh file user ke saved contacts ko manage karti hai:
 * 1. GET /api/contacts -> Login user ke sare saved contacts list karta hai
 * 2. POST /api/contacts -> Kisi ko uske unique @username se contact list me add karta hai
 * 3. DELETE /api/contacts/:contactUserId -> Contact list se kisi ko remove karta hai
 * Note: ChatFlow me Phone Numbers ka koi concept nahi hai, sab @username se chalta hai.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  createSuccessResponse,
  createErrorResponse,
  RemoveContactResponse,
} from '@chatflow/shared';
import { requireAuth } from '../middlewares/auth';
import { db } from '../services/db';

export const contactsRouter: Router = Router();

const addContactSchema = z.object({
  username: z
    .string()
    .trim()
    .transform((val) => val.replace(/^@/, ''))
    .refine((val) => /^[a-zA-Z0-9_]{3,20}$/.test(val), {
      message: 'Valid username must be 3-20 characters',
    }),
  nickname: z.string().trim().max(50).optional(),
});

/**
 * GET /api/contacts
 * Returns list of saved contacts for the authenticated user.
 */
contactsRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const currentUser = await db.findUserByFirebaseUid(req.uid);
  if (!currentUser) {
    res.status(404).json(
      createErrorResponse('NOT_FOUND', 'User profile not found. Please onboard first.')
    );
    return;
  }

  const contacts = await db.getContacts(currentUser.id);
  res.status(200).json(createSuccessResponse(contacts));
});

/**
 * POST /api/contacts
 * Adds a new contact by their unique @username.
 */
contactsRouter.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const parseResult = addContactSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json(
      createErrorResponse(
        'VALIDATION_FAILED',
        parseResult.error.issues[0]?.message || 'Invalid contact payload',
        parseResult.error.flatten()
      )
    );
    return;
  }

  const { username, nickname } = parseResult.data;

  const currentUser = await db.findUserByFirebaseUid(req.uid);
  if (!currentUser) {
    res.status(404).json(
      createErrorResponse('NOT_FOUND', 'Current user profile not found')
    );
    return;
  }

  const targetUser = await db.findUserByUsername(username);
  if (!targetUser) {
    res.status(404).json(
      createErrorResponse(
        'NOT_FOUND',
        `No user found with username @${username}`
      )
    );
    return;
  }

  if (targetUser.id === currentUser.id) {
    res.status(400).json(
      createErrorResponse(
        'VALIDATION_FAILED',
        'You cannot add yourself to your own contact list'
      )
    );
    return;
  }

  const alreadyContact = await db.hasContact(currentUser.id, targetUser.id);
  if (alreadyContact) {
    const existingContacts = await db.getContacts(currentUser.id);
    const existing = existingContacts.find((c) => c.contactUserId === targetUser.id);
    if (existing) {
      res.status(200).json(createSuccessResponse(existing));
      return;
    }
    res.status(200).json(
      createSuccessResponse({
        id: `contact_${currentUser.id}_${targetUser.id}`,
        userId: currentUser.id,
        contactUserId: targetUser.id,
        nickname,
        user: {
          id: targetUser.id,
          username: targetUser.username,
          displayName: targetUser.displayName,
          avatarUrl: targetUser.avatarUrl,
          bio: targetUser.bio,
          presenceStatus: targetUser.presenceStatus,
          lastSeen: targetUser.lastSeen,
        },
        createdAt: new Date().toISOString(),
      })
    );
    return;
  }

  const newContact = await db.addContact(
    currentUser.id,
    {
      id: targetUser.id,
      username: targetUser.username,
      displayName: targetUser.displayName,
      avatarUrl: targetUser.avatarUrl,
      bio: targetUser.bio,
      presenceStatus: targetUser.presenceStatus,
      lastSeen: targetUser.lastSeen,
    },
    nickname
  );

  res.status(201).json(createSuccessResponse(newContact));
});

/**
 * DELETE /api/contacts/:contactUserId
 * Removes contact relationship.
 */
contactsRouter.delete(
  '/:contactUserId',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const { contactUserId } = req.params;
    if (!contactUserId) {
      res.status(400).json(
        createErrorResponse('VALIDATION_FAILED', 'contactUserId parameter is required')
      );
      return;
    }

    const currentUser = await db.findUserByFirebaseUid(req.uid);
    if (!currentUser) {
      res.status(404).json(
        createErrorResponse('NOT_FOUND', 'User profile not found')
      );
      return;
    }

    const removed = await db.removeContact(currentUser.id, contactUserId);

    const payload: RemoveContactResponse = {
      removed,
      contactUserId,
    };

    res.status(200).json(createSuccessResponse(payload));
  }
);
