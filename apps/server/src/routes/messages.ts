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

const editMessageSchema = z.object({ content: z.string().trim().min(1).max(4000) });
const disappearingSchema = z.object({ seconds: z.union([z.literal(0), z.literal(86400), z.literal(604800), z.literal(7776000)]) });
const expenseSchema = z.object({ title: z.string().trim().min(1).max(100), amount: z.number().positive().max(100000000), paidBy: z.string().min(1), splitBetween: z.array(z.string().min(1)).min(1).max(50) });
const taskSchema = z.object({ title: z.string().trim().min(1).max(120), body: z.string().max(1000).nullable().optional(), assignedTo: z.string().nullable().optional(), dueAt: z.string().datetime().nullable().optional() });
const scheduleSchema = z.object({ content: z.string().trim().min(1).max(4000), sendAt: z.string().datetime() });

/**
 * GET /api/messages/:chatId
 * Fetches message history for a conversation.
 */
messagesRouter.get(
  '/:chatId',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const { chatId = '' } = req.params;
    if (!chatId) {
      res.status(400).json(createErrorResponse('VALIDATION_FAILED', 'chatId parameter is required'));
      return;
    }

    let currentUser = (await db.findUserByFirebaseUid(req.uid)) || (await db.findUserById(req.uid));
    if (!currentUser) {
      const fallbackName = (req.userEmail && req.userEmail.split('@')[0]) || req.uid;
      currentUser = await db.createUser({
        firebaseUid: req.uid,
        email: req.userEmail || `${req.uid}@chatflow.local`,
        username: fallbackName,
        displayName: fallbackName,
      });
    }
    if (!currentUser || !(await db.canAccessChat(chatId, currentUser.id))) {
      res.status(403).json(createErrorResponse('FORBIDDEN', 'You are not a participant in this chat'));
      return;
    }

    const messages = await db.getMessages(chatId, 100, currentUser.id);

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

messagesRouter.get('/:chatId/preferences', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const currentUser = await db.findUserByFirebaseUid(req.uid);
  const chatId = req.params.chatId || '';
  if (!currentUser || !(await db.canAccessChat(chatId, currentUser.id))) {
    res.status(403).json(createErrorResponse('FORBIDDEN', 'You are not a participant in this chat'));
    return;
  }
  res.status(200).json(createSuccessResponse({ disappearingSeconds: await db.getChatDisappearingSeconds(chatId) }));
});

messagesRouter.put('/:chatId/preferences', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const currentUser = await db.findUserByFirebaseUid(req.uid);
  const chatId = req.params.chatId || '';
  const parsed = disappearingSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(createErrorResponse('VALIDATION_FAILED', 'Choose 24 hours, 7 days, 90 days, or off'));
    return;
  }
  if (!currentUser || !(await db.canAccessChat(chatId, currentUser.id))) {
    res.status(403).json(createErrorResponse('FORBIDDEN', 'You are not a participant in this chat'));
    return;
  }
  await db.setChatDisappearingSeconds(chatId, currentUser.id, parsed.data.seconds);
  res.status(200).json(createSuccessResponse({ disappearingSeconds: parsed.data.seconds }));
});

messagesRouter.put('/:chatId/:messageId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const currentUser = await db.findUserByFirebaseUid(req.uid);
  const { chatId = '', messageId = '' } = req.params;
  const parsed = editMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(createErrorResponse('VALIDATION_FAILED', 'Message text must be between 1 and 4000 characters'));
    return;
  }
  if (!currentUser || !(await db.canAccessChat(chatId, currentUser.id))) {
    res.status(403).json(createErrorResponse('FORBIDDEN', 'You are not a participant in this chat'));
    return;
  }
  const message = await db.editMessage(chatId, messageId, currentUser.id, parsed.data.content);
  if (!message) {
    res.status(409).json(createErrorResponse('VALIDATION_FAILED', 'Only your own messages can be edited within 15 minutes'));
    return;
  }
  res.status(200).json(createSuccessResponse(message));
});

