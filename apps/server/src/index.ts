/**
 * @file Main server process launcher.
 * 
 * [HINGLISH GUIDE]:
 * Yeh server ka main entry point hai. Yahan se Express app boot hoti hai.
 * Agar aapko server port badalna ho to .env me PORT=XXXX change karein.
 */

import http from 'http';
import { createApp } from './app';
import { env } from './config/env';
import { logger } from './utils/logger';
import { initSocketServer } from './socket';
import { statusCleanerWorker } from './workers/statusCleaner';
import { scheduledMessageWorker } from './workers/scheduledMessageWorker';

/**
 * Boots the HTTP server, attaches Socket.IO, and registers shutdown hooks.
 * [HINGLISH]: HTTP server aur Socket.IO dono ko port 4000 par start karta hai.
 */
function startServer(): void {
  const app = createApp();
  const httpServer = http.createServer(app);

  // Initialize Socket.IO with CORS
  const io = initSocketServer(httpServer, env.CORS_ORIGIN);
  scheduledMessageWorker.start(io);

  // Start background 24-hour status expiration cleaner worker
  statusCleanerWorker.start();

  const server = httpServer.listen(env.PORT, '0.0.0.0', () => {
    logger.info(
      { port: env.PORT, host: '0.0.0.0', environment: env.NODE_ENV },
      `ChatFlow API Server & Socket.IO started successfully on http://0.0.0.0:${env.PORT}`
    );
  });

  const handleShutdown = (signal: string) => {
    logger.info({ signal }, 'Gracefully shutting down ChatFlow API & Socket server...');
    statusCleanerWorker.stop();
    scheduledMessageWorker.stop();
    io.close();
    server.close(() => {
      logger.info('HTTP server closed cleanly.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
}

startServer();
