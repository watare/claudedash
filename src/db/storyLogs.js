/**
 * Story audit logging functions
 *
 * Story 4.3: Retry Story API & Backend
 */

import { getDb } from './sqlite.js';

/**
 * @typedef {Object} StoryRetryLogEntry
 * @property {string} timestamp - ISO 8601 timestamp
 * @property {string} user - Username or user ID
 * @property {string} action - Action type ('story:retry')
 * @property {string} [project] - Project ID
 * @property {string} [details] - JSON string with additional details
 */

/**
 * Insert a story retry action into the audit log
 *
 * Fields logged per AC1:
 * - timestamp
 * - user
 * - action='story:retry'
 * - project
 * - details={storyId, retryCount}
 *
 * @param {StoryRetryLogEntry} entry - Log entry
 * @returns {Promise<number>} Inserted row ID
 */
export async function insertStoryRetryLog(entry) {
  const db = getDb();

  const stmt = db.prepare(`
    INSERT INTO audit_log (timestamp, user, action, project, details)
    VALUES (?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    entry.timestamp,
    entry.user || null,
    entry.action,
    entry.project || null,
    entry.details || null
  );

  return result.lastInsertRowid;
}

/**
 * Query story retry logs with filters
 * @param {Object} filters - Query filters
 * @param {string} [filters.project] - Filter by project
 * @param {string} [filters.user] - Filter by user
 * @param {string} [filters.storyId] - Filter by story ID (in details JSON)
 * @param {string} [filters.dateFrom] - Start date
 * @param {string} [filters.dateTo] - End date
 * @param {number} [filters.limit] - Max results (default 50)
 * @param {number} [filters.offset] - Pagination offset
 * @returns {Promise<Object>} Query result with rows and total
 */
export async function queryStoryRetryLogs(filters = {}) {
  const db = getDb();

  const conditions = ["action = 'story:retry'"];
  const params = [];

  if (filters.project) {
    conditions.push('project = ?');
    params.push(filters.project);
  }

  if (filters.user) {
    conditions.push('user = ?');
    params.push(filters.user);
  }

  if (filters.storyId) {
    // Search in JSON details for storyId
    conditions.push("details LIKE ?");
    params.push(`%"storyId":"${filters.storyId}"%`);
  }

  if (filters.dateFrom) {
    conditions.push('timestamp >= ?');
    params.push(filters.dateFrom);
  }

  if (filters.dateTo) {
    conditions.push('timestamp <= ?');
    params.push(filters.dateTo);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  // Count total
  const countStmt = db.prepare(`
    SELECT COUNT(*) as total FROM audit_log ${whereClause}
  `);
  const { total } = countStmt.get(...params);

  // Get paginated results
  const limit = Math.min(Math.max(filters.limit || 50, 1), 100);
  const offset = Math.max(filters.offset || 0, 0);

  const dataStmt = db.prepare(`
    SELECT id, timestamp, user, action, project, details
    FROM audit_log
    ${whereClause}
    ORDER BY timestamp DESC
    LIMIT ? OFFSET ?
  `);

  const rows = dataStmt.all(...params, limit, offset);

  // Parse details JSON for convenience
  const parsedRows = rows.map((row) => ({
    ...row,
    parsedDetails: row.details ? JSON.parse(row.details) : null,
  }));

  return { rows: parsedRows, total };
}

/**
 * Get retry history for a specific story
 * @param {string} storyId - Story identifier
 * @param {number} [limit] - Max results (default 10)
 * @returns {Promise<Array>} Array of retry log entries
 */
export async function getStoryRetryHistory(storyId, limit = 10) {
  const result = await queryStoryRetryLogs({
    storyId,
    limit,
  });

  return result.rows;
}
