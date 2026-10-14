/**
 * @file Structured Pino logging configuration for ChatFlow server.
 */

import pino from 'pino';
import { env } from '../config/env';

/** Application-wide structured pino logger instance. */
export const logger = pino({
  level: env.LOG_LEVEL,
  transport:
    env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
});
