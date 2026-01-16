/**
 * Story Retrier Service Tests
 *
 * Story 4.3: Retry Story API & Backend - Task 8.2
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  retryStory,
  canRetryStory,
  getRetryStats,
} from './storyRetrier.js';
import {
  registerStory,
  getStory,
  clearAllStories,
} from './storyTracker.js';
import * as websocket from './websocket.js';

// Mock websocket functions
vi.mock('./websocket.js', () => ({
  emitStoryRetry: vi.fn(),
  emitAgentSpawn: vi.fn(),
}));

// Mock agentRegistry (not actively used but imported)
vi.mock('./agentRegistry.js', () => ({
  registerAgent: vi.fn(),
}));

describe('storyRetrier', () => {
  beforeEach(() => {
    clearAllStories();
    vi.clearAllMocks();
  });

  describe('retryStory', () => {
    it('throws error for non-existent story', async () => {
      await expect(retryStory('nonexistent', {})).rejects.toThrow('Story not found');
    });

    it('throws error for story already in progress', async () => {
      registerStory('4-3', 'in-progress');

      await expect(
        retryStory('4-3', { spawnAgentAsync: false })
      ).rejects.toThrow('Story already in progress');
    });

    it('throws error for story in non-retryable state', async () => {
      registerStory('4-3', 'done');

      await expect(
        retryStory('4-3', { spawnAgentAsync: false })
      ).rejects.toThrow('Cannot retry story in done state');
    });

    it('retries failed story successfully', async () => {
      registerStory('4-3', 'failed');
      const mockSpawn = vi.fn();

      const result = await retryStory('4-3', {
        config: { maxStoryRetries: 3 },
        spawnAgent: mockSpawn,
      });

      expect(result.storyId).toBe('4-3');
      expect(result.status).toBe('pending');
      expect(result.agentId).toMatch(/^agent-4-3-\d+$/);
      expect(result.warning).toBeNull();
      expect(result.retryCount).toBe(1);
    });

    it('retries killed story successfully', async () => {
      registerStory('4-3', 'killed');
      const mockSpawn = vi.fn();

      const result = await retryStory('4-3', {
        config: { maxStoryRetries: 3 },
        spawnAgent: mockSpawn,
      });

      expect(result.storyId).toBe('4-3');
      expect(result.status).toBe('pending');
    });

    it('returns warning when max retries exceeded', async () => {
      registerStory('4-3', 'failed');
      const mockSpawn = vi.fn();

      // Retry 4 times (exceeds max of 3)
      await retryStory('4-3', { config: { maxStoryRetries: 3 }, spawnAgent: mockSpawn });
      registerStory('4-3', 'failed'); // Reset to failed for next retry
      await retryStory('4-3', { config: { maxStoryRetries: 3 }, spawnAgent: mockSpawn });
      registerStory('4-3', 'failed');
      await retryStory('4-3', { config: { maxStoryRetries: 3 }, spawnAgent: mockSpawn });
      registerStory('4-3', 'failed');

      const result = await retryStory('4-3', {
        config: { maxStoryRetries: 3 },
        spawnAgent: mockSpawn,
      });

      expect(result.warning).not.toBeNull();
      expect(result.warning).toContain('failed 4 times');
      expect(result.warning).toContain('Max retries (3) exceeded');
      expect(result.retryCount).toBe(4);
    });

    it('increments retry count on each retry', async () => {
      registerStory('4-3', 'failed');
      const mockSpawn = vi.fn();

      const result1 = await retryStory('4-3', {
        config: { maxStoryRetries: 3 },
        spawnAgent: mockSpawn,
      });
      expect(result1.retryCount).toBe(1);

      registerStory('4-3', 'failed');
      const result2 = await retryStory('4-3', {
        config: { maxStoryRetries: 3 },
        spawnAgent: mockSpawn,
      });
      expect(result2.retryCount).toBe(2);
    });

    it('broadcasts story:retry event via emitStoryRetry', async () => {
      registerStory('4-3', 'failed');
      const mockSpawn = vi.fn();

      await retryStory('4-3', {
        config: { maxStoryRetries: 3 },
        spawnAgent: mockSpawn,
      });

      expect(websocket.emitStoryRetry).toHaveBeenCalledWith(
        expect.objectContaining({
          storyId: '4-3',
          status: 'pending',
          retryCount: 1,
        })
      );
    });

    it('calls spawnAgent function with correct args', async () => {
      registerStory('4-3', 'failed');
      const mockSpawn = vi.fn();
      const config = { maxStoryRetries: 3 };

      await retryStory('4-3', {
        config,
        spawnAgent: mockSpawn,
      });

      expect(mockSpawn).toHaveBeenCalledWith(
        '4-3',
        expect.stringMatching(/^agent-4-3-\d+$/),
        config
      );
    });

    it('updates story status to pending', async () => {
      registerStory('4-3', 'failed');
      const mockSpawn = vi.fn();

      await retryStory('4-3', {
        config: { maxStoryRetries: 3 },
        spawnAgent: mockSpawn,
      });

      const story = getStory('4-3');
      expect(story.status).toBe('pending');
    });

    it('uses default maxStoryRetries of 3', async () => {
      registerStory('4-3', 'failed');
      const mockSpawn = vi.fn();

      // Retry 4 times to exceed default max
      await retryStory('4-3', { config: {}, spawnAgent: mockSpawn });
      registerStory('4-3', 'failed');
      await retryStory('4-3', { config: {}, spawnAgent: mockSpawn });
      registerStory('4-3', 'failed');
      await retryStory('4-3', { config: {}, spawnAgent: mockSpawn });
      registerStory('4-3', 'failed');

      const result = await retryStory('4-3', { config: {}, spawnAgent: mockSpawn });

      expect(result.warning).toContain('Max retries (3) exceeded');
    });
  });

  describe('canRetryStory', () => {
    it('returns false for non-existent story', () => {
      const result = canRetryStory('nonexistent');
      expect(result.canRetry).toBe(false);
      expect(result.reason).toContain('not found');
    });

    it('returns false for in-progress story', () => {
      registerStory('4-3', 'in-progress');
      const result = canRetryStory('4-3');
      expect(result.canRetry).toBe(false);
      expect(result.reason).toContain('already in progress');
    });

    it('returns false for done story', () => {
      registerStory('4-3', 'done');
      const result = canRetryStory('4-3');
      expect(result.canRetry).toBe(false);
    });

    it('returns false for pending story', () => {
      registerStory('4-3', 'pending');
      const result = canRetryStory('4-3');
      expect(result.canRetry).toBe(false);
    });

    it('returns true for failed story', () => {
      registerStory('4-3', 'failed');
      const result = canRetryStory('4-3');
      expect(result.canRetry).toBe(true);
    });

    it('returns true for killed story', () => {
      registerStory('4-3', 'killed');
      const result = canRetryStory('4-3');
      expect(result.canRetry).toBe(true);
    });

    it('includes retry count for retryable story', () => {
      registerStory('4-3', 'failed');
      const result = canRetryStory('4-3');
      expect(result.retryCount).toBe(0);
    });
  });

  describe('getRetryStats', () => {
    it('returns null for non-existent story', () => {
      const result = getRetryStats('nonexistent');
      expect(result).toBeNull();
    });

    it('returns retry stats for existing story', () => {
      registerStory('4-3', 'failed');
      const result = getRetryStats('4-3', { maxStoryRetries: 5 });

      expect(result).toEqual({
        retryCount: 0,
        maxRetries: 5,
        exceededMax: false,
      });
    });

    it('indicates when max retries exceeded', async () => {
      registerStory('4-3', 'failed');
      const mockSpawn = vi.fn();

      // Retry 4 times
      for (let i = 0; i < 4; i++) {
        await retryStory('4-3', { config: { maxStoryRetries: 3 }, spawnAgent: mockSpawn });
        registerStory('4-3', 'failed');
      }

      const result = getRetryStats('4-3', { maxStoryRetries: 3 });

      expect(result.retryCount).toBe(4);
      expect(result.maxRetries).toBe(3);
      expect(result.exceededMax).toBe(true);
    });

    it('uses default maxStoryRetries of 3', () => {
      registerStory('4-3', 'failed');
      const result = getRetryStats('4-3');

      expect(result.maxRetries).toBe(3);
    });
  });
});
