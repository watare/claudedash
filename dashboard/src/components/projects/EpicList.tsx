import { EpicCard } from './EpicCard';
import type { Epic } from '@/types/project';

interface EpicListProps {
  epics: Epic[];
  currentStoryId?: string | null;
}

/**
 * Displays a list of epics with their status and progress
 * Story 2.7: Epic/Story Progress Display (AC: #1, #2, #3)
 */
export function EpicList({ epics, currentStoryId }: EpicListProps) {
  if (epics.length === 0) {
    return (
      <div className="text-[#848E9C] text-center py-8" data-testid="epic-list-empty">
        No epics available
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="epic-list">
      {epics.map((epic) => {
        // Auto-expand epic that contains the current story
        const containsCurrentStory = currentStoryId
          ? epic.stories.some((s) => s.id === currentStoryId)
          : false;

        return (
          <EpicCard
            key={epic.number}
            epic={epic}
            currentStoryId={currentStoryId}
            defaultExpanded={containsCurrentStory}
          />
        );
      })}
    </div>
  );
}