messagesRouter.put('/:chatId/:messageId/pin', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const currentUser = await db.findUserByFirebaseUid(req.uid);
  const { chatId = '', messageId = '' } = req.params;
  const pinned = z.object({ pinned: z.boolean() }).safeParse(req.body);
  if (!pinned.success) {
    res.status(400).json(createErrorResponse('VALIDATION_FAILED', 'Pinned state is required'));
    return;
  }
  if (!currentUser || !(await db.canAccessChat(chatId, currentUser.id))) {
    res.status(403).json(createErrorResponse('FORBIDDEN', 'You are not a participant in this chat'));
    return;
  }
  const updated = await db.setMessagePinned(chatId, messageId, currentUser.id, pinned.data.pinned);
  if (!updated) {
    res.status(404).json(createErrorResponse('NOT_FOUND', 'Message does not exist in this chat'));
    return;
  }
  res.status(200).json(createSuccessResponse({ messageId, pinned: pinned.data.pinned }));
});

messagesRouter.put('/:chatId/:messageId/hide', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const currentUser = await db.findUserByFirebaseUid(req.uid);
  const { chatId = '', messageId = '' } = req.params;
  const hidden = z.object({ hidden: z.boolean() }).safeParse(req.body);
  if (!hidden.success) {
    res.status(400).json(createErrorResponse('VALIDATION_FAILED', 'Hidden state is required'));
    return;
  }
  if (!currentUser || !(await db.canAccessChat(chatId, currentUser.id))) {
    res.status(403).json(createErrorResponse('FORBIDDEN', 'You are not a participant in this chat'));
    return;
  }
  const updated = await db.hideMessageFor(chatId, messageId, currentUser.id, hidden.data.hidden);
  if (!updated) {
    res.status(404).json(createErrorResponse('NOT_FOUND', 'Message does not exist in this chat'));
    return;
  }
  res.status(200).json(createSuccessResponse({ messageId, hidden: hidden.data.hidden }));
});

messagesRouter.get('/:chatId/expenses', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const currentUser = await db.findUserByFirebaseUid(req.uid);
  const { chatId = '' } = req.params;
  if (!currentUser || !(await db.canAccessChat(chatId, currentUser.id))) {
    res.status(403).json(createErrorResponse('FORBIDDEN', 'You are not a participant in this chat'));
    return;
  }
  res.status(200).json(createSuccessResponse(await db.getChatExpenses(chatId)));
});

messagesRouter.post('/:chatId/expenses', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const currentUser = await db.findUserByFirebaseUid(req.uid);
  const { chatId = '' } = req.params;
  const parsed = expenseSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(createErrorResponse('VALIDATION_FAILED', 'Enter a title, amount, payer, and participants'));
    return;
  }
  if (!currentUser || !(await db.canAccessChat(chatId, currentUser.id))) {
    res.status(403).json(createErrorResponse('FORBIDDEN', 'You are not a participant in this chat'));
    return;
  }
  const participants = [...new Set(parsed.data.splitBetween)];
  if (!participants.includes(parsed.data.paidBy) || !(await Promise.all(participants.map((id) => db.canAccessChat(chatId, id)))).every(Boolean)) {
    res.status(400).json(createErrorResponse('VALIDATION_FAILED', 'Payer and split members must belong to this chat'));
    return;
  }
  const expense = await db.createChatExpense({ chatId, createdBy: currentUser.id, title: parsed.data.title,
    amount: parsed.data.amount, currency: 'INR', paidBy: parsed.data.paidBy, splitBetween: participants });
  res.status(201).json(createSuccessResponse(expense));
});

messagesRouter.get('/:chatId/tasks', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const currentUser = await db.findUserByFirebaseUid(req.uid);
  const { chatId = '' } = req.params;
  if (!currentUser || !(await db.canAccessChat(chatId, currentUser.id))) {
    res.status(403).json(createErrorResponse('FORBIDDEN', 'You are not a participant in this chat'));
    return;
  }
  res.status(200).json(createSuccessResponse(await db.getChatTasks(chatId)));
});

