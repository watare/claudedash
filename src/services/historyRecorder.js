/**
 * History Recorder Service
 * Story 4.7: Execution History View
 *
 * Records orchestration runs and events for historical analysis.
 */

import { getDb } from '../db/sqlite.js';

// Track current active run for event recording
let currentRunId = null;

/**
 * Start recording a new orchestration run
 * @param {string} project - Project name/path
 * @param {Object} config - Config snapshot to store
 * @returns {number} - The run ID
 */
export function startRun(project, config = {}) {
  const db = getDb();

  const stmt = db.prepare(`
    INSERT INTO execution_runs (project, status, config)
    VALUES (?, 'running', ?)
  `);

  // Sanitize config - remove sensitive data
  const sanitizedConfig = {
    projectRoot: config.projectRoot,
    batchSize: config.batchSize,
    maxRetries: config.maxRetries,
    epicFilter: config.epicFilter,
    storyFilter: config.storyFilter,
  };

  const result = stmt.run(project, JSON.stringify(sanitizedConfig));
  currentRunId = result.lastInsertRowid;

  return currentRunId;
}

/**
 * Record an event during the current run
 * @param {string} type - Event type (agent:spawn, agent:complete, agent:error, etc.)
 * @param {Object} data - Event data
 * @param {string} [data.agentId] - Agent ID
 * @param {string} [data.storyId] - Story ID
 * @param {number} [data.epicNumber] - Epic number
 * @param {Object} [data.details] - Additional event details
 */
