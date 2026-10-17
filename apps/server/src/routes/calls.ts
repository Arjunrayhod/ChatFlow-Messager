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
import { createHmac } from 'crypto';
import {
  createSuccessResponse,
  createErrorResponse,
} from '@chatflow/shared';
import { requireAuth } from '../middlewares/auth';
import { db } from '../services/db';
import { env } from '../config/env';

export const callsRouter: Router = Router();

/** Short-lived Coturn REST credentials, scoped to the authenticated user. */
callsRouter.get('/ice-servers', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const iceServers: Array<{ urls: string | string[]; username?: string; credential?: string }> = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ];

  if (env.TURN_HOST && env.TURN_SHARED_SECRET) {
    const expiry = Math.floor(Date.now() / 1000) + env.TURN_TTL_SECONDS;
    const username = `${expiry}:${req.uid}`;
    const credential = createHmac('sha1', env.TURN_SHARED_SECRET).update(username).digest('base64');
    const host = env.TURN_HOST.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const urls = [
      `turn:${host}:${env.TURN_UDP_PORT}?transport=udp`,
      `turn:${host}:${env.TURN_TCP_PORT}?transport=tcp`,
    ];
    // Only advertise TURNS when a TLS listener with a valid certificate is deployed.
    if (env.TURN_TLS_ENABLED) urls.push(`turns:${host}:${env.TURNS_PORT}?transport=tcp`);
    iceServers.push({
      urls,
      username,
      credential,
    });
  }

  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json(createSuccessResponse({ iceServers, relayConfigured: Boolean(env.TURN_HOST && env.TURN_SHARED_SECRET) }));
});

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

/** Fetches a short-lived incoming offer after the user taps a call notification. */
callsRouter.get('/:id/offer', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = await db.findUserByFirebaseUid(req.uid);
  if (!user) {
    res.status(404).json(createErrorResponse('NOT_FOUND', 'User profile not found'));
    return;
  }
  const callId = req.params.id;
  if (!callId) {
    res.status(400).json(createErrorResponse('VALIDATION_FAILED', 'Call ID is required'));
    return;
  }
  const pending = await db.getPendingCallOffer(callId, user.id);
  if (!pending) {
    res.status(404).json(createErrorResponse('NOT_FOUND', 'This call is no longer ringing'));
    return;
  }
  res.status(200).json(createSuccessResponse({
    callId: pending.call.id,
    caller: {
      id: pending.call.callerId,
      username: pending.call.callerUsername,
      displayName: pending.call.callerDisplayName,
      avatarUrl: pending.call.callerAvatarUrl,
    },
    type: pending.call.type,
    sdp: pending.sdp,
  }));
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
