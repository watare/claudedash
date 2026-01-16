/**
 * Tests for audit logging module
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { logLoginSuccess, logLoginFailed, logRateLimited, getAuditLogs } from './audit.js';

// Mock the database module
vi.mock('../db/index.js', () => {
  const mockStmt = {
    run: vi.fn(),
    all: vi.fn(() => []),
  };
  return {
    getDb: vi.fn(() => ({
      prepare: vi.fn(() => mockStmt),
    })),
    __mockStmt: mockStmt,
  };
});

describe('audit logging', () => {
  let mockStmt;

  beforeEach(async () => {
    vi.clearAllMocks();
    const dbMock = await import('../db/index.js');
    mockStmt = dbMock.__mockStmt;
  });

  describe('logLoginSuccess', () => {
    it('should log successful password login', () => {
      logLoginSuccess({
        method: 'password',
        email: 'admin@example.com',
        userId: 'password:admin@example.com',
      });

      expect(mockStmt.run).toHaveBeenCalledWith(
        'password:admin@example.com',
        'login',
        null,
        expect.stringContaining('"method":"password"')
      );
    });

    it('should include email in details', () => {
      logLoginSuccess({
        method: 'password',
        email: 'user@test.com',
        userId: 'password:user@test.com',
      });

      const detailsArg = mockStmt.run.mock.calls[0][3];
      const details = JSON.parse(detailsArg);
      expect(details.method).toBe('password');
      expect(details.email).toBe('user@test.com');
    });
  });

  describe('logLoginFailed', () => {
    it('should log failed login attempt', () => {
      logLoginFailed({
        method: 'password',
        email: 'attacker@example.com',
        reason: 'invalid_credentials',
      });

      expect(mockStmt.run).toHaveBeenCalledWith(
        null,
        'login_failed',
        null,
        expect.stringContaining('"reason":"invalid_credentials"')
      );
    });

    it('should include all details in JSON', () => {
      logLoginFailed({
        method: 'password',
        email: 'test@example.com',
        reason: 'invalid_credentials',
      });

      const detailsArg = mockStmt.run.mock.calls[0][3];
      const details = JSON.parse(detailsArg);
      expect(details.method).toBe('password');
      expect(details.email).toBe('test@example.com');
      expect(details.reason).toBe('invalid_credentials');
    });
  });

  describe('logRateLimited', () => {
    it('should log rate limit hit', () => {
      logRateLimited({
        ip: '192.168.1.1',
        endpoint: '/auth/login',
        attempts: 6,
      });

      expect(mockStmt.run).toHaveBeenCalledWith(
        null,
        'rate_limited',
        null,
        expect.stringContaining('"ip":"192.168.1.1"')
      );
    });

    it('should include endpoint and attempts in details', () => {
      logRateLimited({
        ip: '10.0.0.1',
        endpoint: '/auth/login',
        attempts: 5,
      });

      const detailsArg = mockStmt.run.mock.calls[0][3];
      const details = JSON.parse(detailsArg);
      expect(details.ip).toBe('10.0.0.1');
      expect(details.endpoint).toBe('/auth/login');
      expect(details.attempts).toBe(5);
    });
  });

  describe('getAuditLogs', () => {
    it('should retrieve audit logs with default limit', () => {
      mockStmt.all.mockReturnValue([
        { id: 1, action: 'login', user: 'user1' },
        { id: 2, action: 'login_failed', user: null },
      ]);

      const logs = getAuditLogs();

      expect(logs).toHaveLength(2);
    });
  });
});
