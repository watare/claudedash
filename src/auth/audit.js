/**
 * Audit logging for authentication events
 * Logs to the audit_log table in SQLite
 */

import { getDb } from '../db/index.js';

/**
 * Log a successful login
 * @param {{ method: string, email: string, userId: string }} params
 */
export function logLoginSuccess({ method, email, userId }) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO audit_log (user, action, project, details)
    VALUES (?, ?, ?, ?)
  `);

  const details = JSON.stringify({ method, email });
  stmt.run(userId, 'login', null, details);
}

/**
 * Log a failed login attempt
 * @param {{ method: string, email: string, reason: string }} params
 */
export function logLoginFailed({ method, email, reason }) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO audit_log (user, action, project, details)
    VALUES (?, ?, ?, ?)
  `);

  const details = JSON.stringify({ method, email, reason });
  stmt.run(null, 'login_failed', null, details);
}

/**
 * Log a rate limit hit
 * @param {{ ip: string, endpoint: string, attempts: number }} params
 */
export function logRateLimited({ ip, endpoint, attempts }) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO audit_log (user, action, project, details)
    VALUES (?, ?, ?, ?)
  `);

  const details = JSON.stringify({ ip, endpoint, attempts });
  stmt.run(null, 'rate_limited', null, details);
}

/**
 * Log a generic auth event
 * @param {string} action - The action type (oauth_start, login, login_denied, auth_error)
 * @param {object} details - Event details
 */
export function logAuthEvent(action, details) {
  try {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO audit_log (user, action, project, details)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(details?.username || null, action, null, JSON.stringify(details));
  } catch (error) {
    console.error('Failed to log auth event:', error.message);
  }
}

/**
 * Get recent audit logs
 * @param {number} [limit=100] - Maximum number of logs to return
 * @returns {Array<{ id: number, timestamp: string, user: string | null, action: string, project: string | null, details: string | null }>}
 */
export function getAuditLogs(limit = 100) {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT id, timestamp, user, action, project, details
    FROM audit_log
    ORDER BY timestamp DESC
    LIMIT ?
  `);

  return stmt.all(limit);
}
