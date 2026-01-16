/**
 * Tests for Agents Zustand Store
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAgentsStore } from './agentsStore';
import * as api from '../services/api';
import type { Agent } from '../types/agent';

// Mock the api module
vi.mock('../services/api', () => ({
  apiGet: vi.fn(),
}));

const mockAgent: Agent = {
  id: 'agent-123',
  projectId: 'test-project',
  storyId: '2-4',
  storyTitle: 'Agents Store & API',
  status: 'running',
  startedAt: '2026-01-15T12:00:00Z',
  lastActivity: '2026-01-15T12:05:00Z',
  lastOutput: 'Working...',
  duration: 300,
};

const mockAgents: Agent[] = [
  mockAgent,
  {
    id: 'agent-456',
    projectId: 'test-project',
    storyId: '2-5',
    storyTitle: 'Agent Activity Panel',
    status: 'running',
    startedAt: '2026-01-15T12:01:00Z',
    lastActivity: '2026-01-15T12:04:00Z',
    lastOutput: 'Building UI...',
    duration: 180,
  },
];

describe('agentsStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store to initial state
    useAgentsStore.setState({
      agents: [],
      isLoading: false,
      error: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('has correct initial values', () => {
      const state = useAgentsStore.getState();

      expect(state.agents).toEqual([]);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('fetchAgents', () => {
    it('sets isLoading true while fetching', async () => {
      vi.mocked(api.apiGet).mockImplementation(() => new Promise(() => {})); // Never resolves

      useAgentsStore.getState().fetchAgents();

      expect(useAgentsStore.getState().isLoading).toBe(true);
    });

    it('fetches agents and updates state', async () => {
      vi.mocked(api.apiGet).mockResolvedValue(mockAgents);

      await useAgentsStore.getState().fetchAgents();

      expect(api.apiGet).toHaveBeenCalledWith('/api/agents');
      expect(useAgentsStore.getState().agents).toEqual(mockAgents);
      expect(useAgentsStore.getState().isLoading).toBe(false);
      expect(useAgentsStore.getState().error).toBeNull();
    });

    it('handles fetch errors', async () => {
      vi.mocked(api.apiGet).mockRejectedValue(new Error('Network error'));

      await useAgentsStore.getState().fetchAgents();

      expect(useAgentsStore.getState().error).toBe('Network error');
      expect(useAgentsStore.getState().isLoading).toBe(false);
      expect(useAgentsStore.getState().agents).toEqual([]);
    });

    it('clears previous error on new fetch', async () => {
      useAgentsStore.setState({ error: 'Previous error' });

      vi.mocked(api.apiGet).mockResolvedValue(mockAgents);

      await useAgentsStore.getState().fetchAgents();

      expect(useAgentsStore.getState().error).toBeNull();
    });
  });

  describe('fetchAgentsByProject', () => {
    it('fetches agents filtered by project', async () => {
      vi.mocked(api.apiGet).mockResolvedValue(mockAgents);

      await useAgentsStore.getState().fetchAgentsByProject('test-project');

      expect(api.apiGet).toHaveBeenCalledWith('/api/agents?projectId=test-project');
      expect(useAgentsStore.getState().agents).toEqual(mockAgents);
      expect(useAgentsStore.getState().isLoading).toBe(false);
    });

    it('handles fetch errors for project filter', async () => {
      vi.mocked(api.apiGet).mockRejectedValue(new Error('Failed to fetch'));

      await useAgentsStore.getState().fetchAgentsByProject('test-project');

      expect(useAgentsStore.getState().error).toBe('Failed to fetch');
      expect(useAgentsStore.getState().isLoading).toBe(false);
    });

    it('encodes projectId in URL', async () => {
      vi.mocked(api.apiGet).mockResolvedValue([]);

      await useAgentsStore.getState().fetchAgentsByProject('project with spaces');

      expect(api.apiGet).toHaveBeenCalledWith('/api/agents?projectId=project%20with%20spaces');
    });
  });

  describe('updateAgent', () => {
    it('updates existing agent in store', () => {
      useAgentsStore.setState({ agents: mockAgents });

      const updatedAgent: Agent = {
        ...mockAgent,
        status: 'completed',
        lastOutput: 'Done!',
      };

      useAgentsStore.getState().updateAgent(updatedAgent);

      const state = useAgentsStore.getState();
      const agent = state.agents.find((a) => a.id === 'agent-123');

      expect(agent?.status).toBe('completed');
      expect(agent?.lastOutput).toBe('Done!');
    });

    it('does not modify other agents', () => {
      useAgentsStore.setState({ agents: mockAgents });

      const updatedAgent: Agent = {
        ...mockAgent,
        status: 'completed',
      };

      useAgentsStore.getState().updateAgent(updatedAgent);

      const state = useAgentsStore.getState();
      const otherAgent = state.agents.find((a) => a.id === 'agent-456');

      expect(otherAgent?.status).toBe('running');
    });

    it('does nothing if agent not found', () => {
      useAgentsStore.setState({ agents: mockAgents });

      const nonExistentAgent: Agent = {
        ...mockAgent,
        id: 'non-existent',
      };

      useAgentsStore.getState().updateAgent(nonExistentAgent);

      expect(useAgentsStore.getState().agents).toEqual(mockAgents);
    });
  });

  describe('addAgent', () => {
    it('adds new agent to store', () => {
      useAgentsStore.setState({ agents: [] });

      useAgentsStore.getState().addAgent(mockAgent);

      expect(useAgentsStore.getState().agents).toContainEqual(mockAgent);
      expect(useAgentsStore.getState().agents).toHaveLength(1);
    });

    it('appends to existing agents', () => {
      useAgentsStore.setState({ agents: [mockAgent] });

      const newAgent: Agent = {
        ...mockAgent,
        id: 'agent-789',
        storyId: '2-6',
      };

      useAgentsStore.getState().addAgent(newAgent);

      expect(useAgentsStore.getState().agents).toHaveLength(2);
      expect(useAgentsStore.getState().agents[1].id).toBe('agent-789');
    });
  });

  describe('removeAgent', () => {
    it('removes agent by id', () => {
      useAgentsStore.setState({ agents: mockAgents });

      useAgentsStore.getState().removeAgent('agent-123');

      const state = useAgentsStore.getState();
      expect(state.agents).toHaveLength(1);
      expect(state.agents.find((a) => a.id === 'agent-123')).toBeUndefined();
    });

    it('does nothing if agent not found', () => {
      useAgentsStore.setState({ agents: mockAgents });

      useAgentsStore.getState().removeAgent('non-existent');

      expect(useAgentsStore.getState().agents).toHaveLength(2);
    });

    it('can remove all agents one by one', () => {
      useAgentsStore.setState({ agents: mockAgents });

      useAgentsStore.getState().removeAgent('agent-123');
      useAgentsStore.getState().removeAgent('agent-456');

      expect(useAgentsStore.getState().agents).toHaveLength(0);
    });
  });

  describe('clearError', () => {
    it('clears error state', () => {
      useAgentsStore.setState({ error: 'Some error' });

      useAgentsStore.getState().clearError();

      expect(useAgentsStore.getState().error).toBeNull();
    });
  });
});
