/**
 * @file Background Cron Worker: Ephemeral Status Cleaner.
 * Periodically deletes and archives statuses older than 24 hours.
 * Cleans up unneeded media files from disk to prevent storage exhaustion.
 * 
 * [HINGLISH GUIDE]:
 * Yeh Background Worker / Cron script hai jo har 1 ghante me run hota hai:
 * 1. 24 ghante purane statuses ko automatic database/memory se delete karta hai.
 * 2. Unke associated photo aur video files ko disk se clean karta hai.
 * Isse server ki storage hamesha optimized rehti hai!
 */

import { db } from '../services/db';
import { logger } from '../utils/logger';

export class StatusCleanerWorker {
  private timer: NodeJS.Timeout | null = null;
  private intervalMs: number;

  constructor(intervalMinutes = 60) {
    this.intervalMs = intervalMinutes * 60 * 1000;
  }

  /**
   * Starts the background cron interval.
   */
  start(): void {
    logger.info(
      { intervalMs: this.intervalMs },
      'StatusCleanerWorker: Initialized cleanup for expired stories and disappearing messages.'
    );

    // Run an initial sweep immediately on startup
    void this.runSweep();

    // Schedule periodic sweep
    this.timer = setInterval(() => {
      void this.runSweep();
    }, this.intervalMs);
  }

  /**
   * Performs the cleanup sweep.
   */
  async runSweep(): Promise<number> {
    try {
      const deletedCount = await db.deleteExpiredStatuses();
      const deletedMessages = await db.deleteExpiredMessages();
      if (deletedCount > 0) {
        logger.info(
          { deletedCount, timestamp: new Date().toISOString() },
          `StatusCleanerWorker: Successfully pruned ${deletedCount} expired statuses (>24h).`
        );
      }
      if (deletedMessages > 0) {
        logger.info({ deletedMessages, timestamp: new Date().toISOString() }, 'StatusCleanerWorker: Removed expired chat messages.');
      }
      return deletedCount + deletedMessages;
    } catch (err) {
      logger.error({ err }, 'StatusCleanerWorker: Error running status cleanup sweep');
      return 0;
    }
  }

  /**
   * Stops the worker safely during shutdown.
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info('StatusCleanerWorker: Stopped.');
    }
  }
}

export const statusCleanerWorker = new StatusCleanerWorker(5);
