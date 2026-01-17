/**
 * RunDetailPanel Component
 * Story 4.7: Execution History View - AC2
 *
 * Side panel showing run details with event timeline.
 */

import { useHistoryStore } from '@/stores/historyStore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EventTimeline } from './EventTimeline';
import type { ExecutionStatus } from '@/types/history';

const statusStyles: Record<ExecutionStatus, string> = {
  completed: 'bg-green-500/20 text-green-400 border-green-500/30',
  failed: 'bg-red-500/20 text-red-400 border-red-500/30',
  running: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  stopped: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

function RunDetailSkeleton() {
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-8 w-8 rounded" />
      </div>
      <Skeleton className="h-4 w-24" />
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-16 rounded-lg" />
      </div>
      <Skeleton className="h-5 w-28" />
      <div className="space-y-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  );
}

export function RunDetailPanel() {
  const { selectedRun, isLoadingDetail, clearSelectedRun } = useHistoryStore();

  if (!selectedRun && !isLoadingDetail) {
    return null;
  }

  if (isLoadingDetail) {
    return (
      <div className="w-96 bg-[#1E2329] border-l border-[#2B3139] overflow-y-auto">
        <RunDetailSkeleton />
      </div>
    );
  }

  if (!selectedRun) {
    return null;
  }

  const startedAt = new Date(selectedRun.startedAt);
  const endedAt = selectedRun.endedAt ? new Date(selectedRun.endedAt) : null;

  return (
    <div className="w-96 bg-[#1E2329] border-l border-[#2B3139] overflow-y-auto flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-[#2B3139]">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#EAECEF]">
            Run Details
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearSelectedRun}
            className="text-[#848E9C] hover:text-[#EAECEF] h-8 w-8 p-0"
          >
            &times;
          </Button>
        </div>
      </div>

      {/* Run info */}
      <div className="p-4 border-b border-[#2B3139]">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium text-[#EAECEF]">{selectedRun.project}</h3>
          <Badge className={statusStyles[selectedRun.status]}>
            {selectedRun.status}
          </Badge>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-[#848E9C]">Started:</span>
            <span className="text-[#EAECEF]">
              {startedAt.toLocaleString()}
            </span>
          </div>
          {endedAt && (
            <div className="flex justify-between">
              <span className="text-[#848E9C]">Ended:</span>
              <span className="text-[#EAECEF]">
                {endedAt.toLocaleString()}
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-[#848E9C]">Duration:</span>
            <span className="text-[#EAECEF]">{selectedRun.duration}</span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          <div className="bg-[#0B0E11] p-2 rounded text-center">
            <p className="text-lg font-semibold text-[#EAECEF]">
              {selectedRun.storiesTotal}
            </p>
            <p className="text-xs text-[#848E9C]">Total</p>
          </div>
          <div className="bg-[#0B0E11] p-2 rounded text-center">
            <p className="text-lg font-semibold text-green-400">
              {selectedRun.storiesCompleted}
            </p>
            <p className="text-xs text-[#848E9C]">Completed</p>
          </div>
          <div className="bg-[#0B0E11] p-2 rounded text-center">
            <p className="text-lg font-semibold text-red-400">
              {selectedRun.storiesFailed}
            </p>
            <p className="text-xs text-[#848E9C]">Failed</p>
          </div>
        </div>
      </div>

      {/* Event timeline */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <h4 className="text-sm font-medium text-[#848E9C] mb-3">
            Event Timeline ({selectedRun.events.length} events)
          </h4>
          <EventTimeline events={selectedRun.events} />
        </div>
      </div>
    </div>
  );
}
