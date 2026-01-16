/**
 * Agents Zustand Store
 * Manages agent state and API interactions
 */

import { create } from 'zustand';
import { apiGet, killAgent as apiKillAgent } from '../services/api';
import type { Agent } from '../types/agent';

interface AgentsState {
  agents: Agent[];
  isLoading: boolean;
  error: string | null;
  killingAgentId: string | null;

  fetchAgents: () => Promise<void>;
  fetchAgentsByProject: (projectId: string) => Promise<void>;
  updateAgent: (agent: Agent) => void;
  addAgent: (agent: Agent) => void;
  removeAgent: (id: string) => void;
  killAgent: (agentId: string) => Promise<boolean>;
  clearError: () => void;
}

export const useAgentsStore = create<AgentsState>((set) => ({
  agents: [],
  isLoading: false,
  error: null,
  killingAgentId: null,

  fetchAgents: async () => {
    try {
      set({ isLoading: true, error: null });
      const agents = await apiGet<Agent[]>('/api/agents');
      set({ agents, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch agents',
        isLoading: false,
      });
    }
  },

  fetchAgentsByProject: async (projectId: string) => {
    try {
      set({ isLoading: true, error: null });
      const agents = await apiGet<Agent[]>(`/api/agents?projectId=${encodeURIComponent(projectId)}`);
      set({ agents, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch agents',
        isLoading: false,
      });
    }
  },

  updateAgent: (updatedAgent: Agent) => {
    set((state) => ({
      agents: state.agents.map((agent) =>
        agent.id === updatedAgent.id ? updatedAgent : agent
      ),
    }));
  },

  addAgent: (newAgent: Agent) => {
    set((state) => ({
      agents: [...state.agents, newAgent],
    }));
  },

  removeAgent: (id: string) => {
    set((state) => ({
      agents: state.agents.filter((agent) => agent.id !== id),
    }));
  },

  killAgent: async (agentId: string) => {
    set({ killingAgentId: agentId, error: null });
    try {
      await apiKillAgent(agentId);
      set((state) => ({
        agents: state.agents.filter((a) => a.id !== agentId),
        killingAgentId: null,
      }));
      return true;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to kill agent',
        killingAgentId: null,
      });
      return false;
    }
  },

  clearError: () => set({ error: null }),
}));
