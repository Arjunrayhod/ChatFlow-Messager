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
import path from 'path';
import { healthRouter } from './routes/health';
import { usersRouter } from './routes/users';
import { contactsRouter } from './routes/contacts';
import { messagesRouter } from './routes/messages';
import { uploadRouter } from './routes/upload';
import { statusRouter } from './routes/status';
import { notFoundHandler } from './middlewares/not-found';
import { errorHandler } from './middlewares/error-handler';

/**
 * Creates and configures the Express application instance.
 * 
 * [HINGLISH GUIDE]:
 * Yeh function Express app ko create karta hai aur sare security,
 * logging, aur routing middlewares attach karta hai.
 * Naya route add karna ho to 'app.use('/api/...', myRouter)' yahan add karein.
 */
export function createApp(): Application {
  const app = express();

  // [HINGLISH]: Helmet basic security headers automatically inject karta hai
  // Security headers
  app.use(helmet());

  // Disable ETags to prevent empty 304 responses in client SPA fetch
  app.set('etag', false);

  // [HINGLISH]: CORS frontend ko backend se API call karne deta hai
  // Cross-Origin Resource Sharing
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    })
  );

  // No-cache headers for dynamic API endpoints
  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
  });

  // [HINGLISH]: Incoming JSON body aur forms ko parse karne ke liye (100MB payload limit for uncompressed HD media)
  // Body parsers
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ extended: true, limit: '100mb' }));

  // Serve uploaded original HD photos and videos statically
  app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

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

  // [HINGLISH]: Rate limiting - brute-force attacks se bachane ke liye (100 req/min)
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

  // [HINGLISH]: API Routes mapping:
  // - /health: Server up hai ya nahi check karta hai
  // - /api/users: User profile, @username search, sync aur onboarding
  // - /api/contacts: User ke contacts save aur retrieve karna
  // - /api/messages: Message history aur REST fallback
  // - /api/upload: Original HD media file uploads
  // Routes
  app.use('/health', healthRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/contacts', contactsRouter);
  app.use('/api/messages', messagesRouter);
  app.use('/api/upload', uploadRouter);
  app.use('/api/status', statusRouter);

  // [HINGLISH]: Unmatched routes ke liye 404 handler aur common error handler
  // Fallthrough 404 & error handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
