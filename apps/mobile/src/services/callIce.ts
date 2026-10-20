import { getApiBaseUrl, fetchWithTimeout } from './api';

export interface CallIceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

const fallbackIceServers: CallIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:stun.services.mozilla.com:3478' },
];

/** Fetches short-lived TURN credentials without ever embedding the shared secret in the app. */
export async function fetchCallIceServers(token: string): Promise<CallIceServer[]> {
  try {
    const response = await fetchWithTimeout(`${getApiBaseUrl()}/api/calls/ice-servers`, {
      headers: { Authorization: `Bearer ${token}` },
    }, 6000);
    if (!response.ok) return fallbackIceServers;
    const result = await response.json();
    const servers = result?.ok ? result.data?.iceServers : null;
    return Array.isArray(servers) && servers.length ? servers : fallbackIceServers;
  } catch (error) {
    console.warn('[Call] Could not fetch relay configuration; using STUN only.', error);
    return fallbackIceServers;
  }
}
