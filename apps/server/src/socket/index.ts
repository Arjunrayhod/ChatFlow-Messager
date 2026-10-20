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
import { verifyAuthToken } from '../middlewares/auth';
import { sendIncomingCallPush, sendNewMessagePush } from '../services/push';

interface SocketData {
  userId: string;
  email: string;
  username: string;
}

export function initSocketServer(
  httpServer: HttpServer,
  _corsOrigin = '*'
): SocketIOServer<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData> {
  const io = new SocketIOServer<
    ClientToServerEvents,
    ServerToClientEvents,
    Record<string, never>,
    SocketData
  >(httpServer, {
    cors: {
      origin: true,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) return next(new Error('Authentication required'));

      const identity = await verifyAuthToken(token);
      if (!identity) return next(new Error('Authentication failed'));

      const user = await db.findUserByFirebaseUid(identity.uid);
      socket.data.userId = user?.id || identity.uid;
      socket.data.email = user?.email || identity.email;
      socket.data.username = user?.username || '';
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
    // Join canonical database user rooms (id, username, firebaseUid)
    void (async () => {
      try {
        const u =
          (await db.findUserById(userId)) ||
          (await db.findUserByFirebaseUid(userId)) ||
          (username ? await db.findUserByUsername(username) : null);
        if (u) {
          void socket.join(`user_${u.id}`);
          void socket.join(`user_${u.username}`);
          if (u.firebaseUid) {
            void socket.join(`user_${u.firebaseUid}`);
          }
        }
      } catch {
        // ignore
      }
    })();

    // 1. Join Chat Room
    socket.on('join_room', async ({ chatId }) => {
      if (!(await db.canAccessChat(chatId, userId))) {
        socket.emit('error', { code: 'FORBIDDEN', message: 'You are not a participant in this chat' });
        return;
      }
      await socket.join(chatId);
      logger.info({ userId, chatId }, `User joined room ${chatId}`);

      // Auto-mark peer messages as read when opening room
      try {
        const readIds = await db.markMessagesAsRead(chatId, userId);
        for (const mId of readIds) {
          io.to(chatId).emit('message_status_update', {
            messageId: mId,
            chatId,
            status: 'read',
          });
        }
      } catch {
        // ignore
      }
    });

    // 2. Leave Chat Room
    socket.on('leave_room', ({ chatId }) => {
      void socket.leave(chatId);
      logger.info({ userId, chatId }, `User left room ${chatId}`);
    });

    socket.on('chat_read', async ({ chatId }: { chatId: string }) => {
      if (!(await db.canAccessChat(chatId, userId))) return;
      try {
        const readIds = await db.markMessagesAsRead(chatId, userId);
        for (const mId of readIds) {
          io.to(chatId).emit('message_status_update', {
            messageId: mId,
            chatId,
            status: 'read',
          });
        }
      } catch {
        // ignore
      }
    });

    socket.on('refresh_chat', async ({ chatId }) => {
      if (!(await db.canAccessChat(chatId, userId))) return;
      io.to(chatId).emit('chat_refresh', { chatId });
    });

    // 3. Send Message
    socket.on('send_message', async ({ chatId, clientTempId, type, content, mediaUrl, replyToId, metadata }) => {
      try {
        if (!(await db.canAccessChat(chatId, userId))) {
          socket.emit('error', { code: 'FORBIDDEN', message: 'You are not a participant in this chat' });
          return;
        }
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
          // ALSO emit to personal user rooms so inbox/chats list receives it immediately
          io.to(`user_${recipientId}`).emit('message_new', {
            message,
            clientTempId,
          });
          io.to(`user_${effectiveSenderId}`).emit('message_new', {
            message,
            clientTempId,
          });

          const recipientUser = (await db.findUserById(recipientId)) || (await db.findUserByFirebaseUid(recipientId));
          if (recipientUser && senderUser) {
            if (recipientUser.id !== recipientId) {
              io.to(`user_${recipientUser.id}`).emit('message_new', { message, clientTempId });
            }
            const hasSender = await db.hasContact(effectiveSenderId, recipientUser.id);
            if (!hasSender) {
              await db.addContact(effectiveSenderId, recipientUser);
            }
            const hasRecipient = await db.hasContact(recipientUser.id, effectiveSenderId);
            if (!hasRecipient) {
              await db.addContact(recipientUser.id, senderUser);
            }
          }
          if (senderUser) {
            void sendNewMessagePush(message, senderUser, recipientId);
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
    socket.on('typing_start', async ({ chatId }) => {
      if (!(await db.canAccessChat(chatId, userId))) return;
      socket.to(chatId).emit('user_typing', {
        chatId,
        userId,
        username,
        isTyping: true,
      });
    });

    // 5. Typing Stop
    socket.on('typing_stop', async ({ chatId }) => {
      if (!(await db.canAccessChat(chatId, userId))) return;
      socket.to(chatId).emit('user_typing', {
        chatId,
        userId,
        username,
        isTyping: false,
      });
    });

    // 6. Message Delivered
    socket.on('message_delivered', async ({ messageId, chatId }) => {
      if (!(await db.canAccessChat(chatId, userId))) return;
      await db.updateMessageStatus(messageId, chatId, 'delivered');
      io.to(chatId).emit('message_status_update', {
        messageId,
        chatId,
        status: 'delivered',
      });
    });

    // 7. Message Read
    socket.on('message_read', async ({ messageId, chatId }) => {
      if (!(await db.canAccessChat(chatId, userId))) return;
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
      async ({ targetType, targetId }) => {
        const taker = (await db.findUserById(userId)) || (await db.findUserByFirebaseUid(userId));
        if (!taker) return;
        let ownerId: string | null = null;
        if (targetType === 'status') {
          ownerId = await db.getStatusOwnerId(targetId);
          if (!ownerId || ownerId === taker.id) return;
          const recorded = await db.recordStatusView(targetId, taker.id, true);
          if (!recorded.success) return;
        } else if (targetType === 'chat') {
          if (!(await db.canAccessChat(targetId, taker.id))) return;
        } else {
          return;
        }

        logger.warn(
          { targetType, targetId, ownerId, takerUsername: taker.username },
          `Screenshot alert: ${taker.username} captured ${targetType} ${targetId}`
        );

        const timestamp = new Date().toISOString();

        if (targetType === 'status') {
          // Alert story owner directly on their private channel
          const targetOwnerId = ownerId;
          if (!targetOwnerId) return;
          const alert = {
            targetType,
            targetId,
            takerUserId: taker.id,
            takerUsername: taker.username,
            takerDisplayName: taker.displayName,
            timestamp,
          };
          io.to(`user_${targetOwnerId}`).emit('screenshot_detected', alert);
          const owner = await db.findUserById(targetOwnerId);
          if (owner?.username) io.to(`user_${owner.username}`).emit('screenshot_detected', alert);
        } else if (targetType === 'chat') {
          // Broadcast to chat room so both participants see the Snapchat-style alert
          io.to(targetId).emit('screenshot_detected', {
            targetType,
            targetId,
            takerUserId: taker.id,
            takerUsername: taker.username,
            takerDisplayName: taker.displayName,
            timestamp,
          });
        }
      }
    );

    // 9. Status Published / Deleted Notification
    socket.on('status_published', async ({ statusId, userId: _pubUserId }) => {
      const publisher = (await db.findUserById(userId)) || (await db.findUserByFirebaseUid(userId));
      const ownerId = await db.getStatusOwnerId(statusId);
      if (!publisher || publisher.id !== ownerId) return;
      socket.broadcast.emit('status_feed_update', {
        userId: publisher.id,
        action: 'created',
      });
    });

    // =========================================================================
    // 10. WebRTC 1-on-1 Audio & Video Calling Signaling (Phase 5)
    // =========================================================================

    // A. Initiate Call (Sender sends offer)
    socket.on('call_initiate', async ({ callId, receiverId, type, sdp }, acknowledge) => {
      try {
        let callerUser = await db.findUserById(userId);
        if (!callerUser) {
          callerUser = await db.findUserByFirebaseUid(userId);
        }
        let receiverUser = await db.findUserById(receiverId);
        if (!receiverUser) {
          receiverUser = await db.findUserByUsername(receiverId);
        }
        if (!receiverUser) {
          receiverUser = await db.findUserByFirebaseUid(receiverId);
        }

        if (!callerUser || !receiverUser || callerUser.id === receiverUser.id || (await db.findCallById(callId))) {
          const error = 'Call participants or call ID are invalid';
          socket.emit('error', { code: 'CALL_NOT_ALLOWED', message: error });
          acknowledge?.({ ok: false, error });
          return;
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
          if (callerUser.firebaseUid) {
            void socket.join(`user_${callerUser.firebaseUid}`);
          }
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

        await db.createCallRecord(newCall, sdp);

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
        if (receiverUser?.firebaseUid && `user_${receiverUser.firebaseUid}` !== targetRoom) {
          emitter = emitter.to(`user_${receiverUser.firebaseUid}`);
        }

        emitter.emit('incoming_call', {
          callId,
          caller: callerInfo,
          type,
          sdp,
        });
        void sendIncomingCallPush(newCall);
        // The caller must not relay trickled ICE candidates until the call record
        // exists; otherwise fast candidates can arrive here and be silently dropped.
        acknowledge?.({ ok: true });
      } catch (err) {
        logger.error({ err, callId }, 'Failed to initiate call');
        acknowledge?.({ ok: false, error: 'Call could not be initialized' });
      }
    });

    const matchesUser = async (candidateId?: string | null, participantId?: string | null): Promise<boolean> => {
      if (!candidateId || !participantId) return false;
      if (candidateId === participantId) return true;
      const u =
        (await db.findUserById(candidateId)) ||
        (await db.findUserByFirebaseUid(candidateId)) ||
        (await db.findUserByUsername(candidateId));
      if (!u) return false;
      return u.id === participantId || u.firebaseUid === participantId || u.username === participantId;
    };

    // B. Answer Call (Receiver accepts offer with answer SDP)
    socket.on('call_answer', async ({ callId, callerId, sdp }) => {
      try {
        const call = await db.findCallById(callId);
        if (!call) {
          socket.emit('error', { code: 'CALL_NOT_FOUND', message: 'Call not found' });
          return;
        }
        const isReceiver = await matchesUser(userId, call.receiverId);
        const isCaller = await matchesUser(callerId, call.callerId);
        if (!isReceiver || !isCaller || call.status !== 'ringing') {
          logger.warn({ callId, userId, callerId, callReceiver: call.receiverId, callCaller: call.callerId, status: call.status }, 'call_answer authorization check failed');
          socket.emit('error', { code: 'CALL_NOT_ALLOWED', message: 'You cannot answer this call' });
          return;
        }
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

        const peerCallerId = call.callerId;
        const callerUser =
          (await db.findUserById(peerCallerId)) ||
          (await db.findUserById(callerId)) ||
          (await db.findUserByFirebaseUid(callerId)) ||
          (await db.findUserByUsername(callerId));

        let callerEmitter = io.to(`user_${callerId}`);
        if (peerCallerId && `user_${peerCallerId}` !== `user_${callerId}`) {
          callerEmitter = callerEmitter.to(`user_${peerCallerId}`);
        }
        if (callerUser?.username && `user_${callerUser.username}` !== `user_${callerId}`) {
          callerEmitter = callerEmitter.to(`user_${callerUser.username}`);
        }
        if (callerUser?.id && `user_${callerUser.id}` !== `user_${callerId}`) {
          callerEmitter = callerEmitter.to(`user_${callerUser.id}`);
        }
        if (callerUser?.firebaseUid && `user_${callerUser.firebaseUid}` !== `user_${callerId}`) {
          callerEmitter = callerEmitter.to(`user_${callerUser.firebaseUid}`);
        }

        callerEmitter.emit('call_accepted', {
          callId,
          responder,
          sdp,
        });

        logger.info({ callId, callerId: peerCallerId, responderId: effectiveResponderId }, `Call answered & connected`);
      } catch (err) {
        logger.error({ err, callId }, 'Failed to answer call');
      }
    });

    // C. Reject Call (Receiver declines call or is busy)
    socket.on('call_reject', async ({ callId, callerId, reason }) => {
      try {
        const call = await db.findCallById(callId);
        if (!call) return;
        const isReceiver = await matchesUser(userId, call.receiverId);
        const isCaller = await matchesUser(callerId, call.callerId);
        if (!isReceiver || !isCaller || call.status !== 'ringing') {
          return;
        }
        const isBusy = Boolean(reason?.toLowerCase().includes('busy'));
        await db.updateCallRecord(callId, {
          status: isBusy ? 'busy' : 'rejected',
          endedAt: new Date().toISOString(),
        });

        const peerCallerId = call.callerId;
        const callerUser =
          (await db.findUserById(peerCallerId)) ||
          (await db.findUserById(callerId)) ||
          (await db.findUserByFirebaseUid(callerId)) ||
          (await db.findUserByUsername(callerId));

        let rejectEmitter = io.to(`user_${callerId}`);
        if (peerCallerId && `user_${peerCallerId}` !== `user_${callerId}`) {
          rejectEmitter = rejectEmitter.to(`user_${peerCallerId}`);
        }
        if (callerUser?.username && `user_${callerUser.username}` !== `user_${callerId}`) {
          rejectEmitter = rejectEmitter.to(`user_${callerUser.username}`);
        }
        if (callerUser?.id && `user_${callerUser.id}` !== `user_${callerId}`) {
          rejectEmitter = rejectEmitter.to(`user_${callerUser.id}`);
        }
        if (callerUser?.firebaseUid && `user_${callerUser.firebaseUid}` !== `user_${callerId}`) {
          rejectEmitter = rejectEmitter.to(`user_${callerUser.firebaseUid}`);
        }

        rejectEmitter.emit('call_rejected', {
          callId,
          reason: reason || (isBusy ? 'User is busy on another call' : 'Call declined'),
        });

        logger.info(
          { callId, callerId: peerCallerId, rejectedBy: userId, isBusy, reason },
          isBusy ? `Call marked busy (receiver engaged on another call)` : `Call rejected`
        );
      } catch (err) {
        logger.error({ err, callId }, 'Failed to reject call');
      }
    });

    // D. ICE Candidate Exchange
    socket.on('call_ice_candidate', async ({ callId, targetUserId, candidate }) => {
      const call = await db.findCallById(callId);
      if (!call || ['ended', 'rejected', 'missed', 'busy'].includes(call.status)) return;
      const isCaller = await matchesUser(userId, call.callerId);
      const isReceiver = await matchesUser(userId, call.receiverId);
      if (!isCaller && !isReceiver) return;

      const targetMatchesPeer = isCaller
        ? await matchesUser(targetUserId, call.receiverId)
        : await matchesUser(targetUserId, call.callerId);
      if (!targetMatchesPeer) return;

      const expectedPeerId = isCaller ? call.receiverId : call.callerId;
      const targetUser =
        (await db.findUserById(expectedPeerId)) ||
        (await db.findUserById(targetUserId)) ||
        (await db.findUserByFirebaseUid(targetUserId)) ||
        (await db.findUserByUsername(targetUserId));

      let candidateEmitter = io.to(`user_${targetUserId}`);
      if (expectedPeerId && `user_${expectedPeerId}` !== `user_${targetUserId}`) {
        candidateEmitter = candidateEmitter.to(`user_${expectedPeerId}`);
      }
      if (targetUser?.username && `user_${targetUser.username}` !== `user_${targetUserId}`) {
        candidateEmitter = candidateEmitter.to(`user_${targetUser.username}`);
      }
      if (targetUser?.id && `user_${targetUser.id}` !== `user_${targetUserId}`) {
        candidateEmitter = candidateEmitter.to(`user_${targetUser.id}`);
      }
      if (targetUser?.firebaseUid && `user_${targetUser.firebaseUid}` !== `user_${targetUserId}`) {
        candidateEmitter = candidateEmitter.to(`user_${targetUser.firebaseUid}`);
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
        if (!call || ['ended', 'rejected', 'missed', 'busy'].includes(call.status)) return;
        const isCaller = await matchesUser(userId, call.callerId);
        const isReceiver = await matchesUser(userId, call.receiverId);
        if (!isCaller && !isReceiver) {
          socket.emit('error', { code: 'CALL_NOT_ALLOWED', message: 'You cannot end this call' });
          return;
        }

        const targetMatchesPeer = isCaller
          ? await matchesUser(targetUserId, call.receiverId)
          : await matchesUser(targetUserId, call.callerId);
        if (!targetMatchesPeer) {
          socket.emit('error', { code: 'CALL_NOT_ALLOWED', message: 'You cannot end this call' });
          return;
        }

        const expectedPeerId = isCaller ? call.receiverId : call.callerId;
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

        const targetUser =
          (await db.findUserById(expectedPeerId)) ||
          (await db.findUserById(targetUserId)) ||
          (await db.findUserByFirebaseUid(targetUserId)) ||
          (await db.findUserByUsername(targetUserId));

        let endEmitter = io.to(`user_${targetUserId}`);
        if (expectedPeerId && `user_${expectedPeerId}` !== `user_${targetUserId}`) {
          endEmitter = endEmitter.to(`user_${expectedPeerId}`);
        }
        if (targetUser?.username && `user_${targetUser.username}` !== `user_${targetUserId}`) {
          endEmitter = endEmitter.to(`user_${targetUser.username}`);
        }
        if (targetUser?.id && `user_${targetUser.id}` !== `user_${targetUserId}`) {
          endEmitter = endEmitter.to(`user_${targetUser.id}`);
        }
        if (targetUser?.firebaseUid && `user_${targetUser.firebaseUid}` !== `user_${targetUserId}`) {
          endEmitter = endEmitter.to(`user_${targetUser.firebaseUid}`);
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
