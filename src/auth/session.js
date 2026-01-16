/**
 * Session management using SQLite for persistence
 */

import { getDb } from '../db/index.js';

/**
 * Create a new session in the database
 * @param {object} params - Session parameters
 * @param {string} params.userId - User identifier (e.g., 'github:username')
 * @param {string} params.githubToken - GitHub access token
 * @param {string} params.refreshToken - JWT refresh token
 * @param {string} params.expiresAt - ISO 8601 expiry timestamp
 * @returns {{ id: number }} Created session with ID
 */
export function createSession({ userId, githubToken, refreshToken, expiresAt }) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO sessions (user_id, github_token, refresh_token, expires_at)
    VALUES (?, ?, ?, ?)
  `);
  const result = stmt.run(userId, githubToken, refreshToken, expiresAt);
  return { id: result.lastInsertRowid };
}

/**
 * Get a session by refresh token
 * @param {string} refreshToken - The refresh token to look up
 * @returns {{ id: number, user_id: string, github_token: string, refresh_token: string, expires_at: string, created_at: string } | null}
 */
export function getSessionByRefreshToken(refreshToken) {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT id, user_id, github_token, refresh_token, expires_at, created_at
    FROM sessions
    WHERE refresh_token = ?
  `);
  return stmt.get(refreshToken) || null;
}

/**
 * Delete a session by refresh token
 * @param {string} refreshToken - The refresh token of the session to delete
 * @returns {boolean} True if session was deleted
 */
export function deleteSession(refreshToken) {
  const db = getDb();
  const stmt = db.prepare('DELETE FROM sessions WHERE refresh_token = ?');
  const result = stmt.run(refreshToken);
  return result.changes > 0;
}

/**
 * Delete all sessions for a user
 * @param {string} userId - User identifier
 * @returns {number} Number of sessions deleted
 */
export function deleteUserSessions(userId) {
  const db = getDb();
  const stmt = db.prepare('DELETE FROM sessions WHERE user_id = ?');
  const result = stmt.run(userId);
  return result.changes;
}

/**
 * Delete expired sessions (cleanup)
 * @returns {number} Number of sessions deleted
 */
export function deleteExpiredSessions() {
  const db = getDb();
  const stmt = db.prepare(`
    DELETE FROM sessions
    WHERE datetime(expires_at) < datetime('now')
  `);
  const result = stmt.run();
  return result.changes;
}
