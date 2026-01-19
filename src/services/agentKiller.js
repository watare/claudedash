/**
 * Agent Killer Service
 *
 * Provides graceful termination logic for Claude subprocesses.
 * Sends SIGTERM first, waits for 5 seconds, then falls back to SIGKILL.
 *
 * Story 4.1: Kill Agent API & Backend
 */

import { getAgent, updateAgentStatus, removeAgent } from './agentRegistry.js';
import { killAgent as markAgentKilled } from '../claude-runner.js';
import { updateSprintStatus } from '../parser.js';

/**
 * @typedef {Object} KillResult
 * @property {boolean} success - Whether the kill succeeded
 * @property {string} agentId - Agent ID
 * @property {'SIGTERM'|'SIGKILL'|null} method - Termination method used
 * @property {string} timestamp - ISO timestamp
 * @property {string} [error] - Error message if failed
 */

/**
 * Wait for a process to exit
 * @param {number} pid - Process ID
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<boolean>} True if process exited, false if timeout
 */
async function waitForExit(pid, timeoutMs) {
  const startTime = Date.now();

  return new Promise((resolve) => {
    const checkInterval = setInterval(() => {
      try {
        // process.kill(pid, 0) throws if process doesn't exist
        process.kill(pid, 0);

        // Process still exists, check timeout
        if (Date.now() - startTime >= timeoutMs) {
          clearInterval(checkInterval);
          resolve(false);
        }
      } catch {
        // Process no longer exists
        clearInterval(checkInterval);
        resolve(true);
      }
    }, 100); // Check every 100ms
  });
}

/**
 * Check if a process is running
 * @param {number} pid - Process ID
 * @returns {boolean}
 */
function isProcessRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Update sprint status when agent is killed (Issue 3.3 fix)
 * @param {string} storyId - Story identifier
 * @param {string} sprintStatusPath - Path to sprint-status.yaml
 */
async function updateSprintStatusOnKill(storyId, sprintStatusPath) {
  if (!storyId || !sprintStatusPath) return;

  try {
    await updateSprintStatus(sprintStatusPath, { [storyId]: 'killed' });
    console.log(`[agentKiller] Updated sprint status for ${storyId} to 'killed'`);
  } catch (err) {
    console.error(`[agentKiller] Failed to update sprint status for ${storyId}:`, err.message);
  }
}

/**
 * Kill an agent's subprocess with graceful termination
 *
 * First sends SIGTERM and waits up to 5 seconds for graceful shutdown.
 * If the process doesn't terminate, sends SIGKILL.
 *
 * @param {string} agentId - Agent ID to kill
 * @param {Object} [options] - Options for kill operation
 * @param {string} [options.sprintStatusPath] - Path to sprint-status.yaml for status update
 * @returns {Promise<KillResult>}
 */
export async function killAgentProcess(agentId, options = {}) {
  const { sprintStatusPath } = options;
  const timestamp = new Date().toISOString();
  const agent = getAgent(agentId);

  if (!agent) {
    return {
      success: false,
      agentId,
      method: null,
      timestamp,
      error: 'Agent not found in registry',
    };
  }

  const { pid } = agent;

  // Check if process is still running
  if (!isProcessRunning(pid)) {
    // Process already dead, clean up registry
    updateAgentStatus(agentId, 'killed');
    markAgentKilled(agentId);

    // Update sprint status (Issue 3.3 fix)
    await updateSprintStatusOnKill(agent.storyId, sprintStatusPath);

    return {
      success: true,
      agentId,
      method: null,
      timestamp,
      error: 'Process already terminated',
    };
  }

  try {
    // Step 1: Send SIGTERM for graceful shutdown
    process.kill(pid, 'SIGTERM');

    // Step 2: Wait up to 5 seconds for graceful termination
    const terminated = await waitForExit(pid, 5000);

    if (terminated) {
      // Process terminated gracefully
      updateAgentStatus(agentId, 'killed');
      markAgentKilled(agentId);

      // Update sprint status (Issue 3.3 fix)
      await updateSprintStatusOnKill(agent.storyId, sprintStatusPath);

      return {
        success: true,
        agentId,
        method: 'SIGTERM',
        timestamp,
      };
    }

    // Step 3: Process didn't terminate, send SIGKILL
    process.kill(pid, 'SIGKILL');

    // Wait briefly for SIGKILL to take effect
    await waitForExit(pid, 1000);

    updateAgentStatus(agentId, 'killed');
    markAgentKilled(agentId);

    // Update sprint status (Issue 3.3 fix)
    await updateSprintStatusOnKill(agent.storyId, sprintStatusPath);

    return {
      success: true,
      agentId,
      method: 'SIGKILL',
      timestamp,
    };
  } catch (error) {
    // Handle ESRCH (no such process) - process already dead
    if (error.code === 'ESRCH') {
      updateAgentStatus(agentId, 'killed');
      markAgentKilled(agentId);

      // Update sprint status (Issue 3.3 fix)
      await updateSprintStatusOnKill(agent.storyId, sprintStatusPath);

      return {
        success: true,
        agentId,
        method: null,
        timestamp,
        error: 'Process already terminated',
      };
    }

    // Handle EPERM (permission denied)
    if (error.code === 'EPERM') {
      return {
        success: false,
        agentId,
        method: null,
        timestamp,
        error: 'Permission denied to kill process',
      };
    }

    return {
      success: false,
      agentId,
      method: null,
      timestamp,
      error: error.message,
    };
  }
}

export default killAgentProcess;
