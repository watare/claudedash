/**
 * Story Tracking Service
 *
 * Tracks story state including status, retry count, and last error.
 * Used by the retry story service to manage story lifecycle.
 *
 * Story 4.3: Retry Story API & Backend
 */

/**
 * @typedef {Object} TrackedStory
 * @property {string} id - Story identifier
 * @property {string} status - Story status: 'pending' | 'in-progress' | 'failed' | 'killed' | 'done' | 'review'
 * @property {number} retryCount - Number of retry attempts
 * @property {string|null} lastError - Last error message if failed
 * @property {string} updatedAt - ISO timestamp of last update
 */

/**
 * Map of story ID to tracked story data
 * @type {Map<string, TrackedStory>}
 */
const stories = new Map();

/**
 * Get a tracked story by ID
 * @param {string} id - Story identifier
 * @returns {TrackedStory|null} Story object or null if not found
 */
export function getStory(id) {
  return stories.get(id) || null;
}

/**
 * Update story status
 * @param {string} id - Story identifier
 * @param {string} status - New status
 * @param {string|null} [error] - Optional error message (for failed status)
 * @returns {TrackedStory} Updated story object
 */
export function updateStatus(id, status, error = null) {
  const existing = stories.get(id);
  const story = existing || { id, retryCount: 0 };

  story.status = status;
  story.lastError = error;
  story.updatedAt = new Date().toISOString();

  stories.set(id, story);
  return story;
}

/**
 * Increment retry count for a story
 * @param {string} id - Story identifier
 * @returns {number} New retry count
 */
export function incrementRetry(id) {
  const story = stories.get(id);
  if (story) {
    story.retryCount = (story.retryCount || 0) + 1;
    story.updatedAt = new Date().toISOString();
    stories.set(id, story);
    return story.retryCount;
  }

  // Story doesn't exist - create it with retry count 1
  const newStory = {
    id,
    status: 'pending',
    retryCount: 1,
    lastError: null,
    updatedAt: new Date().toISOString(),
  };
  stories.set(id, newStory);
  return 1;
}

/**
 * Get retry count for a story
 * @param {string} id - Story identifier
 * @returns {number} Current retry count (0 if not tracked)
 */
export function getRetryCount(id) {
  const story = stories.get(id);
  return story?.retryCount || 0;
}

/**
 * Check if a story is in a retryable state
 * Retryable states: 'failed', 'killed'
 * @param {string} id - Story identifier
 * @returns {{ retryable: boolean, reason?: string }} Retryability status
 */
export function isRetryable(id) {
  const story = stories.get(id);

  if (!story) {
    return { retryable: false, reason: 'Story not found in tracker' };
  }

  const retryableStates = ['failed', 'killed'];
  const nonRetryableStates = ['pending', 'in-progress', 'done', 'review'];

  if (story.status === 'in-progress') {
    return { retryable: false, reason: 'Story already in progress' };
  }

  if (nonRetryableStates.includes(story.status) && story.status !== 'in-progress') {
    return { retryable: false, reason: `Cannot retry story in ${story.status} state` };
  }

  if (retryableStates.includes(story.status)) {
    return { retryable: true };
  }

  return { retryable: false, reason: `Unknown status: ${story.status}` };
}

/**
 * Register a story with initial state
 * Used when a story is first discovered or when syncing from external sources
 * @param {string} id - Story identifier
 * @param {string} status - Initial status
 * @returns {TrackedStory} Created story object
 */
export function registerStory(id, status) {
  const existing = stories.get(id);
  if (existing) {
    // Update status if already exists
    existing.status = status;
    existing.updatedAt = new Date().toISOString();
    return existing;
  }

  const story = {
    id,
    status,
    retryCount: 0,
    lastError: null,
    updatedAt: new Date().toISOString(),
  };

  stories.set(id, story);
  return story;
}

/**
 * Get all tracked stories
 * @returns {TrackedStory[]} Array of all tracked stories
 */
export function getAllStories() {
  return Array.from(stories.values());
}

/**
 * Get stories by status
 * @param {string} status - Status to filter by
 * @returns {TrackedStory[]} Array of stories with matching status
 */
export function getStoriesByStatus(status) {
  return Array.from(stories.values()).filter((s) => s.status === status);
}

/**
 * Clear all tracked stories (for testing)
 */
export function clearAllStories() {
  stories.clear();
}

/**
 * Get count of tracked stories
 * @returns {number} Number of tracked stories
 */
export function getStoryCount() {
  return stories.size;
}
