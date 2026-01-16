import { useState } from 'react';
import { ChevronDown, ChevronRight, Check } from 'lucide-react';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { StoryList } from './StoryList';
import type { Epic } from '@/types/project';

interface EpicCardProps {
  epic: Epic;
  currentStoryId?: string | null;
  defaultExpanded?: boolean;
}

/**
 * Individual epic card with expand/collapse and progress display
 * Story 2.7: Epic/Story Progress Display (AC: #2, #3)
 */
export function EpicCard({ epic, currentStoryId, defaultExpanded = false }: EpicCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const completedStories = epic.stories.filter((s) => s.status === 'done').length;
  const totalStories = epic.stories.length;
  const progressPercent = totalStories > 0 ? Math.round((completedStories / totalStories) * 100) : 0;

  const isActive = epic.stories.some((s) => s.id === currentStoryId);
  const isDone = epic.status === 'done';

  return (
    <div
      className={`rounded-lg border ${isActive ? 'border-[#F0B90B]' : 'border-[#2B3139]'} bg-[#1E2329]`}
      data-testid="epic-card"
    >
      {/* Epic Header */}
      <button
        className="w-full px-4 py-3 flex items-center justify-between text-left"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        aria-controls={`epic-${epic.number}-stories`}
        data-testid="epic-toggle"
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-[#848E9C]" aria-hidden="true" />
          ) : (
            <ChevronRight className="w-4 h-4 text-[#848E9C]" aria-hidden="true" />
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-[#EAECEF]" data-testid="epic-title">
                Epic {epic.number}: {epic.title}
              </span>
              {isDone && (
                <Check className="w-4 h-4 text-[#0ECB81]" aria-label="Completed" data-testid="epic-done-check" />
              )}
            </div>
            <span className="text-xs text-[#848E9C]" data-testid="epic-story-count">
              {completedStories}/{totalStories} stories complete
            </span>
          </div>
        </div>
        <EpicStatusBadge status={epic.status} />
      </button>

      {/* Progress Bar */}
      <div className="px-4 pb-3">
        <ProgressBar percent={progressPercent} />
      </div>

      {/* Stories List (Expanded) */}
      {isExpanded && (
        <div
          id={`epic-${epic.number}-stories`}
          className="border-t border-[#2B3139] px-4 py-3"
          data-testid="epic-stories"
        >
          <StoryList stories={epic.stories} currentStoryId={currentStoryId} />
        </div>
      )}
    </div>
  );
}

interface EpicStatusBadgeProps {
  status: string;
}

function EpicStatusBadge({ status }: EpicStatusBadgeProps) {
  const styles: Record<string, string> = {
    backlog: 'bg-[#2B3139] text-[#848E9C]',
    'in-progress': 'bg-[#FCD535]/20 text-[#FCD535]',
    done: 'bg-[#0ECB81]/20 text-[#0ECB81]',
  };

  const labels: Record<string, string> = {
    backlog: 'Backlog',
    'in-progress': 'In Progress',
    done: 'Done',
  };

  return (
    <span
      className={`px-2 py-1 rounded text-xs font-medium ${styles[status] || styles.backlog}`}
      data-testid="epic-status-badge"
    >
      {labels[status] || status}
    </span>
  );
}
