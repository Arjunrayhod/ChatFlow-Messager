/**
 * @file Status and Stories API routes for ChatFlow.
 * Handles:
 * - Status media / text upload
 * - Feed fetching (own active stories + friends' active stories)
 * - View recording & Viewers list with timestamp
 * - Manual deletion before 24h
 * - Snapchat-style screenshot alerts
 * 
 * Strict compliance with RULE 0.1 (No phone numbers) and RULE 0.5 (API envelope).
 * 
 * [HINGLISH GUIDE]:
 * Yeh Status / Stories ke Express routes hain:
 * 1. POST /api/status/upload -> Photo / Video status upload (Original HD)
 * 2. POST /api/status/create -> Text status ya existing media status create karna
 * 3. GET /api/status/feed -> User ke apne + dosto ke active 24h statuses fetch karna
 * 4. POST /api/status/:id/view -> Status view count badhana (+ screenshot flag track karna)
 * 5. GET /api/status/:id/viewers -> Status kis kis ne dekha uski list dekhna
 * 6. DELETE /api/status/:id -> Apna status 24h se pehle manually delete karna
 * 7. POST /api/status/:id/screenshot-alert -> Snapchat-style alert trigger karna
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import {
  createSuccessResponse,
  createErrorResponse,
} from '@chatflow/shared';
import { requireAuth } from '../middlewares/auth';
import { db } from '../services/db';
import { logger } from '../utils/logger';

export const statusRouter: Router = Router();

// Ensure uploads directory exists
const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const createStatusSchema = z.object({
  mediaType: z.enum(['text', 'image', 'video']),
  mediaUrl: z.string().trim().optional().nullable(),
  caption: z.string().trim().max(1000).optional().nullable(),
  backgroundColor: z.string().trim().max(30).optional().nullable(),
  durationSeconds: z.number().min(2).max(60).optional(),
});

const uploadStatusSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(100),
  data: z.string().min(1, 'File payload required'),
  mediaType: z.enum(['image', 'video']),
  caption: z.string().trim().max(1000).optional().nullable(),
  backgroundColor: z.string().trim().optional().nullable(),
});

const viewStatusSchema = z.object({
  hasScreenshotted: z.boolean().optional().default(false),
});

/**
 * GET /api/status/feed
 * Returns user's own active stories + active stories grouped by contacts.
 */
statusRouter.get('/feed', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const currentUser = await db.findUserByFirebaseUid(req.uid);
    if (!currentUser) {
      res.status(404).json(
        createErrorResponse('NOT_FOUND', 'User profile not found. Please onboard first.')
      );
      return;
    }

    const feed = await db.getStatusFeed(currentUser.id);
    res.status(200).json(createSuccessResponse(feed));
  } catch (err) {
    logger.error({ err }, 'Error in GET /api/status/feed');
    res.status(500).json(createErrorResponse('INTERNAL_ERROR', 'Failed to retrieve status feed.'));
  }
});

/**
 * POST /api/status/create
 * Creates a text status or attaches a media URL.
 */
statusRouter.post('/create', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const parseResult = createStatusSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json(
      createErrorResponse(
        'VALIDATION_FAILED',
        parseResult.error.issues[0]?.message || 'Invalid status data',
        parseResult.error.flatten()
      )
    );
    return;
  }

  try {
    const currentUser = await db.findUserByFirebaseUid(req.uid);
    if (!currentUser) {
      res.status(404).json(createErrorResponse('NOT_FOUND', 'User not found.'));
      return;
    }

    const newStatus = await db.createStatus(currentUser.id, parseResult.data);
    res.status(201).json(createSuccessResponse(newStatus));
  } catch (err) {
    logger.error({ err }, 'Error in POST /api/status/create');
    res.status(500).json(createErrorResponse('INTERNAL_ERROR', 'Failed to publish status.'));
  }
});

/**
 * POST /api/status/upload
 * Uploads original uncompressed HD photo/video and creates status in one step.
 */
