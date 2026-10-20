/**
 * @file API client service for ChatFlow mobile application.
 */

import {
  ApiResponse,
  createErrorResponse,
  StatusItem,
  StatusViewer,
  UserStoryGroup,
  CreateStatusDto,
  CallRecord,
  ChatExpense,
  ChatTask,
  ScheduledChatMessage,
} from '@chatflow/shared';

import { Platform } from 'react-native';

export const DEFAULT_PRODUCTION_API_URL = 'https://chatflow-backend-1s66.onrender.com';

export function getApiBaseUrl(): string {
  const configuredUrl = process.env.EXPO_PUBLIC_API_URL;
  const browserHost = typeof window !== 'undefined' ? window.location?.hostname : undefined;
  const isLocalHost = Boolean(browserHost && (browserHost === 'localhost' || browserHost === '127.0.0.1'));
  const browserIsRemote = Boolean(browserHost && !isLocalHost);
  const configIsLocal = Boolean(configuredUrl && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(configuredUrl));
  const isStaleDuckDns = Boolean(configuredUrl && configuredUrl.includes('duckdns.org'));

  // A production browser must use the explicitly configured API host. Ignore a local .env URL
  // or deprecated AWS duckdns endpoint, then preserve the LAN-development fallback.
  if (configuredUrl && !isStaleDuckDns && !(Platform.OS === 'web' && browserIsRemote && configIsLocal)) {
    return configuredUrl.replace(/\/$/, '');
  }

  // 1. If running on remote web in a browser (like Cloudflare Pages or custom domain)
  if (Platform.OS === 'web' && browserIsRemote) {
    return DEFAULT_PRODUCTION_API_URL;
  }

  // 2. If running on web in a browser (localhost on PC)
  if (Platform.OS === 'web' && isLocalHost) {
    const protocol = (typeof window !== 'undefined' && window.location?.protocol) || 'http:';
    return `${protocol}//${browserHost}:4000`;
  }

  // 3. Fallback to production AWS EC2 endpoint
  return DEFAULT_PRODUCTION_API_URL;
}

export const API_BASE_URL = {
  toString: () => getApiBaseUrl(),
  valueOf: () => getApiBaseUrl(),
} as unknown as string;

/**
 * Resilient fetch wrapper with a configurable timeout (default 12 seconds).
 * Prevents mobile UI from hanging indefinitely on stalled network connections.
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs = 12000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(input, {
      ...init,
      signal: init?.signal || controller.signal,
    });
    return response;
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error('Connection timed out. Please check your internet or backend server.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolves a media URL from backend to ensure cross-origin and LAN mobile accessibility.
 */
