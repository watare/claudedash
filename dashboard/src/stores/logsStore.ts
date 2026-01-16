/**
 * Logs Zustand Store
 * Manages log state for the Log Viewer Panel
 * Story 4.5: Log Viewer Panel
 */

import { create } from 'zustand';
import { apiFetch } from '@/services/api';
import type { LogEntry, LogsResponse } from '@/types/logs';

interface LogsState {
  logs: Map<string, LogEntry[]>;
  isLoading: boolean;
  error: string | null;
  autoScroll: boolean;

  fetchLogs: (agentId: string, options?: { limit?: number; offset?: number; level?: string }) => Promise<void>;
  appendLog: (agentId: string, log: LogEntry) => void;
  clearLogs: (agentId?: string) => void;
  setAutoScroll: (enabled: boolean) => void;
  clearError: () => void;
}

// Buffer for rapid log updates (max 10 updates per second to UI)
const logBuffer: Map<string, LogEntry[]> = new Map();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

export const useLogsStore = create<LogsState>((set) => ({
  logs: new Map(),
  isLoading: false,
  error: null,
  autoScroll: true,

  fetchLogs: async (agentId, options = {}) => {
    set({ isLoading: true, error: null });
    try {
      const params = new URLSearchParams({
        agentId,
        limit: String(options.limit || 500),
        offset: String(options.offset || 0),
      });
      if (options.level) {
        params.set('level', options.level);
      }

      const response = await apiFetch(`/api/logs?${params}`);

      if (!response.ok) {
        throw new Error('Failed to fetch logs');
      }

      const data: LogsResponse = await response.json();

      // Normalize logs to ensure they have level field
      const normalizedLogs = data.logs.map((log) => ({
        ...log,
        level: log.level || 'info',
        agentId,
      }));

      set((state) => {
        const newLogs = new Map(state.logs);
        newLogs.set(agentId, normalizedLogs);
        return { logs: newLogs, isLoading: false };
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch logs',
        isLoading: false,
      });
    }
  },

  appendLog: (agentId, log) => {
    // Buffer logs to avoid too frequent updates
    if (!logBuffer.has(agentId)) {
      logBuffer.set(agentId, []);
    }
    logBuffer.get(agentId)!.push({
      ...log,
      level: log.level || 'info',
      agentId,
    });

    // Flush buffered logs every 100ms (max 10 updates/sec)
    if (!flushTimer) {
      flushTimer = setTimeout(() => {
        flushTimer = null;

        set((state) => {
          const newLogs = new Map(state.logs);

          for (const [bufferedAgentId, bufferedLogs] of logBuffer.entries()) {
            const existingLogs = newLogs.get(bufferedAgentId) || [];
            // Keep last 2000 logs to prevent memory issues
            const combinedLogs = [...existingLogs, ...bufferedLogs].slice(-2000);
            newLogs.set(bufferedAgentId, combinedLogs);
          }

          logBuffer.clear();
          return { logs: newLogs };
        });
      }, 100);
    }
  },

  clearLogs: (agentId) => {
    set((state) => {
      const newLogs = new Map(state.logs);
      if (agentId) {
        newLogs.delete(agentId);
      } else {
        newLogs.clear();
      }
      return { logs: newLogs };
    });
  },

  setAutoScroll: (enabled) => set({ autoScroll: enabled }),

  clearError: () => set({ error: null }),
}));