messagesRouter.post('/:chatId/tasks', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const currentUser = await db.findUserByFirebaseUid(req.uid);
  const { chatId = '' } = req.params;
  const parsed = taskSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(createErrorResponse('VALIDATION_FAILED', 'Enter a task title and a valid assignee'));
    return;
  }
  if (!currentUser || !(await db.canAccessChat(chatId, currentUser.id))) {
    res.status(403).json(createErrorResponse('FORBIDDEN', 'You are not a participant in this chat'));
    return;
  }
  const assignedTo = parsed.data.assignedTo || null;
  if (assignedTo && !(await db.canAccessChat(chatId, assignedTo))) {
    res.status(400).json(createErrorResponse('VALIDATION_FAILED', 'Assignee must belong to this chat'));
    return;
  }
  const task = await db.createChatTask({ chatId, createdBy: currentUser.id, assignedTo, title: parsed.data.title,
    body: parsed.data.body || null, dueAt: parsed.data.dueAt || null });
  res.status(201).json(createSuccessResponse(task));
});

messagesRouter.put('/:chatId/tasks/:taskId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const currentUser = await db.findUserByFirebaseUid(req.uid);
  const { chatId = '', taskId = '' } = req.params;
  const parsed = z.object({ completed: z.boolean() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(createErrorResponse('VALIDATION_FAILED', 'Completed state is required'));
    return;
  }
  if (!currentUser || !(await db.canAccessChat(chatId, currentUser.id))) {
    res.status(403).json(createErrorResponse('FORBIDDEN', 'You are not a participant in this chat'));
    return;
  }
  const task = await db.completeChatTask(chatId, taskId, parsed.data.completed);
  if (!task) {
    res.status(404).json(createErrorResponse('NOT_FOUND', 'Task was not found'));
    return;
  }
  res.status(200).json(createSuccessResponse(task));
});

messagesRouter.post('/:chatId/scheduled', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const currentUser = await db.findUserByFirebaseUid(req.uid);
  const { chatId = '' } = req.params;
  const parsed = scheduleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(createErrorResponse('VALIDATION_FAILED', 'Message text and a valid future date are required'));
    return;
  }
  if (Date.parse(parsed.data.sendAt) <= Date.now()) {
    res.status(400).json(createErrorResponse('VALIDATION_FAILED', 'Choose a future date and time for the message'));
    return;
  }
  if (!currentUser || !(await db.canAccessChat(chatId, currentUser.id))) {
    res.status(403).json(createErrorResponse('FORBIDDEN', 'You are not a participant in this chat'));
    return;
  }
  const scheduled = await db.createScheduledMessage({ chatId, senderId: currentUser.id, content: parsed.data.content, sendAt: parsed.data.sendAt });
  res.status(201).json(createSuccessResponse(scheduled));
});

/**
 * POST /api/messages/:chatId
 * Sends a message via REST endpoint (useful when socket is reconnecting).
 */
messagesRouter.post(
  '/:chatId',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const { chatId = '' } = req.params;
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

    let currentUser = (await db.findUserByFirebaseUid(req.uid)) || (await db.findUserById(req.uid));
    if (!currentUser) {
      const fallbackName = (req.userEmail && req.userEmail.split('@')[0]) || req.uid;
      currentUser = await db.createUser({
        firebaseUid: req.uid,
        email: req.userEmail || `${req.uid}@chatflow.local`,
        username: fallbackName,
        displayName: fallbackName,
      });
    }
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
    const senderCandidates = [senderId, currentUser.id, currentUser.firebaseUid, currentUser.username].filter(Boolean) as string[];
    let recipientId: string | null = null;
    for (const sId of senderCandidates) {
      if (chatId.startsWith(`${sId}_`)) {
        recipientId = chatId.slice(sId.length + 1);
        break;
      }
      if (chatId.endsWith(`_${sId}`)) {
        recipientId = chatId.slice(0, -(sId.length + 1));
        break;
      }
    }
    if (!recipientId) {
      const parts = chatId.split('_');
      recipientId = parts.find((id) => !senderCandidates.includes(id)) || null;
    }

    if (recipientId) {
      const recipientUser = (await db.findUserById(recipientId)) || (await db.findUserByFirebaseUid(recipientId)) || (await db.findUserByUsername(recipientId));
      const senderUser = await db.findUserById(senderId);
      if (recipientUser && senderUser) {
        const hasSender = await db.hasContact(senderId, recipientUser.id);
        if (!hasSender) {
          await db.addContact(senderId, recipientUser);
        }
        const hasRecipient = await db.hasContact(recipientUser.id, senderId);
        if (!hasRecipient) {
          await db.addContact(recipientUser.id, senderUser);
        }
      }
    }

    res.status(201).json(createSuccessResponse(message));
  }
);