export function resolveMediaUrl(url?: string | null): string {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;

  const base = getApiBaseUrl();
  if (url.startsWith('/')) {
    return `${base}${url}`;
  }

  // Handle cases where backend recorded http://localhost:4000 but client is on LAN IP
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
    const currentHost = window.location.hostname;
    if (currentHost && currentHost !== 'localhost' && currentHost !== '127.0.0.1') {
      if (url.includes('localhost:4000')) {
        return url.replace('localhost:4000', `${currentHost}:4000`);
      }
      if (url.includes('127.0.0.1:4000')) {
        return url.replace('127.0.0.1:4000', `${currentHost}:4000`);
      }
    }
  }

  return url;
}

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

    const response = await fetchWithTimeout(`${API_BASE_URL}/health`, {
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
  UpdateUserDto,
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
    const response = await fetchWithTimeout(
      `${API_BASE_URL}/api/users/check-username?username=${encodeURIComponent(username)}`,
      {
        headers: { Accept: 'application/json' },
      },
      8000
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
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/users/sync`, {
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
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/users/onboard`, {
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
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/users/me`, {
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
 * Updates editable profile attributes (@username, displayName, bio, avatarUrl).
 */
export async function updateUserProfile(
  token: string,
  dto: UpdateUserDto
): Promise<ApiResponse<User>> {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/users/me`, {
      method: 'PATCH',
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
 * Searches users by @username or display name.
 */
export async function searchUsers(
  token: string,
  query: string
): Promise<ApiResponse<UserProfile[]>> {
  try {
    const response = await fetchWithTimeout(
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
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/contacts`, {
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
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/contacts`, {
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
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/contacts/${contactUserId}`, {
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
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/messages/${chatId}`, {
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

export async function getChatPreferences(token: string, chatId: string): Promise<ApiResponse<{ disappearingSeconds: number }>> {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/messages/${encodeURIComponent(chatId)}/preferences`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }, cache: 'no-store',
    });
    return await response.json();
  } catch (error: unknown) {
    return createErrorResponse('INTERNAL_ERROR', error instanceof Error ? error.message : 'Could not load chat settings');
  }
}

export async function setChatDisappearing(token: string, chatId: string, seconds: number): Promise<ApiResponse<{ disappearingSeconds: number }>> {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/messages/${encodeURIComponent(chatId)}/preferences`, {
      method: 'PUT', headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ seconds }),
    });
    return await response.json();
  } catch (error: unknown) {
    return createErrorResponse('INTERNAL_ERROR', error instanceof Error ? error.message : 'Could not update chat settings');
  }
}

export async function editChatMessage(token: string, chatId: string, messageId: string, content: string): Promise<ApiResponse<ChatMessage>> {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/messages/${encodeURIComponent(chatId)}/${encodeURIComponent(messageId)}`, {
      method: 'PUT', headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ content }),
    });
    return await response.json();
  } catch (error: unknown) {
    return createErrorResponse('INTERNAL_ERROR', error instanceof Error ? error.message : 'Could not edit message');
  }
}

export async function setMessagePinned(token: string, chatId: string, messageId: string, pinned: boolean): Promise<ApiResponse<{ messageId: string; pinned: boolean }>> {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/messages/${encodeURIComponent(chatId)}/${encodeURIComponent(messageId)}/pin`, {
      method: 'PUT', headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ pinned }),
    });
    return await response.json();
  } catch (error: unknown) {
    return createErrorResponse('INTERNAL_ERROR', error instanceof Error ? error.message : 'Could not pin message');
  }
}

export async function setMessageHidden(token: string, chatId: string, messageId: string, hidden: boolean): Promise<ApiResponse<{ messageId: string; hidden: boolean }>> {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/messages/${encodeURIComponent(chatId)}/${encodeURIComponent(messageId)}/hide`, {
      method: 'PUT', headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ hidden }),
    });
    return await response.json();
  } catch (error: unknown) {
    return createErrorResponse('INTERNAL_ERROR', error instanceof Error ? error.message : 'Could not update message visibility');
  }
}

async function chatFeatureRequest<T>(token: string, path: string, method = 'GET', body?: unknown): Promise<ApiResponse<T>> {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/messages/${path}`, {
      method,
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: 'no-store',
    });
    return await response.json();
  } catch (error: unknown) {
    return createErrorResponse('INTERNAL_ERROR', error instanceof Error ? error.message : 'Chat action failed');
  }
}

const chatPath = (chatId: string, suffix: string) => `${encodeURIComponent(chatId)}/${suffix}`;
export const getChatExpenses = (token: string, chatId: string) => chatFeatureRequest<ChatExpense[]>(token, chatPath(chatId, 'expenses'));
export const createChatExpense = (token: string, chatId: string, expense: { title: string; amount: number; paidBy: string; splitBetween: string[] }) =>
  chatFeatureRequest<ChatExpense>(token, chatPath(chatId, 'expenses'), 'POST', expense);
export const getChatTasks = (token: string, chatId: string) => chatFeatureRequest<ChatTask[]>(token, chatPath(chatId, 'tasks'));
export const createChatTask = (token: string, chatId: string, task: { title: string; body?: string | null; assignedTo?: string | null }) =>
  chatFeatureRequest<ChatTask>(token, chatPath(chatId, 'tasks'), 'POST', task);
export const setChatTaskCompleted = (token: string, chatId: string, taskId: string, completed: boolean) =>
  chatFeatureRequest<ChatTask>(token, `${chatPath(chatId, 'tasks')}/${encodeURIComponent(taskId)}`, 'PUT', { completed });
export const scheduleChatMessage = (token: string, chatId: string, content: string, sendAt: string) =>
  chatFeatureRequest<ScheduledChatMessage>(token, chatPath(chatId, 'scheduled'), 'POST', { content, sendAt });

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
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/upload`, {
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

/**
 * Fetches active 24-hour status stories for current user and contacts.
 */
export async function fetchStatusFeed(
  token: string
): Promise<ApiResponse<{ myStories: StatusItem[]; contactStories: UserStoryGroup[] }>> {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/status/feed`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    return await response.json();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch stories feed';
    return createErrorResponse('INTERNAL_ERROR', message);
  }
}

