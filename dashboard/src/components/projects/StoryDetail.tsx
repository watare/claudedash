import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StoryStatusBadge } from '@/components/ui/StoryStatusBadge';
import type { Story } from '@/types/project';

interface StoryDetailProps {
  story: Story;
  onClose: () => void;
}

/**
 * Story detail panel showing acceptance criteria
 * Story 2.7: Epic/Story Progress Display (AC: #6)
 */
export function StoryDetail({ story, onClose }: StoryDetailProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Focus management when panel opens
  useEffect(() => {
    closeButtonRef.current?.focus();

    // Handle escape key
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Handle click outside to close
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="story-detail-title"
      data-testid="story-detail"
    >
      <div
        ref={panelRef}
        className="bg-[#1E2329] rounded-lg border border-[#2B3139] w-full max-w-md mx-4 max-h-[80vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#2B3139]">
          <div className="flex items-center gap-3">
            <span className="text-[#848E9C] text-sm">{story.id}</span>
            <StoryStatusBadge status={story.status} />
          </div>
          <Button
            ref={closeButtonRef}
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="Close story detail"
            data-testid="story-detail-close"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto">
          <h2 id="story-detail-title" className="text-lg font-medium text-[#EAECEF] mb-4" data-testid="story-detail-title">
            {story.title}
          </h2>

          {/* Acceptance Criteria from story file */}
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-[#848E9C] mb-2">Acceptance Criteria</h3>
              <div className="text-sm text-[#EAECEF] space-y-2" data-testid="story-acceptance-criteria">
                {story.acceptanceCriteria && story.acceptanceCriteria.length > 0 ? (
                  <ul className="space-y-2">
                    {story.acceptanceCriteria.map((criterion, index) => (
                      <li key={index} className="flex gap-2">
                        <span className="text-[#F0B90B] flex-shrink-0">{index + 1}.</span>
                        <span>{criterion}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[#848E9C] italic">
                    No acceptance criteria available for this story.
                  </p>
                )}
              </div>
            </div>

            {/* Story Metadata */}
            <div className="border-t border-[#2B3139] pt-4">
              <h3 className="text-sm font-medium text-[#848E9C] mb-2">Details</h3>
              <dl className="grid grid-cols-2 gap-2 text-sm" data-testid="story-metadata">
                <dt className="text-[#848E9C]">Story ID</dt>
                <dd className="text-[#EAECEF]">{story.id}</dd>
                <dt className="text-[#848E9C]">Status</dt>
                <dd className="text-[#EAECEF] capitalize">{story.status.replace('-', ' ')}</dd>
                {story.assignedAgent && (
                  <>
                    <dt className="text-[#848E9C]">Assigned Agent</dt>
                    <dd className="text-[#EAECEF]">{story.assignedAgent}</dd>
                  </>
                )}
                {story.duration !== undefined && (
                  <>
                    <dt className="text-[#848E9C]">Duration</dt>
                    <dd className="text-[#EAECEF]">
                      {story.duration >= 60
                        ? `${Math.floor(story.duration / 60)}h ${story.duration % 60}m`
                        : `${story.duration}m`}
                    </dd>
                  </>
                )}
              </dl>
            </div>

            {/* Link to logs for active story */}
            {story.status === 'in-progress' && (
              <div className="border-t border-[#2B3139] pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  data-testid="view-logs-button"
                  onClick={() => {
                    // Placeholder: Log viewer is Story 4.5
                    // TODO: Implement log viewer panel
                    if (import.meta.env.DEV) console.log(`[StoryDetail] View logs requested for story ${story.id}`);
                  }}
                >
                  View Agent Logs
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
