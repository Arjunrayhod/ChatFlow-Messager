/**
 * @file Validated environment configuration for ChatFlow backend.
 */

import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().default('*'),
  LOG_LEVEL: z.string().default('info'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_MAX: z.coerce.number().default(100),
});

/**
 * Validates process.env against schema.
 * @returns Parsed and typed environment object.
 */
function loadEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    // Structured validation error output
    const formatted = result.error.format();
    throw new Error(`Environment validation failed: ${JSON.stringify(formatted)}`);
  }
  return result.data;
}

export const env = loadEnv();
