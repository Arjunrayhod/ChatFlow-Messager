/**
 * @file Zustand state store for system connectivity and backend liveness.
 */

import { create } from 'zustand';
import { checkServerHealth, HealthCheckData } from '../services/api';

export interface HealthState {
  isConnected: boolean | null;
  latencyMs: number | null;
  serverData: HealthCheckData | null;
  isLoading: boolean;
  errorMessage: string | null;
  lastChecked: string | null;
  checkHealth: () => Promise<void>;
}

export const useHealthStore = create<HealthState>((set) => ({
  isConnected: null,
  latencyMs: null,
  serverData: null,
  isLoading: false,
  errorMessage: null,
  lastChecked: null,

  /**
   * Dispatches health probe to the backend server.
   */
  checkHealth: async () => {
    set({ isLoading: true, errorMessage: null });
    const result = await checkServerHealth();

    if (result.ok) {
      set({
        isConnected: true,
        latencyMs: result.data.latencyMs,
        serverData: result.data,
        isLoading: false,
        errorMessage: null,
        lastChecked: new Date().toLocaleTimeString(),
      });
    } else {
      set({
        isConnected: false,
        latencyMs: null,
        serverData: null,
        isLoading: false,
        errorMessage: result.error.message,
        lastChecked: new Date().toLocaleTimeString(),
      });
    }
  },
}));
