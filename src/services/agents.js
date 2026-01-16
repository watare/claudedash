/**
 * Agents service - provides agent data from claude-runner state
 *
 * Story 4.1: Added killAgentById with audit logging and WebSocket broadcast
 */

import {
  getActiveAgents as getActiveAgentsFromRunner,
  getAllAgents as getAllAgentsFromRunner,
  getAgentById as getAgentByIdFromRunner,
  getAgentsByProject as getAgentsByProjectFromRunner,
} from '../claude-runner.js';
import { killAgentProcess } from './agentKiller.js';
import { getAgent as getAgentFromRegistry } from './agentRegistry.js';
import { broadcast } from './websocket.js';
import { insertAgentKillLog } from '../db/agentLogs.js';

/**
 * Truncate output string to specified length
 * @param {string} output - Output string
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated output
 */
function truncateOutput(output, maxLength = 100) {
  if (!output) return '';
  return output.length > maxLength
    ? output.substring(0, maxLength) + '...'
    : output;
}

/**
 * Derive agent status based on activity
 * @param {Object} agent - Agent object
 * @returns {string} Derived status
 */
function deriveAgentStatus(agent) {
  if (agent.killed) return 'killed';
  if (agent.completed) return agent.status === 'failed' ? 'failed' : 'completed';

  // Check for stuck (no activity for 30 minutes)
  const inactiveMs = Date.now() - new Date(agent.lastActivity).getTime();
  if (inactiveMs > 30 * 60 * 1000) return 'stuck';

  return 'running';
}

/**
 * Calculate duration since agent started
 * @param {string} startedAt - ISO timestamp
 * @returns {number} Duration in seconds
 */
function calculateDuration(startedAt) {
  const startTime = new Date(startedAt).getTime();
  return Math.floor((Date.now() - startTime) / 1000);
}

/**
 * Format agent data for API response
 * @param {Object} agent - Raw agent object from runner
 * @returns {Object} Formatted agent data
 */
function formatAgentData(agent) {
  return {
    id: agent.id,
    projectId: agent.projectId,
    storyId: agent.storyId,
    storyTitle: agent.storyTitle || `Story ${agent.storyId}`,
    status: deriveAgentStatus(agent),
    startedAt: agent.startedAt,
    lastActivity: agent.lastActivity,
    lastOutput: truncateOutput(agent.lastOutput, 100),
    duration: calculateDuration(agent.startedAt),
  };
}

/**
 * Format agent data with output history for single agent endpoint
 * @param {Object} agent - Raw agent object from runner
 * @returns {Object} Formatted agent data with history
 */
function formatAgentDataWithHistory(agent) {
  return {
    ...formatAgentData(agent),
    outputHistory: agent.outputHistory || [],
  };
}

/**
 * Get all active agents (not completed or killed)
 * @returns {Promise<Array>} Array of formatted active agents
 */
export async function getAllAgents() {
  const agents = getActiveAgentsFromRunner();
  return agents.map(formatAgentData);
}

/**
 * Get agents filtered by project ID
 * @param {string} projectId - Project ID to filter by
 * @returns {Promise<Array>} Array of formatted agents for the project
 */
export async function getAgentsByProject(projectId) {
  try {
    const agents = getAgentsByProjectFromRunner(projectId);
    return agents.map(formatAgentData);
  } catch (error) {
    console.error(`Error fetching agents for project ${projectId}:`, error.message);
    return []; // Return empty array on error rather than crashing
  }
}

/**
 * Get a single agent by ID with full details including output history
 * @param {string} agentId - Agent ID
 * @returns {Promise<Object|null>} Formatted agent with history or null
 */
export async function getAgentById(agentId) {
  const agent = getAgentByIdFromRunner(agentId);
  if (!agent) return null;
  return formatAgentDataWithHistory(agent);
}

/**
 * Kill an agent by ID with graceful termination
 *
 * Story 4.1: Kill Agent API & Backend
 *
 * @param {string} agentId - Agent ID to kill
 * @param {Object} context - Kill context
 * @param {string} [context.userId] - User who initiated the kill
 * @param {string} [context.username] - Username who initiated the kill
 * @param {string} [context.reason] - Reason for killing
 * @returns {Promise<Object>} Kill result
 */
export async function killAgentById(agentId, context = {}) {
  // First check if agent exists in runner state
  const agentData = getAgentByIdFromRunner(agentId);

  if (!agentData) {
    return {
      success: false,
      agentId,
      error: 'Agent not found',
      timestamp: new Date().toISOString(),
    };
  }

  // Check if agent is in the process registry (has a killable process)
  const registeredAgent = getAgentFromRegistry(agentId);

  if (!registeredAgent) {
    // Agent exists in runner but not in registry (no process to kill)
    // This can happen if the process already exited naturally
    return {
      success: false,
      agentId,
      error: 'Agent not found',
      timestamp: new Date().toISOString(),
    };
  }

  // Kill the process
  const killResult = await killAgentProcess(agentId);

  // Log to audit_log (AC1 requirement)
  try {
    await insertAgentKillLog({
      timestamp: killResult.timestamp,
      user: context.username || context.userId || 'system',
      action: 'agent:kill',
      project: agentData.projectId,
      details: JSON.stringify({
        agentId,
        method: killResult.method,
        reason: context.reason || 'User requested kill',
        storyId: agentData.storyId,
        success: killResult.success,
      }),
    });
  } catch (logError) {
    console.error('Failed to log agent kill action:', logError.message);
    // Don't fail the kill operation if logging fails
  }

  // Broadcast WebSocket event (AC3 requirement)
  if (killResult.success) {
    broadcast('agent:kill', {
      agentId,
      status: 'killed',
      method: killResult.method,
      timestamp: killResult.timestamp,
    });
  }

  return killResult;
}
