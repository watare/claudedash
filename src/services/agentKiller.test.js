/**
 * Tests for Agent Killer Service
 *
 * Story 4.1: Kill Agent API & Backend - Task 7.2
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { killAgentProcess } from './agentKiller.js';
import * as agentRegistry from './agentRegistry.js';
import * as claudeRunner from '../claude-runner.js';

// Mock the agentRegistry module
vi.mock('./agentRegistry.js', () => ({
  getAgent: vi.fn(),
  updateAgentStatus: vi.fn(),
  removeAgent: vi.fn(),
}));

// Mock the claude-runner killAgent function
vi.mock('../claude-runner.js', () => ({
  killAgent: vi.fn(),
}));

describe('Agent Killer Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('killAgentProcess', () => {
    it('returns error when agent not found in registry', async () => {
      agentRegistry.getAgent.mockReturnValue(undefined);

      const result = await killAgentProcess('non-existent-agent');

      expect(result.success).toBe(false);
      expect(result.agentId).toBe('non-existent-agent');
      expect(result.error).toBe('Agent not found in registry');
      expect(result.method).toBeNull();
      expect(result.timestamp).toBeDefined();
    });

    it('handles already terminated process', async () => {
      // Mock agent in registry but process already dead
      agentRegistry.getAgent.mockReturnValue({
        id: 'agent-dead',
        pid: 99999, // PID that doesn't exist
        process: { pid: 99999 },
      });

      // Mock process.kill to throw ESRCH (no such process)
      const originalKill = process.kill;
      process.kill = vi.fn().mockImplementation((pid, signal) => {
        if (signal === 0 || signal === 'SIGTERM') {
          const error = new Error('No such process');
          error.code = 'ESRCH';
          throw error;
        }
      });

      const result = await killAgentProcess('agent-dead');

      expect(result.success).toBe(true);
      expect(result.agentId).toBe('agent-dead');
      expect(agentRegistry.updateAgentStatus).toHaveBeenCalledWith('agent-dead', 'killed');
      expect(claudeRunner.killAgent).toHaveBeenCalledWith('agent-dead');

      // Restore process.kill
      process.kill = originalKill;
    });

    it('handles permission denied error', async () => {
      agentRegistry.getAgent.mockReturnValue({
        id: 'agent-perm',
        pid: 1, // PID 1 (init) would require root
        process: { pid: 1 },
      });

      const originalKill = process.kill;
      let callCount = 0;
      process.kill = vi.fn().mockImplementation((pid, signal) => {
        callCount++;
        // First call is the isProcessRunning check with signal=0
        if (signal === 0) {
          return true; // Process exists
        }
        // Second call is SIGTERM which should throw EPERM
        const error = new Error('Operation not permitted');
        error.code = 'EPERM';
        throw error;
      });

      const result = await killAgentProcess('agent-perm');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Permission denied to kill process');

      process.kill = originalKill;
    });

    it('includes timestamp in result', async () => {
      agentRegistry.getAgent.mockReturnValue(undefined);

      const before = new Date().toISOString();
      const result = await killAgentProcess('any-agent');
      const after = new Date().toISOString();

      expect(new Date(result.timestamp) >= new Date(before)).toBe(true);
      expect(new Date(result.timestamp) <= new Date(after)).toBe(true);
    });
  });

  describe('kill result structure', () => {
    it('has required fields on failure', async () => {
      agentRegistry.getAgent.mockReturnValue(undefined);

      const result = await killAgentProcess('test-agent');

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('agentId');
      expect(result).toHaveProperty('method');
      expect(result).toHaveProperty('timestamp');
    });
  });
});
