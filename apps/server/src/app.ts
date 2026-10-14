/**
 * @file Main Express application initialization and middleware setup.
 */

import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { createErrorResponse } from '@chatflow/shared';
import { env } from './config/env';
import { logger } from './utils/logger';
import { healthRouter } from './routes/health';
import { usersRouter } from './routes/users';
import { notFoundHandler } from './middlewares/not-found';
import { errorHandler } from './middlewares/error-handler';

/**
 * Creates and configures the Express application instance.
 */
export function createApp(): Application {
  const app = express();

  // Security headers
  app.use(helmet());

  // Cross-Origin Resource Sharing
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    })
  );

  // Body parsers
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Request logger
  app.use((req, res, next) => {
    if (req.url === '/health') {
      next();
      return;
    }
    const startTime = Date.now();
    res.on('finish', () => {
      logger.info(
        {
          method: req.method,
          url: req.originalUrl,
          statusCode: res.statusCode,
          durationMs: Date.now() - startTime,
        },
        `${req.method} ${req.originalUrl} - ${res.statusCode}`
      );
    });
    next();
  });

  // Global rate limiter (RULE 0.6: 100 req/min)
  const limiter = rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json(
        createErrorResponse(
          'RATE_LIMITED',
          'Too many requests, please slow down.'
        )
      );
    },
  });
  app.use(limiter);

  // Routes
  app.use('/health', healthRouter);
  app.use('/api/users', usersRouter);

  // Fallthrough 404 & error handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
