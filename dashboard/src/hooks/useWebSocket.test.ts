/**
 * Tests for useWebSocket hook
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWebSocket } from './useWebSocket';
import { useAgentsStore } from '../stores/agentsStore';
import { useProjectsStore } from '../stores/projectsStore';
import { useUIStore } from '../stores/uiStore';
import { getAccessToken } from '../services/api';

// Mock dependencies
vi.mock('../services/api', () => ({
  getAccessToken: vi.fn(),
}));

vi.mock('../services/websocket', () => {
  const handlers = new Map<string, Function[]>();

  return {
    wsClient: {
      connect: vi.fn(),
      disconnect: vi.fn(),
      on: vi.fn((type: string, handler: Function) => {
        if (!handlers.has(type)) handlers.set(type, []);
        handlers.get(type)!.push(handler);
        return () => {
          const typeHandlers = handlers.get(type);
          if (typeHandlers) {
            const idx = typeHandlers.indexOf(handler);
            if (idx > -1) typeHandlers.splice(idx, 1);
          }
        };
      }),
      isConnected: false,
      // Test helper to simulate events
      _simulateEvent: (type: string, data: unknown) => {
        const typeHandlers = handlers.get(type) || [];
        typeHandlers.forEach(h => h({ type, data, timestamp: new Date().toISOString() }));
      },
      _clearHandlers: () => handlers.clear(),
    },
  };
});

// Get the mock client for testing
import { wsClient } from '../services/websocket';
const mockClient = wsClient as typeof wsClient & {
  _simulateEvent: (type: string, data: unknown) => void;
  _clearHandlers: () => void;
};

describe('useWebSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClient._clearHandlers();

    // Reset stores
    useAgentsStore.setState({ agents: [], isLoading: false, error: null });
    useProjectsStore.setState({ projects: [], currentProject: null, isLoading: false, error: null });
    useUIStore.setState({ connectionStatus: 'disconnected', toasts: [] });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('connection', () => {
    it('should connect when token is available', () => {
      (getAccessToken as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      renderHook(() => useWebSocket());

      expect(mockClient.connect).toHaveBeenCalledWith('test-token');
    });

    it('should not connect when token is not available', () => {
      (getAccessToken as ReturnType<typeof vi.fn>).mockReturnValue(null);

      renderHook(() => useWebSocket());

      expect(mockClient.connect).not.toHaveBeenCalled();
    });

    it('should set connection status to connected on connection:open', () => {
      (getAccessToken as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      renderHook(() => useWebSocket());

      act(() => {
        mockClient._simulateEvent('connection:open', {});
      });

      expect(useUIStore.getState().connectionStatus).toBe('connected');
    });

    it('should set connection status to reconnecting on connection:reconnecting', () => {
      (getAccessToken as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      renderHook(() => useWebSocket());

      act(() => {
        mockClient._simulateEvent('connection:reconnecting', { attempt: 1 });
      });

      expect(useUIStore.getState().connectionStatus).toBe('reconnecting');
    });
  });

  describe('agent events', () => {
    beforeEach(() => {
      (getAccessToken as ReturnType<typeof vi.fn>).mockReturnValue('test-token');
    });

    it('should add agent on agent:spawn event', () => {
      renderHook(() => useWebSocket());

      act(() => {
        mockClient._simulateEvent('agent:spawn', {
          agentId: 'agent-1',
          projectId: 'proj-1',
          storyId: '2-3',
          storyTitle: 'Test Story',
        });
      });

      const agents = useAgentsStore.getState().agents;
      expect(agents).toHaveLength(1);
      expect(agents[0]).toMatchObject({
        id: 'agent-1',
        projectId: 'proj-1',
        storyId: '2-3',
        storyTitle: 'Test Story',
        status: 'running',
      });
    });

    it('should update agent on agent:output event', () => {
      // Setup: add an agent first
      useAgentsStore.setState({
        agents: [{
          id: 'agent-1',
          projectId: 'proj-1',
          storyId: '2-3',
          storyTitle: 'Test',
          status: 'running',
          startedAt: new Date().toISOString(),
          lastActivity: new Date().toISOString(),
          lastOutput: 'Starting...',
          duration: 0,
        }],
      });

      renderHook(() => useWebSocket());

      act(() => {
        mockClient._simulateEvent('agent:output', {
          agentId: 'agent-1',
          output: 'Processing task...',
        });
      });

      const agent = useAgentsStore.getState().agents[0];
      expect(agent.lastOutput).toBe('Processing task...');
    });

    it('should remove agent on agent:complete event', () => {
      // Setup: add an agent first
      useAgentsStore.setState({
        agents: [{
          id: 'agent-1',
          projectId: 'proj-1',
          storyId: '2-3',
          storyTitle: 'Test',
          status: 'running',
          startedAt: new Date().toISOString(),
          lastActivity: new Date().toISOString(),
          lastOutput: 'Test',
          duration: 0,
        }],
      });

      renderHook(() => useWebSocket());

      act(() => {
        mockClient._simulateEvent('agent:complete', {
          agentId: 'agent-1',
        });
      });

      expect(useAgentsStore.getState().agents).toHaveLength(0);
    });

    it('should mark agent as stuck on agent:stuck event', () => {
      // Setup: add an agent first
      useAgentsStore.setState({
        agents: [{
          id: 'agent-1',
          projectId: 'proj-1',
          storyId: '2-3',
          storyTitle: 'Test',
          status: 'running',
          startedAt: new Date().toISOString(),
          lastActivity: new Date().toISOString(),
          lastOutput: 'Test',
          duration: 0,
        }],
      });

      renderHook(() => useWebSocket());

      act(() => {
        mockClient._simulateEvent('agent:stuck', {
          agentId: 'agent-1',
          duration: 3600,
        });
      });

      const agent = useAgentsStore.getState().agents[0];
      expect(agent.status).toBe('stuck');
    });
  });

  describe('project events', () => {
    beforeEach(() => {
      (getAccessToken as ReturnType<typeof vi.fn>).mockReturnValue('test-token');
    });

    it('should refetch projects on project:update event', () => {
      const fetchProjects = vi.spyOn(useProjectsStore.getState(), 'fetchProjects');

      renderHook(() => useWebSocket());

      act(() => {
        mockClient._simulateEvent('project:update', {
          projectId: 'proj-1',
          status: 'running',
        });
      });

      expect(fetchProjects).toHaveBeenCalled();
    });
  });

  describe('story events', () => {
    beforeEach(() => {
      (getAccessToken as ReturnType<typeof vi.fn>).mockReturnValue('test-token');
    });

    it('should add error toast on story verification mismatch', () => {
      renderHook(() => useWebSocket());

      act(() => {
        mockClient._simulateEvent('story:verified', {
          storyId: '2-3',
          match: false,
        });
      });

      const toasts = useUIStore.getState().toasts;
      expect(toasts).toHaveLength(1);
      expect(toasts[0].type).toBe('error');
      expect(toasts[0].message).toContain('2-3');
    });

    it('should not add toast on story verification match', () => {
      renderHook(() => useWebSocket());

      act(() => {
        mockClient._simulateEvent('story:verified', {
          storyId: '2-3',
          match: true,
        });
      });

      expect(useUIStore.getState().toasts).toHaveLength(0);
    });
  });

  describe('reconnection', () => {
    beforeEach(() => {
      (getAccessToken as ReturnType<typeof vi.fn>).mockReturnValue('test-token');
    });

    it('should refetch data and show toast on connection:established', () => {
      const fetchProjects = vi.spyOn(useProjectsStore.getState(), 'fetchProjects');
      const fetchAgents = vi.spyOn(useAgentsStore.getState(), 'fetchAgents');

      renderHook(() => useWebSocket());

      act(() => {
        mockClient._simulateEvent('connection:established', {});
      });

      expect(fetchProjects).toHaveBeenCalled();
      expect(fetchAgents).toHaveBeenCalled();

      const toasts = useUIStore.getState().toasts;
      expect(toasts).toHaveLength(1);
      expect(toasts[0].type).toBe('success');
      expect(toasts[0].message).toContain('restored');
    });
  });

  describe('cleanup', () => {
    it('should disconnect on unmount', () => {
      (getAccessToken as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      const { unmount } = renderHook(() => useWebSocket());

      unmount();

      expect(mockClient.disconnect).toHaveBeenCalled();
    });
  });
});
