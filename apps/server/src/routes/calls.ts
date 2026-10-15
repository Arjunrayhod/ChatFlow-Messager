/**
 * @file Call history management API routes for ChatFlow (Phase 5).
 * Enforces RULE 0.1: No phone numbers stored, transmitted, or logged.
 * Enforces RULE 0.5: Consistent { ok, data/error } response format.
 * 
 * [HINGLISH GUIDE]:
 * Yeh file user ke voice aur video call logs ko manage karti hai:
 * 1. GET /api/calls -> Login user ke sare incoming/outgoing/missed calls list karta hai
 * 2. DELETE /api/calls/:id -> Kisi ek call record ko log se delete karta hai
 * 3. DELETE /api/calls -> Puri call history ko clear karta hai
 */

import { Router, Request, Response } from 'express';
import {
  createSuccessResponse,
  createErrorResponse,
} from '@chatflow/shared';
import { requireAuth } from '../middlewares/auth';
import { db } from '../services/db';

export const callsRouter: Router = Router();

/**
 * GET /api/calls
 * Returns list of call records for the authenticated user.
 */
callsRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const currentUser = await db.findUserByFirebaseUid(req.uid);
    if (!currentUser) {
      res.status(404).json(
        createErrorResponse('NOT_FOUND', 'User profile not found. Please onboard first.')
      );
      return;
    }

    const calls = await db.getUserCalls(currentUser.id);
    res.status(200).json(createSuccessResponse(calls));
  } catch (err) {
    res.status(500).json(
      createErrorResponse('INTERNAL_ERROR', 'Failed to retrieve call logs')
    );
  }
});

/**
 * DELETE /api/calls/:id
 * Deletes a single call record.
 */
callsRouter.delete('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const currentUser = await db.findUserByFirebaseUid(req.uid);
    if (!currentUser) {
      res.status(404).json(
        createErrorResponse('NOT_FOUND', 'User profile not found.')
      );
      return;
    }

    const id = req.params.id;
    if (!id) {
      res.status(400).json(createErrorResponse('VALIDATION_FAILED', 'Call ID is required'));
      return;
    }
    await db.deleteCallRecord(id, currentUser.id);
    res.status(200).json(createSuccessResponse({ success: true, deletedId: id }));
  } catch (err) {
    res.status(500).json(
      createErrorResponse('INTERNAL_ERROR', 'Failed to delete call record')
    );
  }
});

/**
 * DELETE /api/calls
 * Clears all call history for the authenticated user.
 */
callsRouter.delete('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const currentUser = await db.findUserByFirebaseUid(req.uid);
    if (!currentUser) {
      res.status(404).json(
        createErrorResponse('NOT_FOUND', 'User profile not found.')
      );
      return;
    }

    await db.clearUserCalls(currentUser.id);
    res.status(200).json(createSuccessResponse({ success: true, cleared: true }));
  } catch (err) {
    res.status(500).json(
      createErrorResponse('INTERNAL_ERROR', 'Failed to clear call history')
    );
  }
});
