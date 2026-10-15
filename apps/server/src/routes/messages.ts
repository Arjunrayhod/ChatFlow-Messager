/**
 * @file Message REST API routes for message history and offline fallback.
 * Enforces RULE 0.1: Identity strictly via @username and user ID (no phone numbers).
 * 
 * [HINGLISH GUIDE]:
 * Yeh Message History ka REST API endpoint hai:
 * GET /api/messages/:chatId -> chat room khulne par purane messages load karta hai.
 * POST /api/messages/:chatId -> HTTP ke through naya message bhejna (fallback).
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { createSuccessResponse, createErrorResponse } from '@chatflow/shared';
import { requireAuth } from '../middlewares/auth';
import { db } from '../services/db';

export const messagesRouter: Router = Router();

const sendMessageSchema = z.object({
  content: z.string().trim().min(1, 'Message cannot be empty').max(4000),
  type: z.enum(['text', 'image', 'video', 'audio', 'document', 'location']).default('text'),
  mediaUrl: z.string().url().optional(),
  replyToId: z.string().optional(),
});

/**
 * GET /api/messages/:chatId
 * Fetches message history for a conversation.
 */
messagesRouter.get(
  '/:chatId',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const { chatId } = req.params;
    if (!chatId) {
      res.status(400).json(createErrorResponse('VALIDATION_FAILED', 'chatId parameter is required'));
      return;
    }

    const messages = await db.getMessages(chatId, 100);
    res.status(200).json(createSuccessResponse(messages));
  }
);

/**
 * POST /api/messages/:chatId
 * Sends a message via REST endpoint (useful when socket is reconnecting).
 */
messagesRouter.post(
  '/:chatId',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const { chatId } = req.params;
    if (!chatId) {
      res.status(400).json(createErrorResponse('VALIDATION_FAILED', 'chatId parameter is required'));
      return;
    }

    const parseResult = sendMessageSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json(
        createErrorResponse(
          'VALIDATION_FAILED',
          parseResult.error.issues[0]?.message || 'Invalid message payload',
          parseResult.error.flatten()
        )
      );
      return;
    }

    const currentUser = await db.findUserByFirebaseUid(req.uid);
    const senderId = currentUser ? currentUser.id : req.uid;

    const { content, type, mediaUrl, replyToId } = parseResult.data;

    const message = await db.saveMessage(
      chatId,
      senderId,
      content,
      type,
      mediaUrl,
      replyToId
    );

    res.status(201).json(createSuccessResponse(message));
  }
);
