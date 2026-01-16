/**
 * Tests for Agents service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getAllAgents, getAgentsByProject, getAgentById } from './agents.js';
import * as claudeRunner from '../claude-runner.js';

// Mock claude-runner module
vi.mock('../claude-runner.js', () => ({
  getActiveAgents: vi.fn(),
  getAllAgents: vi.fn(),
  getAgentById: vi.fn(),
  getAgentsByProject: vi.fn(),
}));

describe('Agents Service', () => {
  const mockAgent = {
    id: 'agent-123',
    projectId: 'test-project',
    storyId: '2-4',
    storyTitle: 'Agents Store & API',
    status: 'running',
    startedAt: new Date(Date.now() - 60000).toISOString(), // 1 minute ago
    lastActivity: new Date().toISOString(),
    lastOutput: 'Implementing feature...',
    outputHistory: ['Starting...', 'Working...', 'Implementing feature...'],
    completed: false,
    killed: false,
  };

  const mockCompletedAgent = {
    ...mockAgent,
    id: 'agent-456',
    status: 'completed',
    completed: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getAllAgents', () => {
    it('returns formatted agents array', async () => {
      claudeRunner.getActiveAgents.mockReturnValue([mockAgent]);

      const agents = await getAllAgents();

      expect(Array.isArray(agents)).toBe(true);
      expect(agents.length).toBe(1);
    });

    it('returns agent with all required fields', async () => {
      claudeRunner.getActiveAgents.mockReturnValue([mockAgent]);

      const agents = await getAllAgents();
      const agent = agents[0];

      expect(agent).toHaveProperty('id');
      expect(agent).toHaveProperty('projectId');
      expect(agent).toHaveProperty('storyId');
      expect(agent).toHaveProperty('storyTitle');
      expect(agent).toHaveProperty('status');
      expect(agent).toHaveProperty('startedAt');
      expect(agent).toHaveProperty('lastActivity');
      expect(agent).toHaveProperty('lastOutput');
      expect(agent).toHaveProperty('duration');
    });

    it('calculates duration correctly', async () => {
      claudeRunner.getActiveAgents.mockReturnValue([mockAgent]);

      const agents = await getAllAgents();
      const agent = agents[0];

      // Duration should be approximately 60 seconds (±5s for test timing)
      expect(agent.duration).toBeGreaterThanOrEqual(55);
      expect(agent.duration).toBeLessThanOrEqual(65);
    });

    it('returns empty array when no agents', async () => {
      claudeRunner.getActiveAgents.mockReturnValue([]);

      const agents = await getAllAgents();

      expect(agents).toEqual([]);
    });

    it('truncates long output', async () => {
      const agentWithLongOutput = {
        ...mockAgent,
        lastOutput: 'A'.repeat(200),
      };
      claudeRunner.getActiveAgents.mockReturnValue([agentWithLongOutput]);

      const agents = await getAllAgents();
      const agent = agents[0];

      expect(agent.lastOutput.length).toBeLessThanOrEqual(103); // 100 + '...'
      expect(agent.lastOutput.endsWith('...')).toBe(true);
    });
  });

  describe('getAgentsByProject', () => {
    it('returns agents filtered by project', async () => {
      claudeRunner.getAgentsByProject.mockReturnValue([mockAgent]);

      const agents = await getAgentsByProject('test-project');

      expect(claudeRunner.getAgentsByProject).toHaveBeenCalledWith('test-project');
      expect(agents.length).toBe(1);
      expect(agents[0].projectId).toBe('test-project');
    });

    it('returns empty array when no agents for project', async () => {
      claudeRunner.getAgentsByProject.mockReturnValue([]);

      const agents = await getAgentsByProject('non-existent');

      expect(agents).toEqual([]);
    });
  });

  describe('getAgentById', () => {
    it('returns agent with output history', async () => {
      claudeRunner.getAgentById.mockReturnValue(mockAgent);

      const agent = await getAgentById('agent-123');

      expect(agent).not.toBeNull();
      expect(agent.id).toBe('agent-123');
      expect(agent).toHaveProperty('outputHistory');
      expect(Array.isArray(agent.outputHistory)).toBe(true);
    });

    it('returns null for non-existent agent', async () => {
      claudeRunner.getAgentById.mockReturnValue(null);

      const agent = await getAgentById('non-existent');

      expect(agent).toBeNull();
    });

    it('includes all required detail fields', async () => {
      claudeRunner.getAgentById.mockReturnValue(mockAgent);

      const agent = await getAgentById('agent-123');

      expect(agent).toHaveProperty('id');
      expect(agent).toHaveProperty('projectId');
      expect(agent).toHaveProperty('storyId');
      expect(agent).toHaveProperty('storyTitle');
      expect(agent).toHaveProperty('status');
      expect(agent).toHaveProperty('startedAt');
      expect(agent).toHaveProperty('lastActivity');
      expect(agent).toHaveProperty('lastOutput');
      expect(agent).toHaveProperty('duration');
      expect(agent).toHaveProperty('outputHistory');
    });
  });

  describe('status derivation', () => {
    it('returns killed status for killed agent', async () => {
      const killedAgent = { ...mockAgent, killed: true };
      claudeRunner.getActiveAgents.mockReturnValue([killedAgent]);

      const agents = await getAllAgents();

      expect(agents[0].status).toBe('killed');
    });

    it('returns completed status for completed agent', async () => {
      claudeRunner.getActiveAgents.mockReturnValue([mockCompletedAgent]);

      const agents = await getAllAgents();

      expect(agents[0].status).toBe('completed');
    });

    it('returns stuck status for inactive agent', async () => {
      const stuckAgent = {
        ...mockAgent,
        lastActivity: new Date(Date.now() - 35 * 60 * 1000).toISOString(), // 35 min ago
      };
      claudeRunner.getActiveAgents.mockReturnValue([stuckAgent]);

      const agents = await getAllAgents();

      expect(agents[0].status).toBe('stuck');
    });

    it('returns running status for active agent', async () => {
      claudeRunner.getActiveAgents.mockReturnValue([mockAgent]);

      const agents = await getAllAgents();

      expect(agents[0].status).toBe('running');
    });
  });
});
