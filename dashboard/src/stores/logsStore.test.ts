import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useLogsStore } from './logsStore';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('logsStore', () => {
  beforeEach(() => {
    // Reset store state
    useLogsStore.setState({
      logs: new Map(),
      isLoading: false,
      error: null,
      autoScroll: true,
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('should have empty logs map', () => {
      const { logs } = useLogsStore.getState();
      expect(logs.size).toBe(0);
    });

    it('should have autoScroll enabled by default', () => {
      const { autoScroll } = useLogsStore.getState();
      expect(autoScroll).toBe(true);
    });

    it('should not be loading initially', () => {
      const { isLoading } = useLogsStore.getState();
      expect(isLoading).toBe(false);
    });

    it('should have no error initially', () => {
      const { error } = useLogsStore.getState();
      expect(error).toBeNull();
    });
  });

  describe('fetchLogs', () => {
    it('should set loading state while fetching', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ logs: [], total: 0 }),
      });

      const promise = useLogsStore.getState().fetchLogs('agent-1');
      expect(useLogsStore.getState().isLoading).toBe(true);

      await promise;
      expect(useLogsStore.getState().isLoading).toBe(false);
    });

    it('should store fetched logs by agentId', async () => {
      const mockLogs = [
        { id: '1', timestamp: '2026-01-16T12:00:00Z', message: 'Test log', level: 'info' },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ logs: mockLogs, total: 1 }),
      });

      await useLogsStore.getState().fetchLogs('agent-1');

      const { logs } = useLogsStore.getState();
      expect(logs.has('agent-1')).toBe(true);
      expect(logs.get('agent-1')).toHaveLength(1);
    });

    it('should set error on fetch failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
      });

      await useLogsStore.getState().fetchLogs('agent-1');

      const { error, isLoading } = useLogsStore.getState();
      expect(error).toBe('Failed to fetch logs');
      expect(isLoading).toBe(false);
    });

    it('should normalize log level to info if missing', async () => {
      const mockLogs = [
        { id: '1', timestamp: '2026-01-16T12:00:00Z', message: 'Test log' },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ logs: mockLogs, total: 1 }),
      });

      await useLogsStore.getState().fetchLogs('agent-1');

      const logs = useLogsStore.getState().logs.get('agent-1');
      expect(logs?.[0].level).toBe('info');
    });
  });

  describe('appendLog', () => {
    it('should add log to agent logs', async () => {
      vi.useFakeTimers();

      const log = {
        id: '1',
        timestamp: '2026-01-16T12:00:00Z',
        message: 'New log',
        level: 'info' as const,
      };

      useLogsStore.getState().appendLog('agent-1', log);

      // Fast-forward the buffer flush timer
      vi.advanceTimersByTime(150);

      const logs = useLogsStore.getState().logs.get('agent-1');
      expect(logs).toHaveLength(1);
      expect(logs?.[0].message).toBe('New log');

      vi.useRealTimers();
    });

    it('should normalize level to info if missing', async () => {
      vi.useFakeTimers();

      const log = {
        id: '1',
        timestamp: '2026-01-16T12:00:00Z',
        message: 'New log',
      } as any;

      useLogsStore.getState().appendLog('agent-1', log);
      vi.advanceTimersByTime(150);

      const logs = useLogsStore.getState().logs.get('agent-1');
      expect(logs?.[0].level).toBe('info');

      vi.useRealTimers();
    });

    it('should buffer multiple rapid logs', async () => {
      vi.useFakeTimers();

      // Add multiple logs quickly
      for (let i = 0; i < 5; i++) {
        useLogsStore.getState().appendLog('agent-1', {
          id: String(i),
          timestamp: new Date().toISOString(),
          message: `Log ${i}`,
          level: 'info',
        });
      }

      // Before flush, state should not have all logs
      vi.advanceTimersByTime(50);

      // After flush timer
      vi.advanceTimersByTime(100);

      const logs = useLogsStore.getState().logs.get('agent-1');
      expect(logs).toHaveLength(5);

      vi.useRealTimers();
    });

    it('should limit stored logs to 2000', async () => {
      vi.useFakeTimers();

      // Pre-populate with existing logs
      const existingLogs = Array.from({ length: 1995 }, (_, i) => ({
        id: String(i),
        timestamp: new Date().toISOString(),
        message: `Existing log ${i}`,
        level: 'info' as const,
        agentId: 'agent-1',
      }));

      useLogsStore.setState((state) => {
        const newLogs = new Map(state.logs);
        newLogs.set('agent-1', existingLogs);
        return { logs: newLogs };
      });

      // Add 10 more logs
      for (let i = 0; i < 10; i++) {
        useLogsStore.getState().appendLog('agent-1', {
          id: String(2000 + i),
          timestamp: new Date().toISOString(),
          message: `New log ${i}`,
          level: 'info',
        });
      }

      vi.advanceTimersByTime(150);

      const logs = useLogsStore.getState().logs.get('agent-1');
      expect(logs?.length).toBeLessThanOrEqual(2000);

      vi.useRealTimers();
    });
  });

  describe('clearLogs', () => {
    it('should clear logs for specific agent', () => {
      useLogsStore.setState((state) => {
        const newLogs = new Map(state.logs);
        newLogs.set('agent-1', [{ id: '1', timestamp: '', message: '', level: 'info', agentId: 'agent-1' }]);
        newLogs.set('agent-2', [{ id: '2', timestamp: '', message: '', level: 'info', agentId: 'agent-2' }]);
        return { logs: newLogs };
      });

      useLogsStore.getState().clearLogs('agent-1');

      const { logs } = useLogsStore.getState();
      expect(logs.has('agent-1')).toBe(false);
      expect(logs.has('agent-2')).toBe(true);
    });

    it('should clear all logs when no agentId provided', () => {
      useLogsStore.setState((state) => {
        const newLogs = new Map(state.logs);
        newLogs.set('agent-1', [{ id: '1', timestamp: '', message: '', level: 'info', agentId: 'agent-1' }]);
        newLogs.set('agent-2', [{ id: '2', timestamp: '', message: '', level: 'info', agentId: 'agent-2' }]);
        return { logs: newLogs };
      });

      useLogsStore.getState().clearLogs();

      const { logs } = useLogsStore.getState();
      expect(logs.size).toBe(0);
    });
  });

  describe('setAutoScroll', () => {
    it('should toggle autoScroll state', () => {
      expect(useLogsStore.getState().autoScroll).toBe(true);

      useLogsStore.getState().setAutoScroll(false);
      expect(useLogsStore.getState().autoScroll).toBe(false);

      useLogsStore.getState().setAutoScroll(true);
      expect(useLogsStore.getState().autoScroll).toBe(true);
    });
  });

  describe('clearError', () => {
    it('should clear error state', () => {
      useLogsStore.setState({ error: 'Test error' });
      expect(useLogsStore.getState().error).toBe('Test error');

      useLogsStore.getState().clearError();
      expect(useLogsStore.getState().error).toBeNull();
    });
  });
});
