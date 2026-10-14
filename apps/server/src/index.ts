/**
 * @file Main server process launcher.
 */

import { createApp } from './app';
import { env } from './config/env';
import { logger } from './utils/logger';

/**
 * Boots the HTTP server and attaches shutdown hooks.
 */
function startServer(): void {
  const app = createApp();

  const server = app.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT, environment: env.NODE_ENV },
      `ChatFlow API Server started successfully on port ${env.PORT}`
    );
  });

  const handleShutdown = (signal: string) => {
    logger.info({ signal }, 'Gracefully shutting down ChatFlow API server...');
    server.close(() => {
      logger.info('HTTP server closed cleanly.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
}

startServer();
