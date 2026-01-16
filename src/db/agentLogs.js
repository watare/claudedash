/**
 * Agent audit logging functions
 *
 * Story 4.1: Kill Agent API & Backend
 */

import { getDb } from './sqlite.js';

/**
 * @typedef {Object} AgentKillLogEntry
 * @property {string} timestamp - ISO 8601 timestamp
 * @property {string} user - Username or user ID
 * @property {string} action - Action type (e.g., 'agent:kill')
 * @property {string} [project] - Project ID
 * @property {string} [details] - JSON string with additional details
 */

/**
 * Insert an agent kill action into the audit log
 *
 * Fields logged per AC1:
 * - timestamp
 * - user
 * - action='agent:kill'
 * - project
 * - details={agentId, method, reason}
 *
 * @param {AgentKillLogEntry} entry - Log entry
 * @returns {number} Inserted row ID
 */
export function insertAgentKillLog(entry) {
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
 * Query agent kill logs with filters
 * @param {Object} filters - Query filters
 * @param {string} [filters.project] - Filter by project
 * @param {string} [filters.user] - Filter by user
 * @param {string} [filters.dateFrom] - Start date
 * @param {string} [filters.dateTo] - End date
 * @param {number} [filters.limit] - Max results (default 50)
 * @param {number} [filters.offset] - Pagination offset
 * @returns {Object} Query result with rows and total
 */
export function queryAgentKillLogs(filters = {}) {
  const db = getDb();

  const conditions = ["action = 'agent:kill'"];
  const params = [];

  if (filters.project) {
    conditions.push('project = ?');
    params.push(filters.project);
  }

  if (filters.user) {
    conditions.push('user = ?');
    params.push(filters.user);
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

  return { rows, total };
}
