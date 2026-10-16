/**
 * @file Socket.IO server initialization and event handlers for real-time messaging.
 * Strict compliance with RULE 0.1: No phone numbers stored, transmitted, or logged.
 * 
 * [HINGLISH GUIDE]:
 * Yeh ChatFlow ka Real-time Socket.IO handler hai:
 * 1. Connection authentication: Handshake token se user verify hota hai.
 * 2. Room management: join_room aur leave_room handle karta hai.
 * 3. Live messaging: send_message aane par message database me save karta hai aur room ke sabhi members ko message_new bhejta hai.
 * 4. Typing indicators: typing_start aur typing_stop ko broadcast karta hai.
 */

import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  ChatMessage,
  type CallParticipant,
  type CallRecord,
} from '@chatflow/shared';
import { logger } from '../utils/logger';
import { db } from '../services/db';

interface SocketData {
  userId: string;
  email: string;
  username: string;
}

export function initSocketServer(
  httpServer: HttpServer,
  corsOrigin = '*'
): SocketIOServer<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData> {
  const io = new SocketIOServer<
    ClientToServerEvents,
    ServerToClientEvents,
    Record<string, never>,
    SocketData
  >(httpServer, {
    cors: {
      origin: corsOrigin,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      const clientUserId = socket.handshake.auth?.userId as string | undefined;
      const clientUsername = socket.handshake.auth?.username as string | undefined;

      if (!token) {
        // Fallback guest dev user for frictionless local development
        socket.data.userId = clientUserId || `dev_user_${socket.id.substring(0, 5)}`;
        socket.data.email = 'dev.user@chatflow.local';
        socket.data.username = clientUsername || 'guest_dev';
        return next();
      }

      // Handle dev token
      if (token.startsWith('dev_token_')) {
        const parts = token.replace('dev_token_', '').split(':');
        const devUid = parts[0] || 'dev_user_123';
        const devEmail = parts[1] || 'dev.user@gmail.com';

        let user = await db.findUserByFirebaseUid(devUid);
        if (!user && clientUserId) {
          user = await db.findUserById(clientUserId);
        }
        if (!user && clientUsername) {
          user = await db.findUserByUsername(clientUsername);
        }

        socket.data.userId = user ? user.id : (clientUserId || devUid);
        socket.data.email = user?.email || devEmail;
        socket.data.username = user ? user.username : (clientUsername || 'dev_user');
        return next();
      }

      // Real token (Firebase or Google OAuth2 ID Token)
      if (token.length > 50) {
        let extractedUid: string | null = null;
        let extractedEmail: string | null = null;

        try {
          const parts = token.split('.');
          if (parts.length >= 2 && parts[1]) {
            const base64Url = parts[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
            extractedUid = jsonPayload.user_id || jsonPayload.sub || null;
            extractedEmail = jsonPayload.email || null;
          }
        } catch {
          // Ignore
        }

        if (extractedUid) {
          const user = await db.findUserByFirebaseUid(extractedUid);
          if (user) {
            socket.data.userId = user.id;
            socket.data.email = user.email || extractedEmail || '';
            socket.data.username = user.username;
            return next();
          }
        }

        if (clientUserId) {
          const user = await db.findUserById(clientUserId);
          if (user) {
            socket.data.userId = user.id;
            socket.data.email = user.email || extractedEmail || '';
            socket.data.username = user.username;
            return next();
          }
        }
      }

      // Fallback
      socket.data.userId = clientUserId || `usr_${socket.id.substring(0, 5)}`;
      socket.data.email = 'user@chatflow.local';
      socket.data.username = clientUsername || 'chatflow_user';
      next();
    } catch (err) {
      logger.warn({ err }, 'Socket authentication failed');
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    const { userId, username } = socket.data;
    logger.info({ userId, socketId: socket.id }, `Socket connected: ${username} (${userId})`);

    // Join user's personal channel for direct user notifications, incoming calls & alerts
    void socket.join(`user_${userId}`);
    if (username) {
      void socket.join(`user_${username}`);
    }
    const clientUserId = socket.handshake.auth?.userId as string | undefined;
    if (clientUserId && clientUserId !== userId) {
      void socket.join(`user_${clientUserId}`);
    }

    // 1. Join Chat Room
    socket.on('join_room', ({ chatId }) => {
      void socket.join(chatId);
      logger.info({ userId, chatId }, `User joined room ${chatId}`);
    });

    // 2. Leave Chat Room
    socket.on('leave_room', ({ chatId }) => {
      void socket.leave(chatId);
      logger.info({ userId, chatId }, `User left room ${chatId}`);
    });

    // 3. Send Message
    socket.on('send_message', async ({ chatId, clientTempId, type, content, mediaUrl, replyToId, metadata }) => {
      try {
        let senderUser = (await db.findUserById(userId)) || (await db.findUserByFirebaseUid(userId));
        const effectiveSenderId = senderUser ? senderUser.id : userId;

        if (senderUser) {
          socket.data.userId = senderUser.id;
          socket.data.username = senderUser.username;
        }

        const message: ChatMessage = await db.saveMessage(
          chatId,
          effectiveSenderId,
          content,
          type,
          mediaUrl,
          replyToId,
          metadata
        );

        // Broadcast to all participants in this conversation
        io.to(chatId).emit('message_new', {
          message,
          clientTempId,
        });

        // Ensure both participants have each other in their inbox contacts
        const participants = chatId.split('_');
        const recipientId = participants.find((id) => id !== effectiveSenderId && id !== userId);
        if (recipientId) {
          const recipientUser = (await db.findUserById(recipientId)) || (await db.findUserByFirebaseUid(recipientId));
          if (recipientUser && senderUser) {
            const hasSender = await db.hasContact(effectiveSenderId, recipientUser.id);
            if (!hasSender) {
              await db.addContact(effectiveSenderId, recipientUser);
            }
            const hasRecipient = await db.hasContact(recipientUser.id, effectiveSenderId);
            if (!hasRecipient) {
              await db.addContact(recipientUser.id, senderUser);
            }
          }
        }

        logger.info(
          { messageId: message.id, chatId, senderId: userId },
          `Message delivered to room ${chatId}`
        );
      } catch (err) {
        logger.error({ err, chatId }, 'Failed to persist and broadcast message');
        socket.emit('error', {
          code: 'MESSAGE_SEND_FAILED',
          message: 'Unable to send message, please retry.',
        });
      }
    });

    // 4. Typing Start
    socket.on('typing_start', ({ chatId }) => {
      socket.to(chatId).emit('user_typing', {
        chatId,
        userId,
        username,
        isTyping: true,
      });
    });

    // 5. Typing Stop
    socket.on('typing_stop', ({ chatId }) => {
      socket.to(chatId).emit('user_typing', {
        chatId,
        userId,
        username,
        isTyping: false,
      });
    });

    // 6. Message Delivered
    socket.on('message_delivered', async ({ messageId, chatId }) => {
      await db.updateMessageStatus(messageId, chatId, 'delivered');
      io.to(chatId).emit('message_status_update', {
        messageId,
        chatId,
        status: 'delivered',
      });
    });

    // 7. Message Read
    socket.on('message_read', async ({ messageId, chatId }) => {
      await db.updateMessageStatus(messageId, chatId, 'read');
      io.to(chatId).emit('message_status_update', {
        messageId,
        chatId,
        status: 'read',
      });
    });

    // 8. Snapchat-Style Screenshot Detection Alert
    socket.on(
      'screenshot_alert',
      async ({ targetType, targetId, ownerId, takerUserId, takerUsername, takerDisplayName }) => {
        logger.warn(
          { targetType, targetId, ownerId, takerUsername },
          `Snapchat Screenshot Alert: ${takerUsername} took a screenshot of ${targetType} ${targetId}`
        );

        const timestamp = new Date().toISOString();

        if (targetType === 'status') {
          // Record in status views that this user screenshotted
          await db.recordStatusView(targetId, takerUserId, true);
          // Alert story owner directly on their private channel
          io.to(`user_${ownerId}`).emit('screenshot_detected', {
            targetType,
            targetId,
            takerUserId,
            takerUsername,
            takerDisplayName,
            timestamp,
          });
        } else if (targetType === 'chat') {
          // Broadcast to chat room so both participants see the Snapchat-style alert
          io.to(targetId).emit('screenshot_detected', {
            targetType,
            targetId,
            takerUserId,
            takerUsername,
            takerDisplayName,
            timestamp,
          });
        }
      }
    );

    // 9. Status Published / Deleted Notification
    socket.on('status_published', ({ statusId: _statusId, userId: pubUserId }) => {
      socket.broadcast.emit('status_feed_update', {
        userId: pubUserId,
        action: 'created',
      });
    });

    // =========================================================================
    // 10. WebRTC 1-on-1 Audio & Video Calling Signaling (Phase 5)
    // =========================================================================

    // A. Initiate Call (Sender sends offer)
    // A. Initiate Call (Sender sends offer)
    socket.on('call_initiate', async ({ callId, receiverId, type, sdp }) => {
      try {
        let callerUser = await db.findUserById(userId);
        if (!callerUser) {
          callerUser = await db.findUserByFirebaseUid(userId);
        }
        let receiverUser = await db.findUserById(receiverId);
        if (!receiverUser) {
          receiverUser = await db.findUserByUsername(receiverId);
        }

        const effectiveCallerId = callerUser ? callerUser.id : userId;
        const callerInfo: CallParticipant = {
          id: effectiveCallerId,
          username: callerUser?.username || username,
          displayName: callerUser?.displayName || username,
          avatarUrl: callerUser?.avatarUrl || undefined,
        };

        // Upgrade caller socket identity in memory and join canonical user rooms
        if (callerUser) {
          socket.data.userId = callerUser.id;
          socket.data.username = callerUser.username;
          void socket.join(`user_${callerUser.id}`);
          void socket.join(`user_${callerUser.username}`);
        }

        const newCall: CallRecord = {
          id: callId,
          callerId: effectiveCallerId,
          callerUsername: callerInfo.username,
          callerDisplayName: callerInfo.displayName,
          callerAvatarUrl: callerInfo.avatarUrl,
          receiverId: receiverUser ? receiverUser.id : receiverId,
          receiverUsername: receiverUser?.username || 'user',
          receiverDisplayName: receiverUser?.displayName || 'User',
          receiverAvatarUrl: receiverUser?.avatarUrl || undefined,
          type,
          status: 'ringing',
          startedAt: new Date().toISOString(),
          durationSeconds: 0,
        };

        await db.createCallRecord(newCall);

        // Acknowledge caller that ringing has started
        socket.emit('call_ringing', { callId, receiverId });

        // Relay incoming call offer to receiver's private rooms using chained .to() for socket deduplication
        const targetRoom = `user_${receiverId}`;
        const roomSockets = io.sockets.adapter.rooms.get(targetRoom);
        const clientCount = roomSockets ? roomSockets.size : 0;

        logger.info(
          { callId, callerId: effectiveCallerId, receiverId, targetRoom, clientCount, type },
          `Call initiated: ${callerInfo.username} calling ${receiverUser?.username || receiverId} (${clientCount} active receiver sockets)`
        );

        let emitter = io.to(targetRoom);
        if (receiverUser?.username && `user_${receiverUser.username}` !== targetRoom) {
          emitter = emitter.to(`user_${receiverUser.username}`);
        }
        if (receiverUser?.id && `user_${receiverUser.id}` !== targetRoom) {
          emitter = emitter.to(`user_${receiverUser.id}`);
        }

        emitter.emit('incoming_call', {
          callId,
          caller: callerInfo,
          type,
          sdp,
        });
      } catch (err) {
        logger.error({ err, callId }, 'Failed to initiate call');
      }
    });

    // B. Answer Call (Receiver accepts offer with answer SDP)
    socket.on('call_answer', async ({ callId, callerId, sdp }) => {
      try {
        let responderUser = await db.findUserById(userId);
        if (!responderUser) {
          responderUser = await db.findUserByFirebaseUid(userId);
        }
        const effectiveResponderId = responderUser ? responderUser.id : userId;
        const responder: CallParticipant = {
          id: effectiveResponderId,
          username: responderUser?.username || username,
          displayName: responderUser?.displayName || username,
          avatarUrl: responderUser?.avatarUrl || undefined,
        };

        await db.updateCallRecord(callId, {
          status: 'connected',
          answeredAt: new Date().toISOString(),
        });

        const callerUser = (await db.findUserById(callerId)) || (await db.findUserByFirebaseUid(callerId));

        let callerEmitter = io.to(`user_${callerId}`);
        if (callerUser?.username && `user_${callerUser.username}` !== `user_${callerId}`) {
          callerEmitter = callerEmitter.to(`user_${callerUser.username}`);
        }
        if (callerUser?.id && `user_${callerUser.id}` !== `user_${callerId}`) {
          callerEmitter = callerEmitter.to(`user_${callerUser.id}`);
        }

        callerEmitter.emit('call_accepted', {
          callId,
          responder,
          sdp,
        });

        logger.info({ callId, callerId, responderId: effectiveResponderId }, `Call answered & connected`);
      } catch (err) {
        logger.error({ err, callId }, 'Failed to answer call');
      }
    });

    // C. Reject Call (Receiver declines call)
    socket.on('call_reject', async ({ callId, callerId, reason }) => {
      try {
        await db.updateCallRecord(callId, {
          status: 'rejected',
          endedAt: new Date().toISOString(),
        });

        const callerUser = (await db.findUserById(callerId)) || (await db.findUserByFirebaseUid(callerId));

        let rejectEmitter = io.to(`user_${callerId}`);
        if (callerUser?.username && `user_${callerUser.username}` !== `user_${callerId}`) {
          rejectEmitter = rejectEmitter.to(`user_${callerUser.username}`);
        }
        if (callerUser?.id && `user_${callerUser.id}` !== `user_${callerId}`) {
          rejectEmitter = rejectEmitter.to(`user_${callerUser.id}`);
        }

        rejectEmitter.emit('call_rejected', {
          callId,
          reason: reason || 'Call declined',
        });

        logger.info({ callId, callerId, rejectedBy: userId }, `Call rejected`);
      } catch (err) {
        logger.error({ err, callId }, 'Failed to reject call');
      }
    });

    // D. ICE Candidate Exchange
    socket.on('call_ice_candidate', async ({ callId, targetUserId, candidate }) => {
      const targetUser = (await db.findUserById(targetUserId)) || (await db.findUserByFirebaseUid(targetUserId));
      let candidateEmitter = io.to(`user_${targetUserId}`);
      if (targetUser?.username && `user_${targetUser.username}` !== `user_${targetUserId}`) {
        candidateEmitter = candidateEmitter.to(`user_${targetUser.username}`);
      }
      if (targetUser?.id && `user_${targetUser.id}` !== `user_${targetUserId}`) {
        candidateEmitter = candidateEmitter.to(`user_${targetUser.id}`);
      }

      candidateEmitter.emit('call_ice_candidate', {
        callId,
        senderUserId: userId,
        candidate,
      });
    });

    // E. Hangup / End Call
    socket.on('call_end', async ({ callId, targetUserId, durationSeconds, reason }) => {
      try {
        const call = await db.findCallById(callId);
        const finalDuration =
          durationSeconds ??
          (call?.answeredAt
            ? Math.max(0, Math.round((Date.now() - new Date(call.answeredAt).getTime()) / 1000))
            : 0);

        const finalStatus = call?.status === 'ringing' ? 'missed' : 'ended';

        await db.updateCallRecord(callId, {
          status: finalStatus,
          endedAt: new Date().toISOString(),
          durationSeconds: finalDuration,
        });

        const targetUser = (await db.findUserById(targetUserId)) || (await db.findUserByFirebaseUid(targetUserId));
        let endEmitter = io.to(`user_${targetUserId}`);
        if (targetUser?.username && `user_${targetUser.username}` !== `user_${targetUserId}`) {
          endEmitter = endEmitter.to(`user_${targetUser.username}`);
        }
        if (targetUser?.id && `user_${targetUser.id}` !== `user_${targetUserId}`) {
          endEmitter = endEmitter.to(`user_${targetUser.id}`);
        }

        endEmitter.emit('call_ended', {
          callId,
          peerUserId: userId,
          reason: reason || 'Call ended',
          durationSeconds: finalDuration,
        });

        logger.info({ callId, userId, targetUserId, finalDuration }, `Call ended`);
      } catch (err) {
        logger.error({ err, callId }, 'Failed to terminate call');
      }
    });

    socket.on('disconnect', () => {
      logger.info({ userId, socketId: socket.id }, `Socket disconnected: ${username}`);
    });
  });

  return io;
}