statusRouter.post('/upload', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const parseResult = uploadStatusSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json(
      createErrorResponse(
        'VALIDATION_FAILED',
        parseResult.error.issues[0]?.message || 'Invalid upload data',
        parseResult.error.flatten()
      )
    );
    return;
  }

  const { fileName, mimeType: _mimeType, data, mediaType, caption, backgroundColor } = parseResult.data;

  try {
    const currentUser = await db.findUserByFirebaseUid(req.uid);
    if (!currentUser) {
      res.status(404).json(createErrorResponse('NOT_FOUND', 'User not found.'));
      return;
    }

    // Strip base64 prefix
    const base64Data = data.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Generate safe storage filename
    const sanitizedExt = path.extname(fileName) || (mediaType === 'image' ? '.jpg' : '.mp4');
    const diskFileName = `status_${Date.now()}_${Math.random().toString(36).substring(2, 9)}${sanitizedExt}`;
    const destinationPath = path.join(UPLOADS_DIR, diskFileName);

    // Save bit-for-bit uncompressed file
    fs.writeFileSync(destinationPath, buffer);

    const mediaUrl = `/uploads/${diskFileName}`;

    const newStatus = await db.createStatus(currentUser.id, {
      mediaType,
      mediaUrl,
      caption,
      backgroundColor,
      durationSeconds: mediaType === 'video' ? 15 : 6,
    });

    res.status(201).json(createSuccessResponse(newStatus));
  } catch (err) {
    logger.error({ err }, 'Error in POST /api/status/upload');
    res.status(500).json(createErrorResponse('INTERNAL_ERROR', 'Failed to upload status media.'));
  }
});

/**
 * POST /api/status/:id/view
 * Records a viewer for a status (and flags if screenshot was detected).
 */
statusRouter.post('/:id/view', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const parseResult = viewStatusSchema.safeParse(req.body);
  const hasScreenshotted = parseResult.success ? !!parseResult.data.hasScreenshotted : false;

  try {
    const currentUser = await db.findUserByFirebaseUid(req.uid);
    if (!currentUser) {
      res.status(404).json(createErrorResponse('NOT_FOUND', 'User not found.'));
      return;
    }

    const result = await db.recordStatusView(String(req.params.id), currentUser.id, hasScreenshotted);
    res.status(200).json(createSuccessResponse(result));
  } catch (err) {
    logger.error({ err }, 'Error in POST /api/status/:id/view');
    res.status(500).json(createErrorResponse('INTERNAL_ERROR', 'Failed to record view.'));
  }
});

/**
 * GET /api/status/:id/viewers
 * Returns the list of users who viewed this status (Only status creator can access).
 */
statusRouter.get('/:id/viewers', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const currentUser = await db.findUserByFirebaseUid(req.uid);
    if (!currentUser) {
      res.status(404).json(createErrorResponse('NOT_FOUND', 'User not found.'));
      return;
    }

    const viewers = await db.getStatusViewers(String(req.params.id), currentUser.id);
    res.status(200).json(createSuccessResponse(viewers));
  } catch (err) {
    logger.error({ err }, 'Error in GET /api/status/:id/viewers');
    res.status(500).json(createErrorResponse('INTERNAL_ERROR', 'Failed to retrieve viewers list.'));
  }
});

/**
 * DELETE /api/status/:id
 * Manually deletes a status before 24-hour expiration.
 */
statusRouter.delete('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const currentUser = await db.findUserByFirebaseUid(req.uid);
    if (!currentUser) {
      res.status(404).json(createErrorResponse('NOT_FOUND', 'User not found.'));
      return;
    }

    const deleted = await db.deleteStatus(String(req.params.id), currentUser.id);
    if (!deleted) {
      res.status(404).json(
        createErrorResponse('NOT_FOUND', 'Status not found or you are not authorized to delete it.')
      );
      return;
    }

    res.status(200).json(createSuccessResponse({ success: true, id: req.params.id }));
  } catch (err) {
    logger.error({ err }, 'Error in DELETE /api/status/:id');
    res.status(500).json(createErrorResponse('INTERNAL_ERROR', 'Failed to delete status.'));
  }
});

/**
 * POST /api/status/:id/screenshot-alert
 * Explicit Snapchat-style alert webhook for status screenshot detection.
 */
statusRouter.post('/:id/screenshot-alert', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const currentUser = await db.findUserByFirebaseUid(req.uid);
    if (!currentUser) {
      res.status(404).json(createErrorResponse('NOT_FOUND', 'User not found.'));
      return;
    }

    await db.recordStatusView(String(req.params.id), currentUser.id, true);
    res.status(200).json(
      createSuccessResponse({
        alertRecorded: true,
        takerUsername: currentUser.username,
        timestamp: new Date().toISOString(),
      })
    );
  } catch (err) {
    logger.error({ err }, 'Error in POST /api/status/:id/screenshot-alert');
    res.status(500).json(createErrorResponse('INTERNAL_ERROR', 'Failed to record screenshot alert.'));
  }
});
