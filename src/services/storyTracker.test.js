/**
 * Story Tracker Service Tests
 *
 * Story 4.3: Retry Story API & Backend - Task 8.1
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getStory,
  updateStatus,
  incrementRetry,
  getRetryCount,
  isRetryable,
  registerStory,
  getAllStories,
  getStoriesByStatus,
  clearAllStories,
  getStoryCount,
} from './storyTracker.js';

describe('storyTracker', () => {
  beforeEach(() => {
    clearAllStories();
  });

  describe('getStory', () => {
    it('returns null for non-existent story', () => {
      expect(getStory('nonexistent')).toBeNull();
    });

    it('returns story after registration', () => {
      registerStory('4-3', 'pending');
      const story = getStory('4-3');
      expect(story).not.toBeNull();
      expect(story.id).toBe('4-3');
      expect(story.status).toBe('pending');
    });
  });

  describe('updateStatus', () => {
    it('creates story if it does not exist', () => {
      const story = updateStatus('4-3', 'in-progress');
      expect(story.id).toBe('4-3');
      expect(story.status).toBe('in-progress');
      expect(story.retryCount).toBe(0);
    });

    it('updates existing story status', () => {
      registerStory('4-3', 'pending');
      const updated = updateStatus('4-3', 'failed', 'Test error');

      expect(updated.status).toBe('failed');
      expect(updated.lastError).toBe('Test error');
    });

    it('preserves retry count on status update', () => {
      registerStory('4-3', 'pending');
      incrementRetry('4-3');
      incrementRetry('4-3');

      const updated = updateStatus('4-3', 'failed');
      expect(updated.retryCount).toBe(2);
    });

    it('sets updatedAt timestamp', () => {
      const before = new Date().toISOString();
      const story = updateStatus('4-3', 'pending');
      const after = new Date().toISOString();

      expect(story.updatedAt).toBeDefined();
      expect(story.updatedAt >= before).toBe(true);
      expect(story.updatedAt <= after).toBe(true);
    });
  });

  describe('incrementRetry', () => {
    it('increments retry count for existing story', () => {
      registerStory('4-3', 'failed');

      expect(incrementRetry('4-3')).toBe(1);
      expect(incrementRetry('4-3')).toBe(2);
      expect(incrementRetry('4-3')).toBe(3);
    });

    it('creates story with retry count 1 if not exists', () => {
      const count = incrementRetry('new-story');
      expect(count).toBe(1);

      const story = getStory('new-story');
      expect(story).not.toBeNull();
      expect(story.retryCount).toBe(1);
    });
  });

  describe('getRetryCount', () => {
    it('returns 0 for non-existent story', () => {
      expect(getRetryCount('nonexistent')).toBe(0);
    });

    it('returns current retry count', () => {
      registerStory('4-3', 'failed');
      incrementRetry('4-3');
      incrementRetry('4-3');

      expect(getRetryCount('4-3')).toBe(2);
    });
  });

  describe('isRetryable', () => {
    it('returns not retryable for non-existent story', () => {
      const result = isRetryable('nonexistent');
      expect(result.retryable).toBe(false);
      expect(result.reason).toContain('not found');
    });

    it('returns retryable for failed story', () => {
      registerStory('4-3', 'failed');
      const result = isRetryable('4-3');
      expect(result.retryable).toBe(true);
    });

    it('returns retryable for killed story', () => {
      registerStory('4-3', 'killed');
      const result = isRetryable('4-3');
      expect(result.retryable).toBe(true);
    });

    it('returns not retryable for in-progress story', () => {
      registerStory('4-3', 'in-progress');
      const result = isRetryable('4-3');
      expect(result.retryable).toBe(false);
      expect(result.reason).toContain('already in progress');
    });

    it('returns not retryable for pending story', () => {
      registerStory('4-3', 'pending');
      const result = isRetryable('4-3');
      expect(result.retryable).toBe(false);
    });

    it('returns not retryable for done story', () => {
      registerStory('4-3', 'done');
      const result = isRetryable('4-3');
      expect(result.retryable).toBe(false);
    });

    it('returns not retryable for review story', () => {
      registerStory('4-3', 'review');
      const result = isRetryable('4-3');
      expect(result.retryable).toBe(false);
    });
  });

  describe('registerStory', () => {
    it('creates new story with default values', () => {
      const story = registerStory('4-3', 'pending');

      expect(story.id).toBe('4-3');
      expect(story.status).toBe('pending');
      expect(story.retryCount).toBe(0);
      expect(story.lastError).toBeNull();
      expect(story.updatedAt).toBeDefined();
    });

    it('updates status of existing story', () => {
      registerStory('4-3', 'pending');
      const updated = registerStory('4-3', 'in-progress');

      expect(updated.status).toBe('in-progress');
      expect(getStoryCount()).toBe(1);
    });
  });

  describe('getAllStories', () => {
    it('returns empty array when no stories', () => {
      expect(getAllStories()).toEqual([]);
    });

    it('returns all registered stories', () => {
      registerStory('4-1', 'done');
      registerStory('4-2', 'in-progress');
      registerStory('4-3', 'pending');

      const stories = getAllStories();
      expect(stories).toHaveLength(3);
    });
  });

  describe('getStoriesByStatus', () => {
    it('filters stories by status', () => {
      registerStory('4-1', 'done');
      registerStory('4-2', 'failed');
      registerStory('4-3', 'failed');
      registerStory('4-4', 'pending');

      const failed = getStoriesByStatus('failed');
      expect(failed).toHaveLength(2);
      expect(failed.map((s) => s.id)).toContain('4-2');
      expect(failed.map((s) => s.id)).toContain('4-3');
    });

    it('returns empty array when no matches', () => {
      registerStory('4-1', 'done');
      const result = getStoriesByStatus('failed');
      expect(result).toEqual([]);
    });
  });

  describe('clearAllStories', () => {
    it('removes all stories', () => {
      registerStory('4-1', 'done');
      registerStory('4-2', 'pending');

      clearAllStories();

      expect(getStoryCount()).toBe(0);
      expect(getAllStories()).toEqual([]);
    });
  });

  describe('getStoryCount', () => {
    it('returns 0 when empty', () => {
      expect(getStoryCount()).toBe(0);
    });

    it('returns correct count', () => {
      registerStory('4-1', 'done');
      registerStory('4-2', 'pending');
      registerStory('4-3', 'failed');

      expect(getStoryCount()).toBe(3);
    });
  });
});
