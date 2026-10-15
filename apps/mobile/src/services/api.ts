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

import {
  User,
  UserProfile,
  Contact,
  ChatMessage,
  CreateUserDto,
  SyncUserResponse,
  CheckUsernameResponse,
  RemoveContactResponse,
} from '@chatflow/shared';

/**
 * Checks if a username is available in real-time.
 */
export async function checkUsernameAvailability(
  username: string
): Promise<ApiResponse<CheckUsernameResponse>> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/users/check-username?username=${encodeURIComponent(username)}`,
      {
        headers: { Accept: 'application/json' },
      }
    );
    const data = await response.json();
    return data;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Network request failed';
    return createErrorResponse('INTERNAL_ERROR', message);
  }
}

/**
 * Synchronizes user authentication session and checks onboarding status.
 */
export async function syncUserSession(
  token: string
): Promise<ApiResponse<SyncUserResponse>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/users/sync`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await response.json();
    return data;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Network request failed';
    return createErrorResponse('INTERNAL_ERROR', message);
  }
}

/**
 * Completes profile onboarding by submitting display name and unique @username.
 */
export async function onboardUserProfile(
  token: string,
  dto: CreateUserDto
): Promise<ApiResponse<User>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/users/onboard`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(dto),
    });
    const data = await response.json();
    return data;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Network request failed';
    return createErrorResponse('INTERNAL_ERROR', message);
  }
}

/**
 * Retrieves the currently authenticated user's profile.
 */
export async function getCurrentUserProfile(
  token: string
): Promise<ApiResponse<User>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/users/me`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await response.json();
    return data;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Network request failed';
    return createErrorResponse('INTERNAL_ERROR', message);
  }
}

/**
 * Searches users by @username or display name.
 */
export async function searchUsers(
  token: string,
  query: string
): Promise<ApiResponse<UserProfile[]>> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/users/search?q=${encodeURIComponent(query)}`,
      {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }
    );
    const data = await response.json();
    return data;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Network request failed';
    return createErrorResponse('INTERNAL_ERROR', message);
  }
}

/**
 * Retrieves the saved contact list for the authenticated user.
 */
export async function getContacts(
  token: string
): Promise<ApiResponse<Contact[]>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/contacts`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    });
    const data = await response.json();
    return data;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Network request failed';
    return createErrorResponse('INTERNAL_ERROR', message);
  }
}

/**
 * Adds a new contact by their unique @username.
 */
export async function addContact(
  token: string,
  username: string,
  nickname?: string
): Promise<ApiResponse<Contact>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/contacts`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ username, nickname }),
    });
    const data = await response.json();
    return data;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Network request failed';
    return createErrorResponse('INTERNAL_ERROR', message);
  }
}

/**
 * Removes a contact relationship.
 */
export async function removeContact(
  token: string,
  contactUserId: string
): Promise<ApiResponse<RemoveContactResponse>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/contacts/${contactUserId}`, {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await response.json();
    return data;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Network request failed';
    return createErrorResponse('INTERNAL_ERROR', message);
  }
}

/**
 * Fetches message history for a conversation.
 */
export async function getMessageHistory(
  token: string,
  chatId: string
): Promise<ApiResponse<ChatMessage[]>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/messages/${chatId}`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    });
    const data = await response.json();
    return data;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Network request failed';
    return createErrorResponse('INTERNAL_ERROR', message);
  }
}

export interface UploadMediaPayload {
  fileName: string;
  mimeType: string;
  data: string;
  isHD?: boolean;
  width?: number;
  height?: number;
  duration?: number;
}

export interface UploadMediaResponse {
  url: string;
  fileName: string;
  savedFileName: string;
  mimeType: string;
  fileSize: number;
  isHD: boolean;
  width?: number | null;
  height?: number | null;
  duration?: number | null;
}

/**
 * Uploads original uncompressed HD photo or video to ChatFlow server.
 */
export async function uploadMedia(
  payload: UploadMediaPayload
): Promise<ApiResponse<UploadMediaResponse>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/upload`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    return data;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Upload failed';
    return createErrorResponse('INTERNAL_ERROR', message);
  }
}


