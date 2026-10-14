/**
 * @file API client service for ChatFlow mobile application.
 */

import { ApiResponse, createErrorResponse } from '@chatflow/shared';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

export interface HealthCheckData {
  status: string;
  timestamp: string;
  uptime: number;
  service: string;
  version: string;
  latencyMs: number;
}

/**
 * Pings the ChatFlow server health check endpoint and measures round-trip latency.
 */
export async function checkServerHealth(): Promise<ApiResponse<HealthCheckData>> {
  const startTime = Date.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      return createErrorResponse(
        'INTERNAL_ERROR',
        `Server responded with HTTP ${response.status}`
      );
    }

    const payload = await response.json();
    if (payload && payload.ok && payload.data) {
      return {
        ok: true,
        data: {
          ...payload.data,
          latencyMs,
        },
      };
    }

    return createErrorResponse(
      'INTERNAL_ERROR',
      'Malformed health check payload received from server'
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Network request failed';
    return createErrorResponse('INTERNAL_ERROR', message);
  }
}
