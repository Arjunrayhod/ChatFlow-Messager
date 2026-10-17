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
  content: z.string().trim().max(4000).default(''),
  type: z.enum(['text', 'image', 'video', 'audio', 'document', 'location']).default('text'),
  mediaUrl: z.string().optional(),
  metadata: z.record(z.any()).optional(),
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

    const currentUser = await db.findUserByFirebaseUid(req.uid);
    if (!currentUser || !(await db.canAccessChat(chatId, currentUser.id))) {
      res.status(403).json(createErrorResponse('FORBIDDEN', 'You are not a participant in this chat'));
      return;
    }

    const messages = await db.getMessages(chatId, 100);

    // Normalize legacy senderIds (dev UIDs or email keys) to canonical user IDs
    const normalizedMessages = await Promise.all(
      messages.map(async (msg) => {
        if (msg.senderId.includes('@') || msg.senderId.startsWith('google_')) {
          const user = await db.findUserByFirebaseUid(msg.senderId);
          if (user) {
            return { ...msg, senderId: user.id };
          }
        }
        return msg;
      })
    );

    res.status(200).json(createSuccessResponse(normalizedMessages));
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
    if (!currentUser || !(await db.canAccessChat(chatId, currentUser.id))) {
      res.status(403).json(createErrorResponse('FORBIDDEN', 'You are not a participant in this chat'));
      return;
    }
    const senderId = currentUser.id;

    const { content, type, mediaUrl, replyToId, metadata } = parseResult.data;

    let message;
    try {
      message = await db.saveMessage(
        chatId,
        senderId,
        content,
        type,
        mediaUrl,
        replyToId,
        metadata
      );
    } catch {
      res.status(500).json(createErrorResponse('INTERNAL_ERROR', 'Failed to save message'));
      return;
    }

    // Ensure reciprocal contacts in inbox
    const participants = chatId.split('_');
    const recipientId = participants.find((id) => id !== senderId);
    if (recipientId) {
      const recipientUser = await db.findUserById(recipientId);
      const senderUser = await db.findUserById(senderId);
      if (recipientUser && senderUser) {
        const hasSender = await db.hasContact(senderId, recipientId);
        if (!hasSender) {
          await db.addContact(senderId, recipientUser);
        }
        const hasRecipient = await db.hasContact(recipientId, senderId);
        if (!hasRecipient) {
          await db.addContact(recipientId, senderUser);
        }
      }
    }

    res.status(201).json(createSuccessResponse(message));
  }
);
