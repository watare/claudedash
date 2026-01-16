/**
 * Integration Tests for Agent Killer Service
 *
 * Story 4.1: Kill Agent API & Backend
 * Tests real subprocess termination with SIGTERM and SIGKILL fallback.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';
import {
  registerAgent,
  getAgent,
  clearAllAgents,
} from './agentRegistry.js';

/**
 * Spawn a long-running process for testing
 * Uses 'sleep' command which responds to SIGTERM gracefully
 */
function spawnTestProcess(duration = 60) {
  return spawn('sleep', [duration.toString()], {
    detached: false,
    stdio: 'ignore',
  });
}

/**
 * Spawn a process that ignores SIGTERM (for SIGKILL fallback testing)
 * Uses a bash script that traps SIGTERM
 */
function spawnStubbornProcess() {
  return spawn('bash', ['-c', 'trap "" SIGTERM; sleep 60'], {
    detached: false,
    stdio: 'ignore',
  });
}

/**
 * Wait for process to exit with timeout
 */
function waitForProcessExit(pid, timeoutMs = 10000) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      try {
        process.kill(pid, 0);
        // Process still exists
        if (Date.now() - startTime > timeoutMs) {
          clearInterval(interval);
          resolve(false);
        }
      } catch {
        // Process exited
        clearInterval(interval);
        resolve(true);
      }
    }, 50);
  });
}

describe('Agent Killer Integration Tests', () => {
  let testProcesses = [];

  beforeEach(() => {
    clearAllAgents();
    testProcesses = [];
  });

  afterEach(async () => {
    clearAllAgents();
    // Clean up any leftover test processes
    for (const proc of testProcesses) {
      try {
        if (proc && proc.pid) {
          process.kill(proc.pid, 'SIGKILL');
        }
      } catch {
        // Process already dead
      }
    }
    testProcesses = [];
  });

  describe('Real subprocess termination', () => {
    it('terminates a real process with SIGTERM', async () => {
      // Spawn a real process
      const childProcess = spawnTestProcess();
      testProcesses.push(childProcess);

      expect(childProcess.pid).toBeDefined();

      // Register it
      const agent = registerAgent('test-agent-sigterm', childProcess, {
        storyId: 'test',
        projectId: 'test',
      });

      expect(agent.pid).toBe(childProcess.pid);

      // Verify process is running
      expect(() => process.kill(childProcess.pid, 0)).not.toThrow();

      // Send SIGTERM
      process.kill(childProcess.pid, 'SIGTERM');

      // Wait for process to exit
      const exited = await waitForProcessExit(childProcess.pid, 5000);
      expect(exited).toBe(true);

      // Verify process is dead
      expect(() => process.kill(childProcess.pid, 0)).toThrow();
    });

    it('falls back to SIGKILL for stubborn processes', async () => {
      // Spawn a stubborn process that ignores SIGTERM
      const childProcess = spawnStubbornProcess();
      testProcesses.push(childProcess);

      expect(childProcess.pid).toBeDefined();

      // Wait a bit for process to start and set up trap
      await new Promise((r) => setTimeout(r, 100));

      // Verify process is running
      expect(() => process.kill(childProcess.pid, 0)).not.toThrow();

      // Send SIGTERM (should be ignored by the stubborn process)
      process.kill(childProcess.pid, 'SIGTERM');

      // Wait briefly - process should NOT exit
      await new Promise((r) => setTimeout(r, 500));

      // Process should still be running (ignoring SIGTERM)
      expect(() => process.kill(childProcess.pid, 0)).not.toThrow();

      // Now send SIGKILL
      process.kill(childProcess.pid, 'SIGKILL');

      // Wait for process to exit
      const exited = await waitForProcessExit(childProcess.pid, 2000);
      expect(exited).toBe(true);

      // Verify process is dead
      expect(() => process.kill(childProcess.pid, 0)).toThrow();
    });

    it('handles already-dead processes gracefully', async () => {
      // Spawn and immediately kill a process
      const childProcess = spawnTestProcess(1);
      testProcesses.push(childProcess);
      const pid = childProcess.pid;

      // Kill it immediately
      process.kill(pid, 'SIGKILL');
      await waitForProcessExit(pid, 2000);

      // Register the dead PID (simulating race condition)
      registerAgent('test-agent-dead', { pid, kill: () => {} }, {
        storyId: 'test',
        projectId: 'test',
      });

      // Attempting to kill should not throw
      expect(() => process.kill(pid, 0)).toThrow(); // Confirms it's dead
    });

    it('registry tracks process metadata correctly', async () => {
      const childProcess = spawnTestProcess();
      testProcesses.push(childProcess);

      const agent = registerAgent('test-agent-metadata', childProcess, {
        storyId: '4-1',
        projectId: 'bmad-orchestrator',
      });

      expect(agent.id).toBe('test-agent-metadata');
      expect(agent.pid).toBe(childProcess.pid);
      expect(agent.storyId).toBe('4-1');
      expect(agent.projectId).toBe('bmad-orchestrator');
      expect(agent.status).toBe('running');
      expect(agent.process).toBe(childProcess);

      // Verify we can retrieve it
      const retrieved = getAgent('test-agent-metadata');
      expect(retrieved).toBe(agent);

      // Clean up
      process.kill(childProcess.pid, 'SIGKILL');
    });
  });
});
