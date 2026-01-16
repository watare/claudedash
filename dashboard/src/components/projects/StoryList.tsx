import { useState } from 'react';
import { StoryStatusBadge } from '@/components/ui/StoryStatusBadge';
import { StoryDetail } from './StoryDetail';
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
          <button
            key={story.id}
            className={`w-full px-3 py-2 rounded flex items-center justify-between text-left ${
              isCurrent ? 'bg-[#F0B90B]/10' : 'hover:bg-[#2B3139]'
            }`}
            onClick={() => setSelectedStory(story)}
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
            <StoryStatusBadge status={story.status} />
          </button>
        );
      })}

      {/* Story Detail Modal/Panel */}
      {selectedStory && <StoryDetail story={selectedStory} onClose={() => setSelectedStory(null)} />}
    </div>
  );
}
