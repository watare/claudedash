/**
 * Tests for Agent Registry Service
 *
 * Story 4.1: Kill Agent API & Backend - Task 7.1
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  registerAgent,
  getAgent,
  removeAgent,
  getAllAgents,
  getActiveAgents,
  updateAgentStatus,
  updateAgentActivity,
  hasAgent,
  getAgentCount,
  clearAllAgents,
} from './agentRegistry.js';

describe('Agent Registry Service', () => {
  // Mock subprocess object
  const createMockProcess = (pid = 12345) => ({
    pid,
    kill: () => {},
    on: () => {},
  });

  beforeEach(() => {
    // Clear registry before each test
    clearAllAgents();
  });

  afterEach(() => {
    clearAllAgents();
  });

  describe('registerAgent', () => {
    it('registers an agent with subprocess handle', () => {
      const mockProcess = createMockProcess();
      const agent = registerAgent('agent-1', mockProcess, {
        storyId: '4-1',
        projectId: 'test-project',
      });

      expect(agent).toBeDefined();
      expect(agent.id).toBe('agent-1');
      expect(agent.pid).toBe(12345);
      expect(agent.storyId).toBe('4-1');
      expect(agent.projectId).toBe('test-project');
      expect(agent.status).toBe('running');
      expect(agent.startedAt).toBeDefined();
      expect(agent.lastActivity).toBeDefined();
    });

    it('stores the process reference', () => {
      const mockProcess = createMockProcess();
      const agent = registerAgent('agent-2', mockProcess, {});

      expect(agent.process).toBe(mockProcess);
    });

    it('handles missing metadata gracefully', () => {
      const mockProcess = createMockProcess();
      const agent = registerAgent('agent-3', mockProcess);

      expect(agent.storyId).toBeNull();
      expect(agent.projectId).toBeNull();
    });
  });

  describe('getAgent', () => {
    it('returns the registered agent by ID', () => {
      const mockProcess = createMockProcess();
      registerAgent('agent-get-1', mockProcess, { storyId: '4-1' });

      const agent = getAgent('agent-get-1');

      expect(agent).toBeDefined();
      expect(agent.id).toBe('agent-get-1');
      expect(agent.storyId).toBe('4-1');
    });

    it('returns undefined for non-existent agent', () => {
      const agent = getAgent('non-existent');

      expect(agent).toBeUndefined();
    });
  });

  describe('removeAgent', () => {
    it('removes the agent from registry', () => {
      const mockProcess = createMockProcess();
      registerAgent('agent-remove-1', mockProcess, {});

      const result = removeAgent('agent-remove-1');

      expect(result).toBe(true);
      expect(getAgent('agent-remove-1')).toBeUndefined();
    });

    it('returns false for non-existent agent', () => {
      const result = removeAgent('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('getAllAgents', () => {
    it('returns all registered agents', () => {
      registerAgent('agent-all-1', createMockProcess(1001), {});
      registerAgent('agent-all-2', createMockProcess(1002), {});
      registerAgent('agent-all-3', createMockProcess(1003), {});

      const agents = getAllAgents();

      expect(agents).toHaveLength(3);
      expect(agents.map(a => a.id)).toContain('agent-all-1');
      expect(agents.map(a => a.id)).toContain('agent-all-2');
      expect(agents.map(a => a.id)).toContain('agent-all-3');
    });

    it('returns empty array when no agents registered', () => {
      const agents = getAllAgents();

      expect(agents).toEqual([]);
    });
  });

  describe('getActiveAgents', () => {
    it('returns only running agents', () => {
      registerAgent('agent-active-1', createMockProcess(2001), {});
      registerAgent('agent-active-2', createMockProcess(2002), {});
      registerAgent('agent-active-3', createMockProcess(2003), {});

      // Mark one as killed
      updateAgentStatus('agent-active-2', 'killed');

      const activeAgents = getActiveAgents();

      expect(activeAgents).toHaveLength(2);
      expect(activeAgents.map(a => a.id)).toContain('agent-active-1');
      expect(activeAgents.map(a => a.id)).toContain('agent-active-3');
      expect(activeAgents.map(a => a.id)).not.toContain('agent-active-2');
    });
  });

  describe('updateAgentStatus', () => {
    it('updates agent status', () => {
      registerAgent('agent-status-1', createMockProcess(), {});

      updateAgentStatus('agent-status-1', 'killed');

      const agent = getAgent('agent-status-1');
      expect(agent.status).toBe('killed');
    });

    it('updates lastActivity timestamp', () => {
      registerAgent('agent-status-2', createMockProcess(), {});
      const before = new Date().toISOString();

      // Small delay to ensure different timestamp
      updateAgentStatus('agent-status-2', 'completed');

      const agent = getAgent('agent-status-2');
      expect(new Date(agent.lastActivity) >= new Date(before)).toBe(true);
    });

    it('does nothing for non-existent agent', () => {
      // Should not throw
      updateAgentStatus('non-existent', 'killed');
    });
  });

  describe('updateAgentActivity', () => {
    it('updates lastActivity timestamp', () => {
      registerAgent('agent-activity-1', createMockProcess(), {});
      const agent = getAgent('agent-activity-1');
      const originalActivity = agent.lastActivity;

      // Small delay
      updateAgentActivity('agent-activity-1');

      const updatedAgent = getAgent('agent-activity-1');
      expect(new Date(updatedAgent.lastActivity) >= new Date(originalActivity)).toBe(true);
    });
  });

  describe('hasAgent', () => {
    it('returns true for existing agent', () => {
      registerAgent('agent-has-1', createMockProcess(), {});

      expect(hasAgent('agent-has-1')).toBe(true);
    });

    it('returns false for non-existent agent', () => {
      expect(hasAgent('non-existent')).toBe(false);
    });
  });

  describe('getAgentCount', () => {
    it('returns correct count of registered agents', () => {
      expect(getAgentCount()).toBe(0);

      registerAgent('agent-count-1', createMockProcess(3001), {});
      expect(getAgentCount()).toBe(1);

      registerAgent('agent-count-2', createMockProcess(3002), {});
      expect(getAgentCount()).toBe(2);

      removeAgent('agent-count-1');
      expect(getAgentCount()).toBe(1);
    });
  });

  describe('clearAllAgents', () => {
    it('removes all agents from registry', () => {
      registerAgent('agent-clear-1', createMockProcess(4001), {});
      registerAgent('agent-clear-2', createMockProcess(4002), {});

      expect(getAgentCount()).toBe(2);

      clearAllAgents();

      expect(getAgentCount()).toBe(0);
      expect(getAllAgents()).toEqual([]);
    });
  });
});
