/**
 * Tests for Audit Logs API routes
 * Story 3.5: Verification Logging & Audit
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import auditLogsRouter from './logs.js';

// Mock the auth middleware
vi.mock('../auth/middleware.js', () => ({
  requireAuth: (req, res, next) => {
    req.user = { userId: 'test-user', email: 'test@example.com' };
    next();
  },
}));

// Mock the database functions
vi.mock('../db/sqlite.js', () => ({
  queryAuditLogs: vi.fn(),
}));

import { queryAuditLogs } from '../db/sqlite.js';

describe('Audit Logs API', () => {
  let app;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/audit-logs', auditLogsRouter);
  });

  describe('GET /api/audit-logs', () => {
    it('returns audit logs with correct format', async () => {
      const mockLogs = [
        {
          id: 1,
          timestamp: '2026-01-15T12:00:00Z',
          storyId: '3-1-yaml-status-reader',
          projectId: 'bmad-orchestrator',
          claimedStatus: 'done',
          actualStatus: 'done',
          result: 'match',
          durationMs: 150,
          attemptCount: 1,
        },
        {
          id: 2,
          timestamp: '2026-01-15T12:05:00Z',
          storyId: '3-2-status-comparison',
          projectId: 'bmad-orchestrator',
          claimedStatus: 'done',
          actualStatus: 'in-progress',
          result: 'mismatch',
          durationMs: 200,
          attemptCount: 2,
        },
      ];

      queryAuditLogs.mockReturnValue({ rows: mockLogs, total: 2 });

      const response = await request(app).get('/api/audit-logs');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('meta');
      expect(response.body.meta).toHaveProperty('total', 2);
      expect(response.body.meta).toHaveProperty('page', 1);
      expect(response.body.meta).toHaveProperty('limit', 20);
      expect(response.body.meta).toHaveProperty('timestamp');
      expect(response.body.data).toEqual(mockLogs);
    });

    it('returns empty array when no audit logs exist', async () => {
      queryAuditLogs.mockReturnValue({ rows: [], total: 0 });

      const response = await request(app).get('/api/audit-logs');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([]);
      expect(response.body.meta.total).toBe(0);
    });

    it('filters by project parameter', async () => {
      queryAuditLogs.mockReturnValue({ rows: [], total: 0 });

      await request(app).get('/api/audit-logs?project=bmad-orchestrator');

      expect(queryAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          project: 'bmad-orchestrator',
        })
      );
    });

    it('filters by story parameter (partial match)', async () => {
      queryAuditLogs.mockReturnValue({ rows: [], total: 0 });

      await request(app).get('/api/audit-logs?story=3-1');

      expect(queryAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          story: '3-1',
        })
      );
    });

    it('filters by dateFrom parameter', async () => {
      queryAuditLogs.mockReturnValue({ rows: [], total: 0 });

      await request(app).get('/api/audit-logs?dateFrom=2026-01-01');

      expect(queryAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          dateFrom: '2026-01-01',
        })
      );
    });

    it('filters by dateTo parameter', async () => {
      queryAuditLogs.mockReturnValue({ rows: [], total: 0 });

      await request(app).get('/api/audit-logs?dateTo=2026-01-15');

      expect(queryAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          dateTo: '2026-01-15',
        })
      );
    });

    it('returns 400 for invalid dateFrom format', async () => {
      const response = await request(app).get('/api/audit-logs?dateFrom=not-a-date');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('code', 'INVALID_DATE_FROM');
    });

    it('returns 400 for invalid dateTo format', async () => {
      const response = await request(app).get('/api/audit-logs?dateTo=invalid');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('code', 'INVALID_DATE_TO');
    });

    it('accepts valid ISO 8601 datetime for dateFrom', async () => {
      queryAuditLogs.mockReturnValue({ rows: [], total: 0 });

      const response = await request(app).get('/api/audit-logs?dateFrom=2026-01-15T12:00:00Z');

      expect(response.status).toBe(200);
    });

    it('filters by result type', async () => {
      queryAuditLogs.mockReturnValue({ rows: [], total: 0 });

      await request(app).get('/api/audit-logs?result=mismatch');

      expect(queryAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          result: 'mismatch',
        })
      );
    });

    it('returns 400 for invalid result type', async () => {
      const response = await request(app).get('/api/audit-logs?result=invalid');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'INVALID_RESULT_TYPE');
    });

    it('accepts valid result types: match, mismatch, error', async () => {
      queryAuditLogs.mockReturnValue({ rows: [], total: 0 });

      for (const resultType of ['match', 'mismatch', 'error']) {
        const response = await request(app).get(`/api/audit-logs?result=${resultType}`);
        expect(response.status).toBe(200);
      }
    });

    it('supports pagination with limit and offset', async () => {
      queryAuditLogs.mockReturnValue({ rows: [], total: 100 });

      await request(app).get('/api/audit-logs?limit=10&offset=20');

      expect(queryAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 10,
          offset: 20,
        })
      );
    });

    it('returns correct page number based on offset', async () => {
      queryAuditLogs.mockReturnValue({ rows: [], total: 100 });

      const response = await request(app).get('/api/audit-logs?limit=10&offset=30');

      expect(response.status).toBe(200);
      expect(response.body.meta.page).toBe(4); // offset 30 / limit 10 + 1 = 4
      expect(response.body.meta.limit).toBe(10);
    });

    it('returns 400 for invalid limit (non-numeric)', async () => {
      const response = await request(app).get('/api/audit-logs?limit=abc');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('code', 'INVALID_LIMIT');
    });

    it('returns 400 for invalid limit (zero or negative)', async () => {
      const response = await request(app).get('/api/audit-logs?limit=0');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('code', 'INVALID_LIMIT');
    });

    it('returns 400 for limit exceeding maximum (100)', async () => {
      const response = await request(app).get('/api/audit-logs?limit=101');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('code', 'INVALID_LIMIT');
      expect(response.body.error).toContain('Maximum allowed is 100');
    });

    it('accepts limit at maximum boundary (100)', async () => {
      queryAuditLogs.mockReturnValue({ rows: [], total: 0 });

      const response = await request(app).get('/api/audit-logs?limit=100');

      expect(response.status).toBe(200);
      expect(response.body.meta.limit).toBe(100);
    });

    it('returns 400 for invalid offset (negative)', async () => {
      const response = await request(app).get('/api/audit-logs?offset=-1');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('code', 'INVALID_OFFSET');
    });

    it('returns 400 for invalid offset (non-numeric)', async () => {
      const response = await request(app).get('/api/audit-logs?offset=abc');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('code', 'INVALID_OFFSET');
    });

    it('supports multiple filters combined', async () => {
      queryAuditLogs.mockReturnValue({ rows: [], total: 0 });

      await request(app).get(
        '/api/audit-logs?project=bmad-orchestrator&story=3-1&result=mismatch&dateFrom=2026-01-01&dateTo=2026-01-15&limit=50&offset=10'
      );

      expect(queryAuditLogs).toHaveBeenCalledWith({
        project: 'bmad-orchestrator',
        story: '3-1',
        result: 'mismatch',
        dateFrom: '2026-01-01',
        dateTo: '2026-01-15',
        limit: 50,
        offset: 10,
      });
    });

    it('handles service errors gracefully', async () => {
      queryAuditLogs.mockImplementation(() => {
        throw new Error('Database error');
      });

      const response = await request(app).get('/api/audit-logs');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'INTERNAL_ERROR');
    });

    it('uses default limit of 20 when not specified', async () => {
      queryAuditLogs.mockReturnValue({ rows: [], total: 0 });

      const response = await request(app).get('/api/audit-logs');

      expect(response.status).toBe(200);
      expect(response.body.meta.limit).toBe(20);
    });

    it('uses default offset of 0 when not specified', async () => {
      queryAuditLogs.mockReturnValue({ rows: [], total: 0 });

      const response = await request(app).get('/api/audit-logs');

      expect(response.status).toBe(200);
      expect(response.body.meta.page).toBe(1);
    });
  });
});
