/**
 * Tests for History API
 * Story 4.7: Execution History View
 */

import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import historyRouter from './history.js';
import { initDb } from '../db/index.js';
import {
  startRun,
  recordEvent,
  endRun,
  _resetForTesting,
} from '../services/historyRecorder.js';

// Mock requireAuth middleware
vi.mock('../auth/middleware.js', () => ({
  requireAuth: (req, res, next) => {
    req.user = { userId: 1, username: 'testuser' };
    next();
  },
}));

describe('History API', () => {
  let app;

  beforeAll(() => {
    initDb();

    app = express();
    app.use(express.json());
    app.use('/api/history', historyRouter);
  });

  afterEach(() => {
    _resetForTesting();
  });

  describe('GET /api/history', () => {
    it('should return empty list when no runs exist', async () => {
      const response = await request(app)
        .get('/api/history')
        .expect(200);

      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.meta).toBeDefined();
      expect(response.body.meta.timestamp).toBeDefined();
    });

    it('should return runs with pagination metadata', async () => {
      // Create some test runs
      const runId = startRun('api-test-project', {});
      recordEvent('agent:spawn', { agentId: 'test-1' });
      endRun('completed', { completed: 1, failed: 0, total: 1 });

      const response = await request(app)
        .get('/api/history')
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.meta.total).toBeGreaterThan(0);
      expect(response.body.meta.page).toBe(1);
      expect(response.body.meta.limit).toBe(20);
    });

    it('should filter by project', async () => {
      startRun('filter-project-a', {});
      endRun('completed', {});

      startRun('filter-project-b', {});
      endRun('completed', {});

      const response = await request(app)
        .get('/api/history?project=filter-project-a')
        .expect(200);

      const matchingRuns = response.body.data.filter(
        r => r.project === 'filter-project-a'
      );
      expect(matchingRuns.length).toBeGreaterThan(0);
    });

    it('should filter by status', async () => {
      startRun('status-filter-test', {});
      endRun('failed', { failed: 1 });

      const response = await request(app)
        .get('/api/history?status=failed')
        .expect(200);

      const failedRuns = response.body.data.filter(r => r.status === 'failed');
      expect(failedRuns.length).toBeGreaterThan(0);
    });

    it('should reject invalid status', async () => {
      const response = await request(app)
        .get('/api/history?status=invalid')
        .expect(400);

      expect(response.body.code).toBe('INVALID_STATUS');
    });

    it('should reject invalid startDate', async () => {
      const response = await request(app)
        .get('/api/history?startDate=not-a-date')
        .expect(400);

      expect(response.body.code).toBe('INVALID_START_DATE');
    });

    it('should reject invalid endDate', async () => {
      const response = await request(app)
        .get('/api/history?endDate=not-a-date')
        .expect(400);

      expect(response.body.code).toBe('INVALID_END_DATE');
    });

    it('should reject invalid page', async () => {
      const response = await request(app)
        .get('/api/history?page=-1')
        .expect(400);

      expect(response.body.code).toBe('INVALID_PAGE');
    });

    it('should reject limit over 100', async () => {
      const response = await request(app)
        .get('/api/history?limit=200')
        .expect(400);

      expect(response.body.code).toBe('INVALID_LIMIT');
    });

    it('should support pagination', async () => {
      // Create multiple runs
      for (let i = 0; i < 5; i++) {
        startRun(`pagination-test-${i}`, {});
        endRun('completed', {});
      }

      const response = await request(app)
        .get('/api/history?limit=2&page=1')
        .expect(200);

      expect(response.body.data.length).toBeLessThanOrEqual(2);
      expect(response.body.meta.limit).toBe(2);
      expect(response.body.meta.page).toBe(1);
    });
  });

  describe('GET /api/history/:runId', () => {
    it('should return run with events', async () => {
      const runId = startRun('detail-test', {});
      recordEvent('agent:spawn', {
        agentId: 'agent-1',
        storyId: '1-1',
        details: { model: 'test' },
      });
      recordEvent('agent:complete', {
        agentId: 'agent-1',
        storyId: '1-1',
      });
      endRun('completed', { completed: 1, failed: 0, total: 1 });

      const response = await request(app)
        .get(`/api/history/${runId}`)
        .expect(200);

      expect(response.body.data.id).toBe(runId);
      expect(response.body.data.project).toBe('detail-test');
      expect(response.body.data.events).toHaveLength(2);
      expect(response.body.data.events[0].type).toBe('agent:spawn');
      expect(response.body.data.events[0].agentId).toBe('agent-1');
    });

    it('should return 404 for non-existent run', async () => {
      const response = await request(app)
        .get('/api/history/999999')
        .expect(404);

      expect(response.body.code).toBe('RUN_NOT_FOUND');
    });

    it('should reject invalid runId', async () => {
      const response = await request(app)
        .get('/api/history/not-a-number')
        .expect(400);

      expect(response.body.code).toBe('INVALID_RUN_ID');
    });

    it('should reject negative runId', async () => {
      const response = await request(app)
        .get('/api/history/-1')
        .expect(400);

      expect(response.body.code).toBe('INVALID_RUN_ID');
    });
  });
});
