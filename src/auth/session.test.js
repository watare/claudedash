/**
 * Tests for session management
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { initDb, closeDb, getDb } from '../db/index.js';
import {
  createSession,
  getSessionByRefreshToken,
  deleteSession,
  deleteUserSessions,
  deleteExpiredSessions,
} from './session.js';

describe('Session Management', () => {
  beforeAll(() => {
    // Initialize test database
    initDb();
  });

  afterAll(() => {
    closeDb();
  });

  beforeEach(() => {
    // Clear sessions table before each test
    const db = getDb();
    db.exec('DELETE FROM sessions');
  });

  describe('createSession', () => {
    it('should create a new session', () => {
      const session = createSession({
        userId: 'github:testuser',
        githubToken: 'gho_test123',
        refreshToken: 'jwt_refresh_test',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });

      expect(session.id).toBeDefined();
      expect(typeof session.id).toBe('number');
    });

    it('should store session data correctly', () => {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      createSession({
        userId: 'github:testuser',
        githubToken: 'gho_test123',
        refreshToken: 'jwt_refresh_test',
        expiresAt,
      });

      const retrieved = getSessionByRefreshToken('jwt_refresh_test');
      expect(retrieved.user_id).toBe('github:testuser');
      expect(retrieved.github_token).toBe('gho_test123');
      expect(retrieved.refresh_token).toBe('jwt_refresh_test');
    });
  });

  describe('getSessionByRefreshToken', () => {
    it('should return session for valid refresh token', () => {
      createSession({
        userId: 'github:testuser',
        githubToken: 'gho_test123',
        refreshToken: 'jwt_refresh_test',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });

      const session = getSessionByRefreshToken('jwt_refresh_test');
      expect(session).toBeDefined();
      expect(session.user_id).toBe('github:testuser');
    });

    it('should return null for non-existent refresh token', () => {
      const session = getSessionByRefreshToken('non_existent_token');
      expect(session).toBeNull();
    });
  });

  describe('deleteSession', () => {
    it('should delete session by refresh token', () => {
      createSession({
        userId: 'github:testuser',
        githubToken: 'gho_test123',
        refreshToken: 'jwt_refresh_delete',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });

      const deleted = deleteSession('jwt_refresh_delete');
      expect(deleted).toBe(true);

      const session = getSessionByRefreshToken('jwt_refresh_delete');
      expect(session).toBeNull();
    });

    it('should return false for non-existent session', () => {
      const deleted = deleteSession('non_existent_token');
      expect(deleted).toBe(false);
    });
  });

  describe('deleteUserSessions', () => {
    it('should delete all sessions for a user', () => {
      createSession({
        userId: 'github:testuser',
        githubToken: 'gho_test1',
        refreshToken: 'jwt_1',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });
      createSession({
        userId: 'github:testuser',
        githubToken: 'gho_test2',
        refreshToken: 'jwt_2',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });
      createSession({
        userId: 'github:otheruser',
        githubToken: 'gho_other',
        refreshToken: 'jwt_other',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });

      const deletedCount = deleteUserSessions('github:testuser');
      expect(deletedCount).toBe(2);

      // Other user's session should remain
      const otherSession = getSessionByRefreshToken('jwt_other');
      expect(otherSession).toBeDefined();
    });
  });

  describe('deleteExpiredSessions', () => {
    it('should delete only expired sessions', () => {
      // Create an expired session
      createSession({
        userId: 'github:expireduser',
        githubToken: 'gho_expired',
        refreshToken: 'jwt_expired',
        expiresAt: new Date(Date.now() - 1000).toISOString(), // 1 second ago
      });

      // Create a valid session
      createSession({
        userId: 'github:validuser',
        githubToken: 'gho_valid',
        refreshToken: 'jwt_valid',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });

      const deletedCount = deleteExpiredSessions();
      expect(deletedCount).toBe(1);

      // Valid session should remain
      const validSession = getSessionByRefreshToken('jwt_valid');
      expect(validSession).toBeDefined();

      // Expired session should be gone
      const expiredSession = getSessionByRefreshToken('jwt_expired');
      expect(expiredSession).toBeNull();
    });
  });
});
