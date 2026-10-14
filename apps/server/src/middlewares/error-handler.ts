/**
 * @file Global express error handling middleware.
 * Enforces Error Handling Contract (RULE 0.5).
 */

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ApiErrorCode, createErrorResponse } from '@chatflow/shared';
import { logger } from '../utils/logger';

/** Custom application error carrying standard ApiErrorCode. */
export class AppError extends Error {
  public readonly code: ApiErrorCode;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(code: ApiErrorCode, message: string, statusCode = 400, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Express error handling middleware returning structured error envelope.
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    logger.warn({ err, code: err.code }, `AppError encountered: ${err.message}`);
    res.status(err.statusCode).json(createErrorResponse(err.code, err.message, err.details));
    return;
  }

  if (err instanceof ZodError) {
    logger.warn({ issues: err.issues }, 'Validation failed on request payload');
    res.status(400).json(
      createErrorResponse(
        'VALIDATION_FAILED',
        'Request data failed schema validation',
        err.flatten()
      )
    );
    return;
  }

  logger.error({ err }, `Unhandled internal error: ${err.message}`);
  res.status(500).json(
    createErrorResponse(
      'INTERNAL_ERROR',
      'An unexpected internal server error occurred'
    )
  );
}
