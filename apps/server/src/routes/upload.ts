/**
 * @file Media Upload Route for Original HD Photos and Videos.
 * Preserves 100% original resolution and quality without any compression or downscaling.
 * Strict compliance with RULE 0.1 (No phone numbers) and RULE 0.5 (API Envelope).
 * 
 * [HINGLISH GUIDE]:
 * Yeh Original HD Media Upload Route hai:
 * 1. Base64 encoded photos aur videos ko receive karta hai.
 * 2. Bina kisi compression ya quality drop ke exact original binary bytes disk me save karta hai.
 * 3. Client ko static download/streaming URL return karta hai.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { createSuccessResponse, createErrorResponse } from '@chatflow/shared';
import { logger } from '../utils/logger';
import { requireAuth } from '../middlewares/auth';
import { extensionForMimeType, isValidBase64Payload } from '../utils/media';

export const uploadRouter: Router = Router();

// Ensure uploads directory exists
const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const uploadSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(100),
  data: z.string().min(1, 'File payload is required').max(90_000_000),
  isHD: z.boolean().default(true),
  width: z.number().optional(),
  height: z.number().optional(),
  duration: z.number().optional(),
});

/**
 * POST /api/upload
 * Uploads media in original uncompressed HD resolution.
 */
uploadRouter.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const parseResult = uploadSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json(
      createErrorResponse(
        'VALIDATION_FAILED',
        parseResult.error.issues[0]?.message || 'Invalid upload payload',
        parseResult.error.flatten()
      )
    );
    return;
  }

  const { fileName, mimeType, data, isHD, width, height, duration } = parseResult.data;
  const extension = extensionForMimeType(mimeType);
  if (!extension) {
    res.status(400).json(createErrorResponse('VALIDATION_FAILED', 'This media type is not supported'));
    return;
  }

  try {
    // Strip data URI prefix if present (e.g. data:image/jpeg;base64,...)
    const base64Data = data.replace(/^data:[^;]+;base64,/, '');
    if (!isValidBase64Payload(base64Data, 64 * 1024 * 1024)) {
      res.status(400).json(createErrorResponse('VALIDATION_FAILED', 'Media must be valid base64 and no larger than 64 MB'));
      return;
    }
    const buffer = Buffer.from(base64Data, 'base64');

    // Never use a client-supplied extension for a publicly served file.
    const uniqueFileName = `${Date.now()}_${Math.random().toString(36).substring(2, 10)}${extension}`;
    const filePath = path.join(UPLOADS_DIR, uniqueFileName);

    // Save exact binary buffer to disk
    await fs.promises.writeFile(filePath, buffer);

    const protocol = req.protocol;
    const host = req.get('host') || 'localhost:4000';
    const mediaUrl = `${protocol}://${host}/uploads/${uniqueFileName}`;

    logger.info(
      { fileName: uniqueFileName, sizeBytes: buffer.length, mimeType, isHD, width, height },
      'Original HD Media saved successfully'
    );

    res.status(200).json(
      createSuccessResponse({
        url: mediaUrl,
        fileName,
        savedFileName: uniqueFileName,
        mimeType,
        fileSize: buffer.length,
        isHD,
        width: width || null,
        height: height || null,
        duration: duration || null,
      })
    );
  } catch (err: unknown) {
    logger.error({ err }, 'Failed to save uploaded media file');
    res.status(500).json(createErrorResponse('INTERNAL_ERROR', 'Could not save uploaded media'));
  }
});
