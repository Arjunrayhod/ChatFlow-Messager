/**
 * @file Health check route providing system liveness and uptime status.
 */

import { Router, Request, Response } from 'express';
import { createSuccessResponse } from '@chatflow/shared';

export const healthRouter: Router = Router();

/**
 * GET /health - Unauthenticated health probe.
 */
healthRouter.get('/', (_req: Request, res: Response) => {
  res.status(200).json(
    createSuccessResponse({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      service: 'chatflow-server',
      version: '1.0.0',
    })
  );
});
