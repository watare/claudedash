/**
 * Stories Zustand Store tests
 * Story 4.4: AC2, AC3, AC4 - Retry story flow
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useStoriesStore } from './storiesStore';
import * as api from '../services/api';

vi.mock('../services/api');

const mockedApi = vi.mocked(api);

describe('storiesStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useStoriesStore.setState({
      stories: [],
      isLoading: false,
      error: null,
      retryingStoryId: null,
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('has correct initial state', () => {
      const state = useStoriesStore.getState();
      expect(state.stories).toEqual([]);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.retryingStoryId).toBeNull();
    });
  });

  describe('retryStory', () => {
    it('sets retryingStoryId during retry', async () => {
      mockedApi.retryStory.mockResolvedValueOnce({
        data: { storyId: '4-3', status: 'pending', agentId: 'agent-1' },
        meta: { timestamp: '2026-01-16T00:00:00Z', retryCount: 1 },
      });

      const promise = useStoriesStore.getState().retryStory('4-3');

      // Check loading state immediately
      expect(useStoriesStore.getState().retryingStoryId).toBe('4-3');

      await promise;

      // Loading state should be cleared
      expect(useStoriesStore.getState().retryingStoryId).toBeNull();
    });

    it('returns success and warning on successful retry with warning', async () => {
      mockedApi.retryStory.mockResolvedValueOnce({
        data: { storyId: '4-3', status: 'pending', agentId: 'agent-1' },
        meta: { timestamp: '2026-01-16T00:00:00Z', retryCount: 5 },
        warning: 'Max retries exceeded (5/3)',
      });

      const result = await useStoriesStore.getState().retryStory('4-3');

      expect(result.success).toBe(true);
      expect(result.warning).toBe('Max retries exceeded (5/3)');
    });

    it('updates story status to pending on successful retry', async () => {
      useStoriesStore.setState({
        stories: [{ id: '4-3', title: 'Test Story', status: 'failed' }],
      });

      mockedApi.retryStory.mockResolvedValueOnce({
        data: { storyId: '4-3', status: 'pending', agentId: 'agent-1' },
        meta: { timestamp: '2026-01-16T00:00:00Z', retryCount: 1 },
      });

      await useStoriesStore.getState().retryStory('4-3');

      const story = useStoriesStore.getState().stories.find((s) => s.id === '4-3');
      expect(story?.status).toBe('pending');
    });

    it('returns success: false on API error', async () => {
      mockedApi.retryStory.mockRejectedValueOnce(new Error('Story already in progress'));

      const result = await useStoriesStore.getState().retryStory('4-3');

      expect(result.success).toBe(false);
      expect(useStoriesStore.getState().error).toBe('Story already in progress');
    });

    it('clears retryingStoryId on error', async () => {
      mockedApi.retryStory.mockRejectedValueOnce(new Error('Network error'));

      await useStoriesStore.getState().retryStory('4-3');

      expect(useStoriesStore.getState().retryingStoryId).toBeNull();
    });
  });

  describe('updateStoryStatus', () => {
    it('updates story status', () => {
      useStoriesStore.setState({
        stories: [
          { id: '4-3', title: 'Test Story', status: 'pending' },
          { id: '4-4', title: 'Other Story', status: 'done' },
        ],
      });

      useStoriesStore.getState().updateStoryStatus('4-3', 'in-progress');

      const stories = useStoriesStore.getState().stories;
      expect(stories.find((s) => s.id === '4-3')?.status).toBe('in-progress');
      expect(stories.find((s) => s.id === '4-4')?.status).toBe('done');
    });

    it('does not error when story not found', () => {
      useStoriesStore.setState({
        stories: [{ id: '4-3', title: 'Test Story', status: 'pending' }],
      });

      // Should not throw
      useStoriesStore.getState().updateStoryStatus('nonexistent', 'in-progress');

      // Verify existing story unchanged
      expect(useStoriesStore.getState().stories[0].status).toBe('pending');
    });
  });

  describe('setStories', () => {
    it('replaces all stories', () => {
      useStoriesStore.setState({
        stories: [{ id: '4-3', title: 'Old Story', status: 'done' }],
      });

      useStoriesStore.getState().setStories([
        { id: '4-4', title: 'New Story', status: 'pending' },
      ]);

      const stories = useStoriesStore.getState().stories;
      expect(stories).toHaveLength(1);
      expect(stories[0].id).toBe('4-4');
    });
  });

  describe('clearError', () => {
    it('clears error state', () => {
      useStoriesStore.setState({ error: 'Some error' });

      useStoriesStore.getState().clearError();

      expect(useStoriesStore.getState().error).toBeNull();
    });
  });
});
