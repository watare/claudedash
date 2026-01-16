/**
 * Stories Zustand Store
 * Manages story state and retry API interactions
 * Story 4.4: AC2, AC3, AC4
 */

import { create } from 'zustand';
import { retryStory as apiRetryStory } from '../services/api';
import type { StoryStatus } from '../types/project';

interface Story {
  id: string;
  title: string;
  status: StoryStatus;
}

interface StoriesState {
  stories: Story[];
  isLoading: boolean;
  error: string | null;
  retryingStoryId: string | null;

  retryStory: (storyId: string) => Promise<{ success: boolean; warning?: string }>;
  updateStoryStatus: (storyId: string, status: Story['status']) => void;
  setStories: (stories: Story[]) => void;
  clearError: () => void;
}

export const useStoriesStore = create<StoriesState>((set) => ({
  stories: [],
  isLoading: false,
  error: null,
  retryingStoryId: null,

  retryStory: async (storyId: string) => {
    set({ retryingStoryId: storyId, error: null });

    try {
      const result = await apiRetryStory(storyId);

      // Update story status to pending
      set((state) => ({
        stories: state.stories.map((s) =>
          s.id === storyId ? { ...s, status: 'pending' as const } : s
        ),
        retryingStoryId: null,
      }));

      return { success: true, warning: result.warning };
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Retry failed',
        retryingStoryId: null,
      });
      return { success: false };
    }
  },

  updateStoryStatus: (storyId: string, status: Story['status']) => {
    set((state) => ({
      stories: state.stories.map((s) =>
        s.id === storyId ? { ...s, status } : s
      ),
    }));
  },

  setStories: (stories: Story[]) => {
    set({ stories });
  },

  clearError: () => set({ error: null }),
}));
