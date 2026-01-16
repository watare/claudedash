import { useState } from 'react';
import { StoryStatusBadge } from '@/components/ui/StoryStatusBadge';
import { StoryDetail } from './StoryDetail';
import { RetryButton } from '@/components/stories/RetryButton';
import { useStoriesStore } from '@/stores/storiesStore';
import { useUIStore } from '@/stores/uiStore';
import type { Story } from '@/types/project';

interface StoryListProps {
  stories: Story[];
  currentStoryId?: string | null;
}

/**
 * List of stories within an expanded epic
 * Story 2.7: Epic/Story Progress Display (AC: #4, #5)
 */
export function StoryList({ stories, currentStoryId }: StoryListProps) {
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const { retryStory, retryingStoryId } = useStoriesStore();
  const { addToast } = useUIStore();

  const handleRetry = async (storyId: string, e: React.MouseEvent) => {
    // Prevent opening story detail when clicking retry
    e.stopPropagation();

    const result = await retryStory(storyId);

    if (result.success) {
      // AC2: Success toast
      addToast({
        type: 'success',
        message: `Retrying Story ${storyId}`,
        duration: 5000,
      });

      // AC3: Warning toast if max retries exceeded
      if (result.warning) {
        addToast({
          type: 'warning',
          message: result.warning,
        });
      }
    } else {
      // AC4: Error toast
      addToast({
        type: 'error',
        message: useStoriesStore.getState().error || 'Failed to retry story',
      });
    }
  };

  // Helper to check if story is retryable
  const isRetryable = (status: Story['status']) =>
    status === 'failed' || status === 'killed';

  if (stories.length === 0) {
    return (
      <div className="text-[#848E9C] text-sm" data-testid="story-list-empty">
        No stories in this epic
      </div>
    );
  }

  return (
    <div className="space-y-1" data-testid="story-list">
      {stories.map((story) => {
        const isCurrent = story.id === currentStoryId;

        return (
          <div
            key={story.id}
            role="button"
            tabIndex={0}
            className={`w-full px-3 py-2 rounded flex items-center justify-between text-left cursor-pointer ${
              isCurrent ? 'bg-[#F0B90B]/10' : 'hover:bg-[#2B3139]'
            }`}
            onClick={() => setSelectedStory(story)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setSelectedStory(story);
              }
            }}
            data-testid={`story-item-${story.id}`}
          >
            <div className="flex items-center gap-2">
              {isCurrent && (
                <span className="text-[#F0B90B]" aria-label="Current story">
                  ★
                </span>
              )}
              <span className={`text-sm ${isCurrent ? 'text-[#EAECEF]' : 'text-[#848E9C]'}`}>
                {story.id} {story.title}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {/* AC1: Retry button for failed/killed stories */}
              {isRetryable(story.status) && (
                <RetryButton
                  onRetry={(e) => handleRetry(story.id, e)}
                  isRetrying={retryingStoryId === story.id}
                />
              )}
              <StoryStatusBadge status={story.status} />
            </div>
          </div>
        );
      })}

      {/* Story Detail Modal/Panel */}
      {selectedStory && <StoryDetail story={selectedStory} onClose={() => setSelectedStory(null)} />}
    </div>
  );
}
