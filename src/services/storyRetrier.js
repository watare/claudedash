/**
 * Story Retrier Service
 *
 * Handles retry logic for failed/killed stories, including:
 * - Validating story can be retried
 * - Checking max retry limits
 * - Spawning new Claude agent
 * - Updating sprint status
 *
 * Story 4.3: Retry Story API & Backend
 */

import {
  getStory,
  updateStatus,
  incrementRetry,
  getRetryCount,
  registerStory,
} from './storyTracker.js';
import { emitStoryRetry, emitAgentSpawn } from './websocket.js';
import { registerAgent as registerAgentProcess } from './agentRegistry.js';
import { updateSprintStatus, parseSprintStatus } from '../parser.js';

/**
 * @typedef {Object} RetryResult
 * @property {string} storyId - Story identifier
 * @property {string} status - New status ('pending')
 * @property {string} agentId - ID of spawned agent
 * @property {string|null} warning - Warning message if max retries exceeded
 * @property {number} retryCount - Current retry count
 */

/**
 * @typedef {Object} RetryOptions
 * @property {Object} config - Application config with maxStoryRetries
 * @property {string} [projectPath] - Path to project root (for sprint status)
 * @property {Function} [spawnAgent] - Agent spawn function (injected for testing)
 */

/**
 * Retry a failed or killed story
 *
 * @param {string} storyId - Story identifier to retry
 * @param {RetryOptions} options - Retry options
 * @returns {Promise<RetryResult>} Retry result
 * @throws {Error} If story cannot be retried
 */
export async function retryStory(storyId, options = {}) {
  const { config = {}, projectPath, spawnAgent } = options;
  const maxRetries = config.maxStoryRetries || 3;

  // Get or create story in tracker
  let story = getStory(storyId);

  if (!story) {
    // Try to sync from sprint status if provided
    if (projectPath && config.sprintStatusPath) {
      try {
        const sprintStatus = parseSprintStatus(config.sprintStatusPath);
        const status = sprintStatus[storyId];
        if (status) {
          story = registerStory(storyId, status);
        }
      } catch {
        // Sprint status not available, story truly not found
      }
    }

    if (!story) {
      throw new Error('Story not found');
    }
  }

  // Validate story state
  if (story.status === 'in-progress') {
    throw new Error('Story already in progress');
  }

  const retryableStates = ['failed', 'killed'];
  if (!retryableStates.includes(story.status)) {
    throw new Error(`Cannot retry story in ${story.status} state`);
  }

  // Increment retry count
  const retryCount = incrementRetry(storyId);

  // Check max retries - warn but still proceed
  const warning =
    retryCount > maxRetries
      ? `This story has failed ${retryCount} times. Max retries (${maxRetries}) exceeded.`
      : null;

  // Update status to pending
  updateStatus(storyId, 'pending');

  // Generate agent ID
  const agentId = `agent-${storyId}-${Date.now()}`;

  // Broadcast story:retry event (AC4)
  emitStoryRetry({
    storyId,
    status: 'pending',
    retryCount,
    agentId,
  });

  // Spawn new agent (async, don't await by default)
  if (spawnAgent) {
    // Use injected spawn function (for testing)
    spawnAgent(storyId, agentId, config);
  } else if (options.spawnAgentAsync !== false) {
    // Default: spawn agent asynchronously
    spawnAgentForStory(storyId, agentId, config).catch((err) => {
      console.error(`[storyRetrier] Failed to spawn agent for ${storyId}:`, err.message);
      updateStatus(storyId, 'failed', err.message);
    });
  }

  // Update sprint status if path provided
  if (projectPath && config.sprintStatusPath) {
    try {
      updateSprintStatus(config.sprintStatusPath, {
        [storyId]: 'pending',
      });
    } catch (err) {
      console.error(`[storyRetrier] Failed to update sprint status:`, err.message);
      // Non-fatal - continue with retry
    }
  }

  return {
    storyId,
    status: 'pending',
    agentId,
    warning,
    retryCount,
  };
}

/**
 * Spawn a new Claude agent for a story
 *
 * @param {string} storyId - Story identifier
 * @param {string} agentId - Agent ID to use
 * @param {Object} config - Application config
 * @returns {Promise<void>}
 */
async function spawnAgentForStory(storyId, agentId, config) {
  // Import dynamically to avoid circular dependencies
  const { runDevStory } = await import('../claude-runner.js');

  // Update status to in-progress when agent starts
  updateStatus(storyId, 'in-progress');

  // Build story/agent info for tracking
  const story = {
    id: storyId,
    slug: storyId, // Use storyId as slug if not available
    title: `Retry: ${storyId}`,
  };

  // Broadcast agent:spawn event (AC4)
  // Note: The actual subprocess gets registered in runDevStory via agentRegistry
  // This agentId is a correlation ID for the retry operation
  emitAgentSpawn({
    id: agentId,
    projectId: config.projectId || config.projectRoot?.split('/').pop() || 'unknown',
    storyId,
    storyTitle: story.title,
  });

  // Determine branch name
  const branch = config.branchPrefix
    ? `${config.branchPrefix}${storyId}`
    : `feature/${storyId}`;

  try {
    // Run the dev-story workflow
    const result = await runDevStory(story, branch, config);

    if (result.success) {
      updateStatus(storyId, 'review');
    } else {
      updateStatus(storyId, 'failed', result.stderr || result.error);
    }
  } catch (err) {
    updateStatus(storyId, 'failed', err.message);
    throw err;
  }
}

/**
 * Check if a story can be retried
 *
 * @param {string} storyId - Story identifier
 * @returns {{ canRetry: boolean, reason?: string, retryCount?: number }}
 */
export function canRetryStory(storyId) {
  const story = getStory(storyId);

  if (!story) {
    return { canRetry: false, reason: 'Story not found' };
  }

  if (story.status === 'in-progress') {
    return { canRetry: false, reason: 'Story already in progress' };
  }

  const retryableStates = ['failed', 'killed'];
  if (!retryableStates.includes(story.status)) {
    return { canRetry: false, reason: `Cannot retry story in ${story.status} state` };
  }

  return {
    canRetry: true,
    retryCount: story.retryCount,
  };
}

/**
 * Get retry statistics for a story
 *
 * @param {string} storyId - Story identifier
 * @returns {{ retryCount: number, maxRetries: number, exceededMax: boolean } | null}
 */
export function getRetryStats(storyId, config = {}) {
  const story = getStory(storyId);
  if (!story) {
    return null;
  }

  const maxRetries = config.maxStoryRetries || 3;
  return {
    retryCount: story.retryCount,
    maxRetries,
    exceededMax: story.retryCount > maxRetries,
  };
}
