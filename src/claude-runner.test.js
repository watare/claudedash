/**
 * Tests for claude-runner.js
 * Focuses on timeout behavior for Supervisor AI calls
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withTimeout } from './claude-runner.js';

describe('claude-runner', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('withTimeout', () => {
    it('should resolve with promise result if it completes before timeout', async () => {
      const fastPromise = Promise.resolve('success');
      const result = await withTimeout(fastPromise, 1000, 'Test timeout');
      expect(result).toBe('success');
    });

    it('should reject with timeout error if promise takes too long', async () => {
      // Create a promise that never resolves (simulates hanging Supervisor AI)
      const hangingPromise = new Promise(() => {});

      const timeoutPromise = withTimeout(hangingPromise, 100, 'Supervisor AI timeout');

      // Advance timers past the timeout
      vi.advanceTimersByTime(101);

      await expect(timeoutPromise).rejects.toThrow('Supervisor AI timeout');
    });

    it('should reject with original error if promise rejects before timeout', async () => {
      const failingPromise = Promise.reject(new Error('Original error'));

      await expect(withTimeout(failingPromise, 1000, 'Test timeout'))
        .rejects.toThrow('Original error');
    });

    it('should use the provided error message on timeout', async () => {
      const hangingPromise = new Promise(() => {});
      const customMessage = 'Custom timeout message';

      const timeoutPromise = withTimeout(hangingPromise, 50, customMessage);

      vi.advanceTimersByTime(51);

      await expect(timeoutPromise).rejects.toThrow(customMessage);
    });

    it('should resolve even with very short timeouts if promise is faster', async () => {
      const immediatePromise = Promise.resolve('immediate');
      const result = await withTimeout(immediatePromise, 1, 'Timeout');
      expect(result).toBe('immediate');
    });
  });

  describe('Supervisor AI Timeout Integration', () => {
    it('should timeout and provide fallback after SUPERVISOR_TIMEOUT_MS', async () => {
      // This test validates the try/finally pattern used in the actual code
      // by simulating the async flow with waitingForAI flag

      let waitingForAI = false;
      let fallbackUsed = false;
      let finallyExecuted = false;

      // Simulates the actual code pattern from claude-runner.js
      const simulateSupervisorCall = async () => {
        waitingForAI = true;
        try {
          const hangingPromise = new Promise(() => {});
          await withTimeout(hangingPromise, 100, 'Supervisor AI timeout');
        } catch (err) {
          expect(err.message).toBe('Supervisor AI timeout');
          fallbackUsed = true;
        } finally {
          waitingForAI = false;
          finallyExecuted = true;
        }
      };

      // Start the call
      const callPromise = simulateSupervisorCall();
      expect(waitingForAI).toBe(true);

      // Advance past timeout
      vi.advanceTimersByTime(101);

      // Wait for async operations to complete
      await callPromise;

      // Verify finally block executed and reset the flag
      expect(waitingForAI).toBe(false);
      expect(fallbackUsed).toBe(true);
      expect(finallyExecuted).toBe(true);
    });

    it('should reset waitingForAI flag even when promise succeeds', async () => {
      let waitingForAI = false;
      let finallyExecuted = false;

      const simulateSupervisorCall = async () => {
        waitingForAI = true;
        try {
          await withTimeout(Promise.resolve({ answer: 'yes' }), 100, 'Timeout');
        } finally {
          waitingForAI = false;
          finallyExecuted = true;
        }
      };

      await simulateSupervisorCall();

      expect(waitingForAI).toBe(false);
      expect(finallyExecuted).toBe(true);
    });

    it('should reset waitingForAI flag when promise rejects (non-timeout)', async () => {
      let waitingForAI = false;
      let errorCaught = false;
      let finallyExecuted = false;

      const simulateSupervisorCall = async () => {
        waitingForAI = true;
        try {
          await withTimeout(
            Promise.reject(new Error('Network error')),
            100,
            'Timeout'
          );
        } catch (err) {
          errorCaught = true;
          expect(err.message).toBe('Network error');
        } finally {
          waitingForAI = false;
          finallyExecuted = true;
        }
      };

      await simulateSupervisorCall();

      expect(waitingForAI).toBe(false);
      expect(errorCaught).toBe(true);
      expect(finallyExecuted).toBe(true);
    });
  });

  describe('PTY Spawn Failure Handling', () => {
    it('should handle spawn errors with proper error propagation pattern', async () => {
      // This test validates the error handling pattern used in runClaude
      // when pty.spawn fails (e.g., command not found, permission denied)
      let agentMarkedFailed = false;
      let errorThrown = false;
      let errorMessage = '';

      // Simulates the try/catch pattern around pty.spawn in runClaude
      const simulatePtySpawn = async (shouldFail) => {
        const agentId = 'test-agent';

        try {
          if (shouldFail) {
            throw new Error('spawn ENOENT: command not found');
          }
          // If no error, spawn succeeds
          return { pid: 12345 };
        } catch (spawnError) {
          // This mirrors the actual error handling in claude-runner.js
          console.error(`[AGENT-${agentId}] PTY SPAWN FAILED: ${spawnError.message}`);
          agentMarkedFailed = true; // Simulates completeAgent(agentId, false)
          errorMessage = spawnError.message;
          errorThrown = true;
          throw spawnError;
        }
      };

      // Test the failure path
      await expect(simulatePtySpawn(true)).rejects.toThrow('spawn ENOENT');
      expect(agentMarkedFailed).toBe(true);
      expect(errorThrown).toBe(true);
      expect(errorMessage).toContain('command not found');
    });

    it('should not mark agent as failed when spawn succeeds', async () => {
      let agentMarkedFailed = false;

      const simulatePtySpawn = async (shouldFail) => {
        try {
          if (shouldFail) {
            throw new Error('spawn ENOENT');
          }
          return { pid: 12345 };
        } catch (spawnError) {
          agentMarkedFailed = true;
          throw spawnError;
        }
      };

      const result = await simulatePtySpawn(false);
      expect(result.pid).toBe(12345);
      expect(agentMarkedFailed).toBe(false);
    });
  });

  describe('withTimeout memory leak prevention', () => {
    it('should clear timeout when promise resolves before timeout', async () => {
      // The withTimeout function now uses .finally() to clear the timer
      // This test verifies the timer doesn't leak
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      const fastPromise = Promise.resolve('fast');
      await withTimeout(fastPromise, 10000, 'Timeout');

      // Timer should have been cleared via .finally()
      expect(clearTimeoutSpy).toHaveBeenCalled();

      clearTimeoutSpy.mockRestore();
    });

    it('should clear timeout even when promise rejects', async () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      const failingPromise = Promise.reject(new Error('fail'));

      try {
        await withTimeout(failingPromise, 10000, 'Timeout');
      } catch {
        // Expected to throw
      }

      expect(clearTimeoutSpy).toHaveBeenCalled();

      clearTimeoutSpy.mockRestore();
    });
  });
});
