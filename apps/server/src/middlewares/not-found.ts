/**
 * @file 404 Route Not Found handler.
 */

import { Request, Response } from 'express';
import { createErrorResponse } from '@chatflow/shared';

/**
 * Handles all unmatched routes and returns standard NOT_FOUND error envelope.
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json(
    createErrorResponse(
      'NOT_FOUND',
      `Cannot ${req.method} ${req.originalUrl}`
    )
  );
}
