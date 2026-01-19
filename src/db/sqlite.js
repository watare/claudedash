/**
 * SQLite database connection using better-sqlite3
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { runMigrations } from './migrate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, '../../data/orchestrator.db');

let db = null;

/**
 * Get the database instance
 * @returns {Database.Database} The database instance
 * @throws {Error} If database not initialized
 */
export function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return db;
}

/**
 * Initialize the database connection and run migrations
 */
export function initDb() {
  if (db) {
    return db;
  }

  db = new Database(DB_PATH);

  // Enable foreign keys and WAL mode for better performance
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');

  // Run migrations
  runMigrations(db);

  console.log(`[DB] SQLite database initialized at ${DB_PATH}`);

  return db;
}

/**
 * Close the database connection gracefully
 */
export function closeDb() {
  if (db) {
    db.close();
    db = null;
    console.log('[DB] Database connection closed');
  }
}

// ============================================================================
// Story 3.5: Verification Audit Log Functions
// ============================================================================

/**
 * @typedef {Object} AuditLogEntry
 * @property {string} timestamp - ISO 8601 timestamp
 * @property {string} storyId - Story identifier
 * @property {string} [projectId] - Project identifier
 * @property {string} claimedStatus - Status claimed by agent
 * @property {string} actualStatus - Actual status from YAML
 * @property {'match'|'mismatch'|'error'} result - Verification result
 * @property {string} [actionTaken] - Action taken after verification
 * @property {number} [durationMs] - Duration in milliseconds
 * @property {number} [attemptCount] - Number of attempts
 * @property {string} [details] - Additional JSON details
 */

/**
 * @typedef {Object} AuditLogFilters
 * @property {string} [project] - Filter by project ID
 * @property {string} [story] - Filter by story ID (partial match)
 * @property {string} [dateFrom] - Start date (ISO 8601)
 * @property {string} [dateTo] - End date (ISO 8601)
 * @property {string} [result] - Filter by result type
 * @property {number} [limit] - Max results (default 20, max 100)
 * @property {number} [offset] - Pagination offset
 */

/**
 * @typedef {Object} AuditLogQueryResult
 * @property {AuditLogEntry[]} rows - Matching audit log entries
 * @property {number} total - Total count matching filters
 */

/**
 * Insert a verification audit log entry
 * @param {AuditLogEntry} entry - The audit log entry
 * @returns {number} - Inserted row ID
 */
export function insertAuditLog(entry) {
  const database = getDb();

  const stmt = database.prepare(`
    INSERT INTO verification_audit_logs
    (timestamp, story_id, project_id, claimed_status, actual_status, result, action_taken, duration_ms, attempt_count, details)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    entry.timestamp,
    entry.storyId,
    entry.projectId || null,
    entry.claimedStatus,
    entry.actualStatus,
    entry.result,
    entry.actionTaken || null,
    entry.durationMs || null,
    entry.attemptCount || 1,
    entry.details || null
  );

  return result.lastInsertRowid;
}

/**
 * Escape special characters in LIKE patterns (Issue 6.1 fix)
 * @param {string} str - User input string
 * @returns {string} - Escaped string safe for LIKE patterns
 */
function escapeLikePattern(str) {
  return str.replace(/[%_\\]/g, '\\$&');
}

/**
 * Query audit logs with filters
 * @param {AuditLogFilters} filters - Query filters
 * @returns {AuditLogQueryResult} - Query results with total count
 */
export function queryAuditLogs(filters = {}) {
  const database = getDb();

  // Build WHERE clause dynamically
  const conditions = [];
  const params = [];

  if (filters.project) {
    conditions.push('project_id = ?');
    params.push(filters.project);
  }

  if (filters.story) {
    // Issue 6.1 fix: Escape special LIKE characters to prevent injection
    conditions.push("story_id LIKE ? ESCAPE '\\'");
    params.push(`%${escapeLikePattern(filters.story)}%`);
  }

  if (filters.dateFrom) {
    conditions.push('timestamp >= ?');
    params.push(filters.dateFrom);
  }

  if (filters.dateTo) {
    conditions.push('timestamp <= ?');
    params.push(filters.dateTo);
  }

  if (filters.result) {
    conditions.push('result = ?');
    params.push(filters.result);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countStmt = database.prepare(`
    SELECT COUNT(*) as total FROM verification_audit_logs ${whereClause}
  `);
  const countResult = countStmt.get(...params);
  const total = countResult.total;

  // Get paginated results
  const limit = Math.min(Math.max(filters.limit || 20, 1), 100);
  const offset = Math.max(filters.offset || 0, 0);

  const dataStmt = database.prepare(`
    SELECT
      id,
      timestamp,
      story_id as storyId,
      project_id as projectId,
      claimed_status as claimedStatus,
      actual_status as actualStatus,
      result,
      action_taken as actionTaken,
      duration_ms as durationMs,
      attempt_count as attemptCount,
      details,
      created_at as createdAt
    FROM verification_audit_logs
    ${whereClause}
    ORDER BY timestamp DESC
    LIMIT ? OFFSET ?
  `);

  const rows = dataStmt.all(...params, limit, offset);

  return { rows, total };
}

// Graceful shutdown handlers
// Let the main server own process termination. Here we only close DB.
process.on('exit', closeDb);
process.on('SIGINT', closeDb);
process.on('SIGTERM', closeDb);
