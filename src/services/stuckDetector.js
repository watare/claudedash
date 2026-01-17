/**
 * Stuck Agent Detection Service
 *
 * Monitors agents for inactivity and marks them as stuck when no output
 * is received within the configurable threshold. Broadcasts stuck events
 * via WebSocket for dashboard notification.
 *
 * Story 4.6: Stuck Agent Detection & Alerts
 */

import {
  getAllAgents,
  getAgent,
  markStuck,
} from './agentRegistry.js';
import { emitAgentStuck } from './websocket.js';

let checkInterval = null;
let thresholdMs = 30 * 60 * 1000; // Default: 30 minutes

/**
 * Start the stuck detection background service
 * @param {Object} config - Configuration object
 * @param {number} config.stuckThresholdMinutes - Minutes without output before marking stuck (default: 30)
 * @param {Function} [_broadcast] - Deprecated: broadcast function (now uses emitAgentStuck internally)
 */
export function startStuckDetection(config, _broadcast) {
  // Note: _broadcast parameter kept for backward compatibility but no longer used
  // Stuck events are now emitted via emitAgentStuck() for consistency with other agent events
  thresholdMs = (config.stuckThresholdMinutes || 30) * 60 * 1000;

  // Check every minute
  checkInterval = setInterval(() => {
    checkForStuckAgents();
  }, 60 * 1000);

  console.log(`Stuck detection started (threshold: ${config.stuckThresholdMinutes || 30}min)`);
}

/**
 * Stop the stuck detection service
 */
export function stopStuckDetection() {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
    console.log('Stuck detection stopped');
  }
}

/**
 * Check all agents for stuck status
 * Called every minute by the interval
 */
function checkForStuckAgents() {
  const now = Date.now();
  const agents = getAllAgents();

  for (const agent of agents) {
    // Skip already stuck, completed, failed, or killed agents
    if (
      agent.stuckAt ||
      agent.status === 'completed' ||
      agent.status === 'failed' ||
      agent.status === 'killed'
    ) {
      continue;
    }

    // Only check running agents
    if (agent.status !== 'running') {
      continue;
    }

    // Calculate time since last activity
    const lastActivityTime = agent.lastActivity
      ? new Date(agent.lastActivity).getTime()
      : agent.startedAt
        ? new Date(agent.startedAt).getTime()
        : now;

    const inactiveMs = now - lastActivityTime;

    if (inactiveMs > thresholdMs) {
      // Mark agent as stuck
      markStuck(agent.id);

      const durationMinutes = Math.floor(inactiveMs / 60000);
      const formattedDuration = formatDuration(inactiveMs);

      // Broadcast stuck event via WebSocket (AC2)
      emitAgentStuck({
        agentId: agent.id,
        storyId: agent.storyId,
        duration: formattedDuration,
        durationMinutes,
      });

      console.log(`Agent ${agent.id} marked as stuck (inactive for ${durationMinutes}min)`);
    }
  }
}

/**
 * Format duration in human-readable form
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration (e.g., "1h 30m" or "45m")
 */
function formatDuration(ms) {
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

/**
 * Get current stuck detection configuration
 * @returns {{ thresholdMs: number, isRunning: boolean }}
 */
export function getStuckDetectionStatus() {
  return {
    thresholdMs,
    thresholdMinutes: Math.floor(thresholdMs / 60000),
    isRunning: checkInterval !== null,
  };
}

/**
 * Manually check for stuck agents (for testing)
 * @returns {string[]} Array of agent IDs that were marked as stuck
 */
export function checkForStuckAgentsManual() {
  const now = Date.now();
  const agents = getAllAgents();
  const newlyStuck = [];

  for (const agent of agents) {
    if (
      agent.stuckAt ||
      agent.status === 'completed' ||
      agent.status === 'failed' ||
      agent.status === 'killed' ||
      agent.status !== 'running'
    ) {
      continue;
    }

    const lastActivityTime = agent.lastActivity
      ? new Date(agent.lastActivity).getTime()
      : agent.startedAt
        ? new Date(agent.startedAt).getTime()
        : now;

    const inactiveMs = now - lastActivityTime;

    if (inactiveMs > thresholdMs) {
      markStuck(agent.id);
      newlyStuck.push(agent.id);
    }
  }

  return newlyStuck;
}

/**
 * Update the stuck detection threshold
 * @param {number} minutes - New threshold in minutes
 */
export function updateStuckThreshold(minutes) {
  thresholdMs = minutes * 60 * 1000;
  console.log(`Stuck detection threshold updated to ${minutes}min`);
}
