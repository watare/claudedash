/**
 * Stories API Tests
 *
 * Story 4.3: Added tests for POST /api/stories/:id/retry endpoint
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import storiesRouter from './stories.js';

// Mock dependencies
vi.mock('../services/verification.js', () => ({
  compareStatus: vi.fn(),
  readYamlStatus: vi.fn(),
  getStoryStatus: vi.fn(),
}));

vi.mock('../auth/middleware.js', () => ({
  authMiddleware: (req, res, next) => {
    req.user = { userId: 'test-user', username: 'testuser' };
    next();
  },
  requireAuth: (req, res, next) => {
    req.user = { userId: 'test-user', username: 'testuser' };
    next();
  },
}));

vi.mock('../services/websocket.js', () => ({
  broadcast: vi.fn(),
}));

vi.mock('../services/storyRetrier.js', () => ({
  retryStory: vi.fn(),
  canRetryStory: vi.fn(),
  getRetryStats: vi.fn(),
}));

vi.mock('../services/storyTracker.js', () => ({
  registerStory: vi.fn(),
  getStory: vi.fn(),
}));

vi.mock('../db/storyLogs.js', () => ({
  insertStoryRetryLog: vi.fn().mockResolvedValue(1),
}));

vi.mock('../config.js', () => ({
  loadConfig: vi.fn().mockReturnValue({
    maxStoryRetries: 3,
    projectRoot: '/test/path',
    sprintStatusPath: '/test/path/_bmad-output/implementation-artifacts/sprint-status.yaml',
  }),
}));

import { compareStatus, readYamlStatus, getStoryStatus } from '../services/verification.js';
import { broadcast } from '../services/websocket.js';
import { retryStory, canRetryStory, getRetryStats } from '../services/storyRetrier.js';
import { registerStory, getStory } from '../services/storyTracker.js';
import { insertStoryRetryLog } from '../db/storyLogs.js';

describe('Stories API', () => {
  let app;

  beforeEach(() => {
    vi.clearAllMocks();

    app = express();
    app.use(express.json());
    app.use('/api/stories', storiesRouter);
  });

  describe('POST /api/stories/:storyKey/verify', () => {
    it('returns 400 if YAML file cannot be read', async () => {
      vi.mocked(readYamlStatus).mockReturnValue({
        success: false,
        error: 'File not found',
        code: 'FILE_READ_ERROR',
      });

      const response = await request(app)
        .post('/api/stories/3-6-test/verify')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Failed to read sprint status');
      expect(response.body.code).toBe('FILE_READ_ERROR');
    });

    it('returns 404 if story not found in YAML', async () => {
      vi.mocked(readYamlStatus).mockReturnValue({
        success: true,
        data: { development_status: {} },
      });
      vi.mocked(getStoryStatus).mockReturnValue('unknown');

      const response = await request(app)
        .post('/api/stories/nonexistent-story/verify')
        .send({});

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('not found in sprint-status.yaml');
      expect(response.body.code).toBe('STORY_NOT_FOUND');
    });

    it('verifies story and returns match result', async () => {
      vi.mocked(readYamlStatus).mockReturnValue({
        success: true,
        data: { development_status: { '3-6-test': 'done' } },
      });
      vi.mocked(getStoryStatus).mockReturnValue('done');
      vi.mocked(compareStatus).mockResolvedValue({
        storyKey: '3-6-test',
        claimed: 'done',
        actual: 'done',
        match: true,
        timestamp: '2026-01-16T12:00:00.000Z',
        attemptCount: 1,
      });

      const response = await request(app)
        .post('/api/stories/3-6-test/verify')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.data.storyKey).toBe('3-6-test');
      expect(response.body.data.claimed).toBe('done');
      expect(response.body.data.actual).toBe('done');
      expect(response.body.data.match).toBe(true);
    });

    it('verifies story and returns mismatch result', async () => {
      vi.mocked(readYamlStatus).mockReturnValue({
        success: true,
        data: { development_status: { '3-6-test': 'done' } },
      });
      vi.mocked(getStoryStatus).mockReturnValue('done');
      vi.mocked(compareStatus).mockResolvedValue({
        storyKey: '3-6-test',
        claimed: 'done',
        actual: 'in-progress',
        match: false,
        timestamp: '2026-01-16T12:00:00.000Z',
        attemptCount: 1,
      });

      const response = await request(app)
        .post('/api/stories/3-6-test/verify')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.data.match).toBe(false);
      expect(response.body.data.claimed).toBe('done');
      expect(response.body.data.actual).toBe('in-progress');
    });

    it('broadcasts story:verified event on match', async () => {
      vi.mocked(readYamlStatus).mockReturnValue({
        success: true,
        data: { development_status: { '3-6-test': 'done' } },
      });
      vi.mocked(getStoryStatus).mockReturnValue('done');
      vi.mocked(compareStatus).mockResolvedValue({
        storyKey: '3-6-test',
        claimed: 'done',
        actual: 'done',
        match: true,
        timestamp: '2026-01-16T12:00:00.000Z',
        attemptCount: 1,
      });

      await request(app)
        .post('/api/stories/3-6-test/verify')
        .send({});

      expect(broadcast).toHaveBeenCalledWith({
        type: 'story:verified',
        data: expect.objectContaining({
          storyKey: '3-6-test',
          claimed: 'done',
          actual: 'done',
        }),
      });
    });

    it('broadcasts story:verification_failed event on mismatch', async () => {
      vi.mocked(readYamlStatus).mockReturnValue({
        success: true,
        data: { development_status: { '3-6-test': 'done' } },
      });
      vi.mocked(getStoryStatus).mockReturnValue('done');
      vi.mocked(compareStatus).mockResolvedValue({
        storyKey: '3-6-test',
        claimed: 'done',
        actual: 'in-progress',
        match: false,
        timestamp: '2026-01-16T12:00:00.000Z',
        attemptCount: 2,
      });

      await request(app)
        .post('/api/stories/3-6-test/verify')
        .send({});

      expect(broadcast).toHaveBeenCalledWith({
        type: 'story:verification_failed',
        data: expect.objectContaining({
          storyKey: '3-6-test',
          claimed: 'done',
          actual: 'in-progress',
          attempts: 2,
        }),
      });
    });

    it('uses custom projectPath when provided', async () => {
      vi.mocked(readYamlStatus).mockReturnValue({
        success: true,
        data: { development_status: { '3-6-test': 'done' } },
      });
      vi.mocked(getStoryStatus).mockReturnValue('done');
      vi.mocked(compareStatus).mockResolvedValue({
        storyKey: '3-6-test',
        claimed: 'done',
        actual: 'done',
        match: true,
        timestamp: '2026-01-16T12:00:00.000Z',
        attemptCount: 1,
      });

      await request(app)
        .post('/api/stories/3-6-test/verify')
        .send({ projectPath: '/custom/path' });

      expect(readYamlStatus).toHaveBeenCalledWith(
        expect.stringContaining('/custom/path')
      );
    });

    it('handles URL-encoded storyKey', async () => {
      vi.mocked(readYamlStatus).mockReturnValue({
        success: true,
        data: { development_status: { '3-6-test-key': 'done' } },
      });
      vi.mocked(getStoryStatus).mockReturnValue('done');
      vi.mocked(compareStatus).mockResolvedValue({
        storyKey: '3-6-test-key',
        claimed: 'done',
        actual: 'done',
        match: true,
        timestamp: '2026-01-16T12:00:00.000Z',
        attemptCount: 1,
      });

      const response = await request(app)
        .post('/api/stories/3-6-test-key/verify')
        .send({});

      expect(response.status).toBe(200);
      expect(getStoryStatus).toHaveBeenCalledWith(expect.anything(), '3-6-test-key');
    });
  });

  describe('GET /api/stories/:storyKey/verification', () => {
    it('returns unknown status if YAML cannot be read', async () => {
      vi.mocked(readYamlStatus).mockReturnValue({
        success: false,
        error: 'File not found',
      });

      const response = await request(app)
        .get('/api/stories/3-6-test/verification');

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('unknown');
      expect(response.body.data.claimed).toBeNull();
    });

    it('returns unknown status if story not found', async () => {
      vi.mocked(readYamlStatus).mockReturnValue({
        success: true,
        data: { development_status: {} },
      });
      vi.mocked(getStoryStatus).mockReturnValue('unknown');

      const response = await request(app)
        .get('/api/stories/nonexistent/verification');

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('unknown');
    });

    it('returns verified status when story exists', async () => {
      vi.mocked(readYamlStatus).mockReturnValue({
        success: true,
        data: { development_status: { '3-6-test': 'done' } },
        timestamp: '2026-01-16T12:00:00.000Z',
      });
      vi.mocked(getStoryStatus).mockReturnValue('done');

      const response = await request(app)
        .get('/api/stories/3-6-test/verification');

      expect(response.status).toBe(200);
      expect(response.body.data.storyKey).toBe('3-6-test');
      expect(response.body.data.status).toBe('verified');
      expect(response.body.data.claimed).toBe('done');
      expect(response.body.data.actual).toBe('done');
    });
  });

  // ============================================================================
  // Story 4.3: Retry Story API Tests
  // ============================================================================

  describe('POST /api/stories/:id/retry', () => {
    beforeEach(() => {
      // Reset mocks for retry tests
      vi.mocked(getStory).mockReturnValue(null);
      vi.mocked(readYamlStatus).mockReturnValue({ success: false });
    });

    it('returns 404 if story not found', async () => {
      vi.mocked(canRetryStory).mockReturnValue({
        canRetry: false,
        reason: 'Story not found in tracker',
      });

      const response = await request(app)
        .post('/api/stories/nonexistent/retry')
        .send({});

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('not found');
      expect(response.body.code).toBe('STORY_NOT_FOUND');
    });

    it('returns 400 if story already in progress (AC2)', async () => {
      vi.mocked(canRetryStory).mockReturnValue({
        canRetry: false,
        reason: 'Story already in progress',
      });

      const response = await request(app)
        .post('/api/stories/4-3/retry')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Story already in progress');
      expect(response.body.code).toBe('STORY_IN_PROGRESS');
    });

    it('returns 400 if story in non-retryable state', async () => {
      vi.mocked(canRetryStory).mockReturnValue({
        canRetry: false,
        reason: 'Cannot retry story in done state',
      });

      const response = await request(app)
        .post('/api/stories/4-3/retry')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('RETRY_NOT_ALLOWED');
    });

    it('retries failed story successfully (AC1)', async () => {
      vi.mocked(canRetryStory).mockReturnValue({ canRetry: true, retryCount: 0 });
      vi.mocked(retryStory).mockResolvedValue({
        storyId: '4-3',
        status: 'pending',
        agentId: 'agent-4-3-12345',
        warning: null,
        retryCount: 1,
      });

      const response = await request(app)
        .post('/api/stories/4-3/retry')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.data.storyId).toBe('4-3');
      expect(response.body.data.status).toBe('pending');
      expect(response.body.data.agentId).toBe('agent-4-3-12345');
      expect(response.body.meta.retryCount).toBe(1);
      expect(response.body.warning).toBeUndefined();
    });

    it('includes warning when max retries exceeded (AC3)', async () => {
      vi.mocked(canRetryStory).mockReturnValue({ canRetry: true, retryCount: 3 });
      vi.mocked(retryStory).mockResolvedValue({
        storyId: '4-3',
        status: 'pending',
        agentId: 'agent-4-3-12345',
        warning: 'This story has failed 4 times. Max retries (3) exceeded.',
        retryCount: 4,
      });

      const response = await request(app)
        .post('/api/stories/4-3/retry')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.data.storyId).toBe('4-3');
      expect(response.body.warning).toContain('failed 4 times');
      expect(response.body.warning).toContain('Max retries (3) exceeded');
    });

    it('logs retry action to audit log (AC1)', async () => {
      vi.mocked(canRetryStory).mockReturnValue({ canRetry: true, retryCount: 0 });
      vi.mocked(retryStory).mockResolvedValue({
        storyId: '4-3',
        status: 'pending',
        agentId: 'agent-4-3-12345',
        warning: null,
        retryCount: 1,
      });

      await request(app)
        .post('/api/stories/4-3/retry')
        .send({});

      expect(insertStoryRetryLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'story:retry',
          user: 'testuser',
          details: expect.stringContaining('"storyId":"4-3"'),
        })
      );
    });

    it('syncs story from sprint status if not tracked', async () => {
      vi.mocked(getStory).mockReturnValue(null);
      vi.mocked(readYamlStatus).mockReturnValue({
        success: true,
        data: { development_status: { '4-3': 'failed' } },
      });
      vi.mocked(getStoryStatus).mockReturnValue('failed');
      vi.mocked(canRetryStory).mockReturnValue({ canRetry: true, retryCount: 0 });
      vi.mocked(retryStory).mockResolvedValue({
        storyId: '4-3',
        status: 'pending',
        agentId: 'agent-4-3-12345',
        warning: null,
        retryCount: 1,
      });

      await request(app)
        .post('/api/stories/4-3/retry')
        .send({});

      expect(registerStory).toHaveBeenCalledWith('4-3', 'failed');
    });

    it('handles service errors gracefully', async () => {
      vi.mocked(canRetryStory).mockReturnValue({ canRetry: true, retryCount: 0 });
      vi.mocked(retryStory).mockRejectedValue(new Error('Service unavailable'));

      const response = await request(app)
        .post('/api/stories/4-3/retry')
        .send({});

      // Should propagate to global error handler (500)
      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/stories/:id/retry-stats', () => {
    it('returns retry stats for tracked story', async () => {
      vi.mocked(getRetryStats).mockReturnValue({
        retryCount: 2,
        maxRetries: 3,
        exceededMax: false,
      });
      vi.mocked(canRetryStory).mockReturnValue({ canRetry: true });

      const response = await request(app)
        .get('/api/stories/4-3/retry-stats');

      expect(response.status).toBe(200);
      expect(response.body.data.storyId).toBe('4-3');
      expect(response.body.data.retryCount).toBe(2);
      expect(response.body.data.maxRetries).toBe(3);
      expect(response.body.data.exceededMax).toBe(false);
      expect(response.body.data.canRetry).toBe(true);
    });

    it('returns default stats for untracked story', async () => {
      vi.mocked(getRetryStats).mockReturnValue(null);
      vi.mocked(canRetryStory).mockReturnValue({
        canRetry: false,
        reason: 'Story not found',
      });

      const response = await request(app)
        .get('/api/stories/unknown/retry-stats');

      expect(response.status).toBe(200);
      expect(response.body.data.retryCount).toBe(0);
      expect(response.body.data.canRetry).toBe(false);
      expect(response.body.data.reason).toContain('not found');
    });

    it('indicates when max retries exceeded', async () => {
      vi.mocked(getRetryStats).mockReturnValue({
        retryCount: 5,
        maxRetries: 3,
        exceededMax: true,
      });
      vi.mocked(canRetryStory).mockReturnValue({ canRetry: true });

      const response = await request(app)
        .get('/api/stories/4-3/retry-stats');

      expect(response.status).toBe(200);
      expect(response.body.data.exceededMax).toBe(true);
      expect(response.body.data.retryCount).toBe(5);
    });
  });
});
