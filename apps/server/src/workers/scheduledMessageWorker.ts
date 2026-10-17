import { Server as SocketIOServer } from 'socket.io';
import { db } from '../services/db';
import { logger } from '../utils/logger';

/** Sends due messages from durable storage so server restarts do not discard timers. */
export class ScheduledMessageWorker {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  start(io: SocketIOServer<any, any, any, any>): void {
    if (this.timer) return;
    const sweep = () => void this.runSweep(io);
    sweep();
    this.timer = setInterval(sweep, 15_000);
    logger.info('ScheduledMessageWorker: Polling for due messages every 15 seconds.');
  }

  private async runSweep(io: SocketIOServer<any, any, any, any>): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const due = await db.claimDueScheduledMessages();
      for (const item of due) {
        try {
          if (!(await db.canAccessChat(item.chatId, item.senderId))) {
            await db.finishScheduledMessage(item.id, null, true);
            continue;
          }
          const message = await db.saveMessage(item.chatId, item.senderId, item.content);
          io.to(item.chatId).emit('message_new', { message });
          await db.finishScheduledMessage(item.id, message.id);
        } catch (err) {
          logger.error({ err, scheduledMessageId: item.id }, 'ScheduledMessageWorker: Failed to send scheduled message.');
          await db.finishScheduledMessage(item.id, null, true);
        }
      }
    } catch (err) {
      logger.error({ err }, 'ScheduledMessageWorker: Sweep failed.');
    } finally {
      this.running = false;
    }
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

export const scheduledMessageWorker = new ScheduledMessageWorker();