export function recordEvent(type, data = {}) {
  if (!currentRunId) {
    console.warn('[HistoryRecorder] No active run, event not recorded:', type);
    return null;
  }

  const db = getDb();

  const stmt = db.prepare(`
    INSERT INTO execution_events (run_id, type, agent_id, story_id, epic_number, details)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    currentRunId,
    type,
    data.agentId || null,
    data.storyId || null,
    data.epicNumber || null,
    data.details ? JSON.stringify(data.details) : null
  );

  return result.lastInsertRowid;
}

/**
 * End the current orchestration run
 * @param {string} status - Final status (completed, failed, stopped)
 * @param {Object} stats - Run statistics
 * @param {number} [stats.completed] - Number of completed stories
 * @param {number} [stats.failed] - Number of failed stories
 * @param {number} [stats.total] - Total number of stories
 * @returns {number|null} - The completed run ID
 */
export function endRun(status, stats = {}) {
  if (!currentRunId) {
    console.warn('[HistoryRecorder] No active run to end');
    return null;
  }

  const db = getDb();

  // Get the run's start time to calculate duration
  const run = db.prepare('SELECT started_at FROM execution_runs WHERE id = ?').get(currentRunId);

  let durationMs = 0;
  if (run?.started_at) {
    durationMs = Date.now() - new Date(run.started_at).getTime();
  }

  const stmt = db.prepare(`
    UPDATE execution_runs
    SET ended_at = datetime('now'),
        status = ?,
        stories_completed = ?,
        stories_failed = ?,
        stories_total = ?,
        duration_ms = ?
    WHERE id = ?
  `);

  stmt.run(
    status,
    stats.completed || 0,
    stats.failed || 0,
    stats.total || 0,
    durationMs,
    currentRunId
  );

  const completedRunId = currentRunId;
  currentRunId = null;

  return completedRunId;
}

/**
 * Get the current active run ID
 * @returns {number|null}
 */
export function getCurrentRunId() {
  return currentRunId;
}

/**
 * Update stories total for the current run
 * @param {number} total - Total number of stories
 */
export function updateStoriesTotalForCurrentRun(total) {
  if (!currentRunId) return;

  const db = getDb();
  const stmt = db.prepare('UPDATE execution_runs SET stories_total = ? WHERE id = ?');
  stmt.run(total, currentRunId);
}

/**
 * Increment completed stories count
 */
export function incrementCompletedStories() {
  if (!currentRunId) return;

  const db = getDb();
  const stmt = db.prepare('UPDATE execution_runs SET stories_completed = stories_completed + 1 WHERE id = ?');
  stmt.run(currentRunId);
}

/**
 * Increment failed stories count
 */
export function incrementFailedStories() {
  if (!currentRunId) return;

  const db = getDb();
  const stmt = db.prepare('UPDATE execution_runs SET stories_failed = stories_failed + 1 WHERE id = ?');
  stmt.run(currentRunId);
}

/**
 * Query execution runs with filters and pagination
 * @param {Object} filters - Query filters
 * @param {string} [filters.project] - Filter by project
 * @param {string} [filters.status] - Filter by status
 * @param {string} [filters.startDate] - Filter by start date (>=)
 * @param {string} [filters.endDate] - Filter by end date (<=)
 * @param {number} [filters.page=1] - Page number
 * @param {number} [filters.limit=20] - Items per page
 * @returns {Object} - { data: runs[], meta: { total, page, limit, pages } }
 */
export function queryRuns(filters = {}) {
  const db = getDb();

  const page = Math.max(1, filters.page || 1);
  const limit = Math.min(100, Math.max(1, filters.limit || 20));
  const offset = (page - 1) * limit;

  let whereClause = 'WHERE 1=1';
  const params = [];

  if (filters.project) {
    whereClause += ' AND project = ?';
    params.push(filters.project);
  }

  if (filters.status) {
    whereClause += ' AND status = ?';
    params.push(filters.status);
  }

  if (filters.startDate) {
    whereClause += ' AND started_at >= ?';
    params.push(filters.startDate);
  }

  if (filters.endDate) {
    whereClause += ' AND started_at <= ?';
    params.push(filters.endDate);
  }

  // Get total count
  const countQuery = `SELECT COUNT(*) as count FROM execution_runs ${whereClause}`;
  const countResult = db.prepare(countQuery).get(...params);
  const total = countResult.count;

  // Get paginated results
  const dataQuery = `
    SELECT * FROM execution_runs
    ${whereClause}
    ORDER BY started_at DESC
    LIMIT ? OFFSET ?
  `;

  const runs = db.prepare(dataQuery).all(...params, limit, offset);

  return {
    data: runs.map(formatRun),
    meta: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  };
}

/**
 * Get a specific run with its events
 * @param {number} runId - Run ID
 * @returns {Object|null} - Run data with events, or null if not found
 */
export function getRunWithEvents(runId) {
  const db = getDb();

  const run = db.prepare('SELECT * FROM execution_runs WHERE id = ?').get(runId);

  if (!run) {
    return null;
  }

  const events = db.prepare(`
    SELECT * FROM execution_events
    WHERE run_id = ?
    ORDER BY timestamp ASC
  `).all(runId);

  return {
    ...formatRun(run),
    events: events.map(formatEvent),
  };
}

/**
 * Format a run record for API response
 * @param {Object} run - Raw database record
 * @returns {Object} - Formatted run object
 */
function formatRun(run) {
  return {
    id: run.id,
    project: run.project,
    startedAt: run.started_at,
    endedAt: run.ended_at,
    status: run.status,
    storiesCompleted: run.stories_completed,
    storiesFailed: run.stories_failed,
    storiesTotal: run.stories_total,
    duration: formatDuration(run.duration_ms),
    durationMs: run.duration_ms,
    config: run.config ? JSON.parse(run.config) : null,
    createdAt: run.created_at,
  };
}

/**
 * Format an event record for API response
 * @param {Object} event - Raw database record
 * @returns {Object} - Formatted event object
 */
function formatEvent(event) {
  return {
    id: event.id,
    timestamp: event.timestamp,
    type: event.type,
    agentId: event.agent_id,
    storyId: event.story_id,
    epicNumber: event.epic_number,
    details: event.details ? JSON.parse(event.details) : {},
  };
}

/**
 * Format duration in milliseconds to human-readable string
 * @param {number} ms - Duration in milliseconds
 * @returns {string} - Formatted duration
 */
function formatDuration(ms) {
  if (!ms) return '-';

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

// Reset for testing purposes
export function _resetForTesting() {
  currentRunId = null;
}
