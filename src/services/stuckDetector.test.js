/**
 * Tests for Stuck Agent Detection Service
 *
 * Story 4.6: Stuck Agent Detection & Alerts - Task 9.1, 9.2
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  startStuckDetection,
  stopStuckDetection,
  getStuckDetectionStatus,
  checkForStuckAgentsManual,
  updateStuckThreshold,
} from './stuckDetector.js';
import {
  registerAgent,
  getAgent,
  getAllAgents,
  clearAllAgents,
  updateAgentActivity,
} from './agentRegistry.js';
import * as websocket from './websocket.js';

describe('Stuck Agent Detection Service', () => {
  // Mock subprocess object
  const createMockProcess = (pid = 12345) => ({
    pid,
    kill: () => {},
    on: () => {},
  });

  beforeEach(() => {
    // Clear registry and stop any running detection
    clearAllAgents();
    stopStuckDetection();
    // Set short threshold for testing (1 minute)
    updateStuckThreshold(1);
  });

  afterEach(() => {
    clearAllAgents();
    stopStuckDetection();
    vi.restoreAllMocks();
  });

  describe('startStuckDetection', () => {
    it('starts detection with configured threshold', () => {
      const broadcast = vi.fn();
      const config = { stuckThresholdMinutes: 30 };

      startStuckDetection(config, broadcast);
      const status = getStuckDetectionStatus();

      expect(status.isRunning).toBe(true);
      expect(status.thresholdMinutes).toBe(30);
    });

    it('uses default threshold if not configured', () => {
      const broadcast = vi.fn();

      startStuckDetection({}, broadcast);
      const status = getStuckDetectionStatus();

      expect(status.thresholdMinutes).toBe(30);
    });
  });

  describe('stopStuckDetection', () => {
    it('stops running detection', () => {
      const broadcast = vi.fn();
      startStuckDetection({ stuckThresholdMinutes: 30 }, broadcast);

      stopStuckDetection();

      expect(getStuckDetectionStatus().isRunning).toBe(false);
    });
  });

  describe('checkForStuckAgentsManual', () => {
    it('marks agents as stuck when inactive beyond threshold', () => {
      // Register agent with old lastActivity
      const agent = registerAgent('stuck-agent-1', createMockProcess(), {
        storyId: '4-6',
        projectId: 'test',
      });

      // Manipulate lastActivity to be old (2 minutes ago)
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      const registeredAgent = getAgent('stuck-agent-1');
      registeredAgent.lastActivity = twoMinutesAgo;

      // Set threshold to 1 minute
      updateStuckThreshold(1);

      const stuckIds = checkForStuckAgentsManual();

      expect(stuckIds).toContain('stuck-agent-1');
      const updatedAgent = getAgent('stuck-agent-1');
      expect(updatedAgent.status).toBe('stuck');
      expect(updatedAgent.stuckAt).toBeDefined();
    });

    it('does not mark agents with recent activity as stuck', () => {
      registerAgent('active-agent-1', createMockProcess(), {
        storyId: '4-6',
        projectId: 'test',
      });

      // Agent was just registered, so lastActivity is now
      updateStuckThreshold(1);

      const stuckIds = checkForStuckAgentsManual();

      expect(stuckIds).not.toContain('active-agent-1');
      const agent = getAgent('active-agent-1');
      expect(agent.status).toBe('running');
      expect(agent.stuckAt).toBeNull();
    });

    it('skips already stuck agents', () => {
      registerAgent('already-stuck', createMockProcess(), {});

      // Make it old
      const agent = getAgent('already-stuck');
      agent.lastActivity = new Date(Date.now() - 5 * 60 * 1000).toISOString();

      // Mark as stuck first time
      updateStuckThreshold(1);
      const firstCheck = checkForStuckAgentsManual();
      expect(firstCheck).toContain('already-stuck');

      // Second check should not re-mark
      const secondCheck = checkForStuckAgentsManual();
      expect(secondCheck).not.toContain('already-stuck');
    });

    it('skips completed agents', () => {
      registerAgent('completed-agent', createMockProcess(), {});
      const agent = getAgent('completed-agent');
      agent.lastActivity = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      agent.status = 'completed';

      updateStuckThreshold(1);
      const stuckIds = checkForStuckAgentsManual();

      expect(stuckIds).not.toContain('completed-agent');
    });

    it('skips killed agents', () => {
      registerAgent('killed-agent', createMockProcess(), {});
      const agent = getAgent('killed-agent');
      agent.lastActivity = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      agent.status = 'killed';

      updateStuckThreshold(1);
      const stuckIds = checkForStuckAgentsManual();

      expect(stuckIds).not.toContain('killed-agent');
    });

    it('skips failed agents', () => {
      registerAgent('failed-agent', createMockProcess(), {});
      const agent = getAgent('failed-agent');
      agent.lastActivity = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      agent.status = 'failed';

      updateStuckThreshold(1);
      const stuckIds = checkForStuckAgentsManual();

      expect(stuckIds).not.toContain('failed-agent');
    });
  });

  describe('Activity update resets stuck timer (Task 9.2)', () => {
    it('resets stuck status when activity is updated', () => {
      registerAgent('reset-agent', createMockProcess(), {});
      const agent = getAgent('reset-agent');

      // Make it old and stuck
      agent.lastActivity = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      updateStuckThreshold(1);
      checkForStuckAgentsManual();

      expect(getAgent('reset-agent').status).toBe('stuck');
      expect(getAgent('reset-agent').stuckAt).not.toBeNull();

      // Update activity
      updateAgentActivity('reset-agent');

      // Agent should be un-stuck
      const updatedAgent = getAgent('reset-agent');
      expect(updatedAgent.status).toBe('running');
      expect(updatedAgent.stuckAt).toBeNull();
    });
  });

  describe('updateStuckThreshold', () => {
    it('updates the threshold in minutes', () => {
      updateStuckThreshold(45);
      const status = getStuckDetectionStatus();

      expect(status.thresholdMinutes).toBe(45);
      expect(status.thresholdMs).toBe(45 * 60 * 1000);
    });
  });

  describe('getStuckDetectionStatus', () => {
    it('returns current configuration', () => {
      updateStuckThreshold(30);
      const broadcast = vi.fn();
      startStuckDetection({ stuckThresholdMinutes: 30 }, broadcast);

      const status = getStuckDetectionStatus();

      expect(status.isRunning).toBe(true);
      expect(status.thresholdMinutes).toBe(30);
      expect(status.thresholdMs).toBe(30 * 60 * 1000);
    });
  });

  // AC2: WebSocket broadcast verification
  describe('WebSocket broadcast (AC2)', () => {
    it('emits agent:stuck event with correct payload when agent becomes stuck', () => {
      // Mock emitAgentStuck
      const emitAgentStuckSpy = vi.spyOn(websocket, 'emitAgentStuck').mockImplementation(() => {});

      // Register agent with old lastActivity
      registerAgent('broadcast-test-agent', createMockProcess(), {
        storyId: '4-6',
        projectId: 'test-project',
      });

      // Manipulate lastActivity to be old (2 minutes ago)
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      const registeredAgent = getAgent('broadcast-test-agent');
      registeredAgent.lastActivity = twoMinutesAgo;

      // Set threshold to 1 minute and start detection
      vi.useFakeTimers();
      startStuckDetection({ stuckThresholdMinutes: 1 });

      // Advance time to trigger check (1 minute interval)
      vi.advanceTimersByTime(60 * 1000);

      // Verify emitAgentStuck was called with correct payload
      expect(emitAgentStuckSpy).toHaveBeenCalledTimes(1);
      expect(emitAgentStuckSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: 'broadcast-test-agent',
          storyId: '4-6',
          duration: expect.any(String),
          durationMinutes: expect.any(Number),
        })
      );

      vi.useRealTimers();
      emitAgentStuckSpy.mockRestore();
    });

    it('includes formatted duration in stuck event payload', () => {
      const emitAgentStuckSpy = vi.spyOn(websocket, 'emitAgentStuck').mockImplementation(() => {});

      registerAgent('duration-test-agent', createMockProcess(), {
        storyId: '4-6',
      });

      // Set lastActivity to 65 minutes ago (1h 5m)
      const sixtyFiveMinutesAgo = new Date(Date.now() - 65 * 60 * 1000).toISOString();
      const agent = getAgent('duration-test-agent');
      agent.lastActivity = sixtyFiveMinutesAgo;

      vi.useFakeTimers();
      updateStuckThreshold(1);
      startStuckDetection({ stuckThresholdMinutes: 1 });
      vi.advanceTimersByTime(60 * 1000);

      // Check that duration is formatted with hours (accounting for 1 min interval delay = 66 min)
      expect(emitAgentStuckSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          duration: expect.stringMatching(/^1h \d+m$/), // Format: "1h Xm"
          durationMinutes: expect.any(Number),
        })
      );

      // Verify durationMinutes is in expected range (65-67 minutes accounting for timing)
      const callArgs = emitAgentStuckSpy.mock.calls[0][0];
      expect(callArgs.durationMinutes).toBeGreaterThanOrEqual(65);
      expect(callArgs.durationMinutes).toBeLessThanOrEqual(67);

      vi.useRealTimers();
      emitAgentStuckSpy.mockRestore();
    });
  });
});
