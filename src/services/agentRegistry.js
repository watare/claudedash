/**
 * Agent Registry Service
 *
 * Tracks active Claude processes with their subprocess handles for
 * management operations (kill, monitor). Works alongside the existing
 * agent tracking in claude-runner.js to add process-level control.
 *
 * Story 4.1: Kill Agent API & Backend
 */

/**
 * @typedef {Object} RegisteredAgent
 * @property {string} id - Agent ID
 * @property {number} pid - Process ID
 * @property {import('child_process').ChildProcess|null} process - Subprocess handle
 * @property {string} storyId - Story identifier
 * @property {string} projectId - Project identifier
 * @property {string} startedAt - ISO timestamp
 * @property {string} lastActivity - ISO timestamp
 * @property {string} status - Agent status: 'running' | 'completed' | 'failed' | 'killed'
 */

/**
 * Map of agent ID to registered agent data
 * @type {Map<string, RegisteredAgent>}
 */
const agentProcesses = new Map();

/**
 * Register an agent with its subprocess handle
 * @param {string} id - Agent ID (from claude-runner)
 * @param {import('child_process').ChildProcess} childProcess - The spawned subprocess
 * @param {Object} metadata - Additional agent metadata
 * @param {string} metadata.storyId - Story identifier
 * @param {string} metadata.projectId - Project identifier
 */
export function registerAgent(id, childProcess, metadata = {}) {
  const now = new Date().toISOString();

  const agent = {
    id,
    pid: childProcess.pid,
    process: childProcess,
    storyId: metadata.storyId || null,
    projectId: metadata.projectId || null,
    startedAt: now,
    lastActivity: now,
    status: 'running',
  };

  agentProcesses.set(id, agent);

  return agent;
}

/**
 * Get an agent by ID
 * @param {string} id - Agent ID
 * @returns {RegisteredAgent|undefined}
 */
export function getAgent(id) {
  return agentProcesses.get(id);
}

/**
 * Remove an agent from the registry
 * @param {string} id - Agent ID
 * @returns {boolean} True if agent was removed
 */
export function removeAgent(id) {
  return agentProcesses.delete(id);
}

/**
 * Get all registered agents
 * @returns {RegisteredAgent[]}
 */
export function getAllAgents() {
  return Array.from(agentProcesses.values());
}

/**
 * Get all active (running) agents
 * @returns {RegisteredAgent[]}
 */
export function getActiveAgents() {
  return Array.from(agentProcesses.values()).filter(
    (agent) => agent.status === 'running'
  );
}

/**
 * Update agent status
 * @param {string} id - Agent ID
 * @param {string} status - New status
 */
export function updateAgentStatus(id, status) {
  const agent = agentProcesses.get(id);
  if (agent) {
    agent.status = status;
    agent.lastActivity = new Date().toISOString();
  }
}

/**
 * Update agent last activity timestamp
 * @param {string} id - Agent ID
 */
export function updateAgentActivity(id) {
  const agent = agentProcesses.get(id);
  if (agent) {
    agent.lastActivity = new Date().toISOString();
  }
}

/**
 * Check if an agent exists
 * @param {string} id - Agent ID
 * @returns {boolean}
 */
export function hasAgent(id) {
  return agentProcesses.has(id);
}

/**
 * Get agent count
 * @returns {number}
 */
export function getAgentCount() {
  return agentProcesses.size;
}

/**
 * Clear all agents (for testing)
 */
export function clearAllAgents() {
  agentProcesses.clear();
}
