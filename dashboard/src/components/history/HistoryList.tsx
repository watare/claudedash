/**
 * HistoryList Component
 * Story 4.7: Execution History View - AC1, AC4
 *
 * Displays list of past orchestration runs with pagination.
 */

import { useHistoryStore } from '@/stores/historyStore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { ExecutionRun, ExecutionStatus } from '@/types/history';

const statusStyles: Record<ExecutionStatus, string> = {
  completed: 'bg-green-500/20 text-green-400 border-green-500/30',
  failed: 'bg-red-500/20 text-red-400 border-red-500/30',
  running: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  stopped: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

interface HistoryListItemProps {
  run: ExecutionRun;
  onClick: () => void;
}

function HistoryListItem({ run, onClick }: HistoryListItemProps) {
  return (
    <div
      className="bg-[#1E2329] p-4 rounded-lg border border-[#2B3139] hover:border-amber-500/50 cursor-pointer transition-colors"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onClick();
        }
      }}
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-[#EAECEF]">{run.project}</h3>
          <p className="text-sm text-[#848E9C]">
            {formatRelativeTime(run.startedAt)}
          </p>
        </div>
        <Badge className={statusStyles[run.status]}>{run.status}</Badge>
      </div>

      <div className="mt-3 flex items-center gap-6 text-sm">
        <span className="text-green-400">
          {run.storiesCompleted} completed
        </span>
        {run.storiesFailed > 0 && (
          <span className="text-red-400">{run.storiesFailed} failed</span>
        )}
        <span className="text-[#848E9C]">Duration: {run.duration}</span>
      </div>
    </div>
  );
}

function HistoryListSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="bg-[#1E2329] p-4 rounded-lg border border-[#2B3139]"
        >
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-5 w-32 mb-2" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <div className="mt-3 flex items-center gap-6">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function HistoryList() {
  const { runs, pagination, isLoading, selectRun, setPage } = useHistoryStore();

  if (isLoading) {
    return <HistoryListSkeleton />;
  }

  if (runs.length === 0) {
    return (
      <div className="text-center py-12 text-[#848E9C]">
        <p className="text-lg">No execution history found</p>
        <p className="text-sm mt-2">
          Run an orchestration to see history here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {runs.map((run) => (
        <HistoryListItem
          key={run.id}
          run={run}
          onClick={() => selectRun(run.id)}
        />
      ))}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-6">
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page === 1}
            onClick={() => setPage(pagination.page - 1)}
            className="border-[#2B3139] text-[#EAECEF] hover:bg-[#2B3139]"
          >
            Previous
          </Button>
          <span className="py-2 px-4 text-[#848E9C]">
            Page {pagination.page} of {pagination.pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page === pagination.pages}
            onClick={() => setPage(pagination.page + 1)}
            className="border-[#2B3139] text-[#EAECEF] hover:bg-[#2B3139]"
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
