/**
 * WebSocket broadcast service for real-time updates
 *
 * Provides functions to broadcast events to authenticated WebSocket clients.
 * Used by the orchestrator to push agent and project updates to the dashboard.
 */

// Store for authenticated WebSocket connections (userId -> ws)
let authenticatedClients = new Map();

/**
 * Set the authenticated clients map (used for testing and initialization)
 * @param {Map} clients - Map of userId to WebSocket connection
 */
export function setAuthenticatedClients(clients) {
  authenticatedClients = clients;
}

/**
 * Get the authenticated clients map
 * @returns {Map} Map of userId to WebSocket connection
 */
export function getAuthenticatedClients() {
  return authenticatedClients;
}

/**
 * Broadcast event to all authenticated clients
 * @param {string} type - Event type in format '{entity}:{action}'
 * @param {unknown} data - Event payload
 */
export function broadcast(type, data) {
  const message = JSON.stringify({
    type,
    data,
    timestamp: new Date().toISOString(),
  });

  authenticatedClients.forEach((ws) => {
    if (ws.readyState === 1) { // WebSocket.OPEN
      try {
        ws.send(message);
      } catch {
        // Ignore send errors - client may have disconnected
      }
    }
  });
}

/**
 * Broadcast event to specific user
 * @param {string} userId - User ID to send to
 * @param {string} type - Event type
 * @param {unknown} data - Event payload
 */
export function broadcastToUser(userId, type, data) {
  const ws = authenticatedClients.get(userId);
  if (ws && ws.readyState === 1) {
    try {
      ws.send(JSON.stringify({
        type,
        data,
        timestamp: new Date().toISOString(),
      }));
    } catch {
      // Ignore send errors
    }
  }
}

/**
 * Emit agent:spawn event when a new agent starts
 * @param {{ id: string, projectId: string, storyId: string, storyTitle: string }} agent
 */
export function emitAgentSpawn(agent) {
  broadcast('agent:spawn', {
    agentId: agent.id,
    projectId: agent.projectId,
    storyId: agent.storyId,
    storyTitle: agent.storyTitle,
  });
}

/**
 * Emit agent:output event when agent produces output
 * @param {string} agentId - Agent ID
 * @param {string} output - Output text
 */
export function emitAgentOutput(agentId, output) {
  // Note: broadcast() already adds a timestamp to the message envelope
  broadcast('agent:output', {
    agentId,
    output,
  });
}

/**
 * Emit agent:complete event when agent finishes
 * @param {{ id: string, projectId: string, storyId: string }} agent
 * @param {'success' | 'failed'} result
 */
export function emitAgentComplete(agent, result) {
  broadcast('agent:complete', {
    agentId: agent.id,
    projectId: agent.projectId,
    storyId: agent.storyId,
    result,
  });
}

/**
 * Emit agent:stuck event when agent is detected as stuck
 * @param {{ id: string, projectId: string }} agent
 * @param {number} duration - Duration in seconds
 */
export function emitAgentStuck(agent, duration) {
  broadcast('agent:stuck', {
    agentId: agent.id,
    projectId: agent.projectId,
    duration,
  });
}

/**
 * Emit agent:killed event when agent is terminated
 * @param {{ id: string, projectId: string, storyId: string }} agent
 */
export function emitAgentKilled(agent) {
  broadcast('agent:killed', {
    agentId: agent.id,
    projectId: agent.projectId,
    storyId: agent.storyId,
  });
}

/**
 * Emit project:update event when project status changes
 * @param {{ id: string, status: string, currentEpic?: number, currentStory?: string }} project
 */
export function emitProjectUpdate(project) {
  broadcast('project:update', {
    projectId: project.id,
    status: project.status,
    currentEpic: project.currentEpic,
    currentStory: project.currentStory,
  });
}

/**
 * Emit project:start event when project orchestration starts
 * @param {{ id: string }} project
 */
export function emitProjectStart(project) {
  broadcast('project:start', {
    projectId: project.id,
  });
}

/**
 * Emit project:complete event when project finishes
 * @param {{ id: string, result: string }} project
 */
export function emitProjectComplete(project) {
  broadcast('project:complete', {
    projectId: project.id,
    result: project.result,
  });
}

/**
 * Emit story:verified event when story status is verified
 * @param {{ projectId: string, storyId: string, claimed: string, actual: string, match: boolean }} result
 */
export function emitStoryVerified(result) {
  broadcast('story:verified', result);
}

/**
 * Emit story:mismatch event when status verification fails
 * @param {{ projectId: string, storyId: string, claimed: string, actual: string }} result
 */
export function emitStoryMismatch(result) {
  broadcast('story:mismatch', result);
}

// ============================================================================
// Story 3.4: Verification Blocking WebSocket Events
// ============================================================================

/**
 * Emit story:verification_failed event when verification fails after max retries
 * @param {{ storyKey: string, attempts: number, claimed: string, actual: string, projectId: string }} data
 */
export function emitStoryVerificationFailed(data) {
  broadcast('story:verification_failed', {
    storyKey: data.storyKey,
    attempts: data.attempts,
    claimed: data.claimed,
    actual: data.actual,
    projectId: data.projectId,
  });
}

/**
 * Emit project:paused event when project orchestration is paused
 * @param {{ projectId: string, reason: string, pausedAt: string }} data
 */
export function emitProjectPaused(data) {
  broadcast('project:paused', {
    projectId: data.projectId,
    reason: data.reason,
    pausedAt: data.pausedAt,
  });
}

/**
 * Emit project:resumed event when project orchestration resumes
 * @param {{ projectId: string, resumedAt: string }} data
 */
export function emitProjectResumed(data) {
  broadcast('project:resumed', {
    projectId: data.projectId,
    resumedAt: data.resumedAt,
  });
}

// ============================================================================
// Story 4.3: Story Retry WebSocket Events
// ============================================================================

/**
 * Emit story:retry event when a story retry is initiated
 * @param {{ storyId: string, status: string, retryCount: number, agentId?: string }} data
 */
export function emitStoryRetry(data) {
  broadcast('story:retry', {
    storyId: data.storyId,
    status: data.status,
    retryCount: data.retryCount,
    agentId: data.agentId,
  });
}
