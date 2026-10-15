/**
 * @file Validated environment configuration for ChatFlow backend.
 * 
 * [HINGLISH GUIDE]:
 * Yeh file .env file se variables load karti hai aur Zod schema ke zariye
 * validate karti hai. Agar koi required variable missing ya galat type ka ho,
 * to server error de kar stop ho jayega.
 * Default PORT 4000 set hai. Firebase aur Supabase dev mode me optional hain.
 */

import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

// [HINGLISH]: Server ke liye zaroori environment variables ka schema
const envSchema = z.object({
  PORT: z.coerce.number().default(4000), // Server kis port pe chalega
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().default('*'), // Kaha se requests allow karni hai
  LOG_LEVEL: z.string().default('info'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000), // 1 minute window
  RATE_LIMIT_MAX: z.coerce.number().default(100), // Max 100 requests per window
  FIREBASE_PROJECT_ID: z.string().optional(), // Firebase auth ke liye
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  SUPABASE_URL: z.string().optional(), // Supabase Postgres DB ke liye
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
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
