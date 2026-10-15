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

/**
 * Boots the HTTP server, attaches Socket.IO, and registers shutdown hooks.
 * [HINGLISH]: HTTP server aur Socket.IO dono ko port 4000 par start karta hai.
 */
function startServer(): void {
  const app = createApp();
  const httpServer = http.createServer(app);

  // Initialize Socket.IO with CORS
  const io = initSocketServer(httpServer, env.CORS_ORIGIN);

  const server = httpServer.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT, environment: env.NODE_ENV },
      `ChatFlow API Server & Socket.IO started successfully on port ${env.PORT}`
    );
  });

  const handleShutdown = (signal: string) => {
    logger.info({ signal }, 'Gracefully shutting down ChatFlow API & Socket server...');
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