/**
 * Creates a text status update.
 */
export async function createTextStatus(
  token: string,
  dto: CreateStatusDto
): Promise<ApiResponse<StatusItem>> {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/status/create`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(dto),
    });
    return await response.json();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create status';
    return createErrorResponse('INTERNAL_ERROR', message);
  }
}

export interface UploadStatusMediaPayload {
  fileName: string;
  mimeType: string;
  data: string;
  mediaType: 'image' | 'video';
  caption?: string | null;
  backgroundColor?: string | null;
}

/**
 * Uploads uncompressed HD photo/video as a status update.
 */
export async function uploadStatusMedia(
  token: string,
  payload: UploadStatusMediaPayload
): Promise<ApiResponse<StatusItem>> {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/status/upload`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    return await response.json();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to upload status';
    return createErrorResponse('INTERNAL_ERROR', message);
  }
}

/**
 * Records a view on a status story (and tracks if viewer screenshotted).
 */
export async function recordStatusView(
  token: string,
  statusId: string,
  hasScreenshotted = false
): Promise<ApiResponse<{ success: boolean; viewersCount: number }>> {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/status/${statusId}/view`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ hasScreenshotted }),
    });
    return await response.json();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to record view';
    return createErrorResponse('INTERNAL_ERROR', message);
  }
}

/**
 * Fetches viewers list for a user's own status story.
 */
export async function fetchStatusViewers(
  token: string,
  statusId: string
): Promise<ApiResponse<StatusViewer[]>> {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/status/${statusId}/viewers`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    return await response.json();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch viewers';
    return createErrorResponse('INTERNAL_ERROR', message);
  }
}

/**
 * Manually deletes a status story before 24h.
 */
export async function deleteStatus(
  token: string,
  statusId: string
): Promise<ApiResponse<{ success: boolean; id: string }>> {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/status/${statusId}`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    return await response.json();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete status';
    return createErrorResponse('INTERNAL_ERROR', message);
  }
}

/**
 * Explicit Snapchat-style screenshot alert webhook.
 */
export async function reportScreenshotAlert(
  token: string,
  statusId: string
): Promise<ApiResponse<{ alertRecorded: boolean; takerUsername: string; timestamp: string }>> {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/status/${statusId}/screenshot-alert`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    return await response.json();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to report screenshot';
    return createErrorResponse('INTERNAL_ERROR', message);
  }
}

/**
 * Retrieves call history logs for the authenticated user.
 */
export async function getCalls(token: string): Promise<ApiResponse<CallRecord[]>> {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/calls`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    return await response.json();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch call history';
    return createErrorResponse('INTERNAL_ERROR', message);
  }
}

/**
 * Deletes a single call record.
 */
export async function deleteCallRecord(
  token: string,
  callId: string
): Promise<ApiResponse<{ success: boolean; deletedId: string }>> {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/calls/${callId}`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    return await response.json();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete call';
    return createErrorResponse('INTERNAL_ERROR', message);
  }
}

/**
 * Clears all call history for the authenticated user.
 */
export async function clearCallHistory(
  token: string
): Promise<ApiResponse<{ success: boolean; cleared: boolean }>> {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/calls`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    return await response.json();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to clear call history';
    return createErrorResponse('INTERNAL_ERROR', message);
  }
}

export interface IncomingCallOffer {
  callId: string;
  caller: import('@chatflow/shared').CallParticipant;
  type: import('@chatflow/shared').CallType;
  sdp: unknown;
}

export async function getIncomingCallOffer(token: string, callId: string): Promise<ApiResponse<IncomingCallOffer>> {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/calls/${encodeURIComponent(callId)}/offer`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    return await response.json();
  } catch (error: unknown) {
    return createErrorResponse('INTERNAL_ERROR', error instanceof Error ? error.message : 'Could not load incoming call');
  }
}

export async function registerPushToken(token: string, pushToken: string, platform: 'ios' | 'android'): Promise<void> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/users/push-token`, {
    method: 'PUT',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ token: pushToken, platform }),
  });
  if (!response.ok) throw new Error(`Push token registration failed (${response.status})`);
}

export async function unregisterPushToken(token: string, pushToken: string): Promise<void> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/users/push-token`, {
    method: 'DELETE',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ token: pushToken }),
  });
  if (!response.ok) throw new Error(`Push token removal failed (${response.status})`);
}
