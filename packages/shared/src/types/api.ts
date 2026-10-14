/**
 * @file API response and error contract definitions for ChatFlow.
 */

/** Standard error codes defined in Rule 0.5. */
export type ApiErrorCode =
  | 'AUTH_REQUIRED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_FAILED'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'CONFLICT'
  | 'UNSUPPORTED_MEDIA';

/** Successful API response envelope. */
export interface ApiSuccessResponse<T> {
  ok: true;
  data: T;
}

/** Error payload details. */
export interface ApiErrorDetail {
  code: ApiErrorCode;
  message: string;
  details?: unknown;
}

/** Error API response envelope. */
export interface ApiErrorResponse {
  ok: false;
  error: ApiErrorDetail;
}

/** Unified API response type. */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Creates a standardized API success response envelope.
 * @param data The payload data.
 */
export function createSuccessResponse<T>(data: T): ApiSuccessResponse<T> {
  return { ok: true, data };
}

/**
 * Creates a standardized API error response envelope.
 * @param code The API error code.
 * @param message The human-readable error description.
 * @param details Optional structured error details or validation issues.
 */
export function createErrorResponse(
  code: ApiErrorCode,
  message: string,
  details?: unknown
): ApiErrorResponse {
  const payload: ApiErrorDetail = { code, message };
  if (details !== undefined) {
    payload.details = details;
  }
  return {
    ok: false,
    error: payload,
  };
}
