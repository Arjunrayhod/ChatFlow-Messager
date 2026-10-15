/**
 * @file Health check route providing system liveness and uptime status.
 * 
 * [HINGLISH GUIDE]:
 * Yeh public health probe endpoint hai (/health).
 * Frontend ya Docker/Kubernetes check karta hai ki backend zinda hai ya nahi.
 * Iske liye kisi login ya token ki zaroorat nahi hoti.
 */

import { Router, Request, Response } from 'express';
import { createSuccessResponse } from '@chatflow/shared';

export const healthRouter: Router = Router();

/**
 * GET /health - Unauthenticated health probe.
 * [HINGLISH]: Server uptime aur status return karta hai.
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
