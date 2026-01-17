/**
 * EventTimeline Component
 * Story 4.7: Execution History View - AC2
 *
 * Timeline view of events during a run with expand/collapse.
 */

import { useState } from 'react';
import type { ExecutionEvent, EventType } from '@/types/history';

const eventIcons: Record<EventType, string> = {
  'agent:spawn': '\u{1F680}', // 🚀
  'agent:complete': '\u{2705}', // ✅
  'agent:error': '\u{274C}', // ❌
  'agent:stuck': '\u{26A0}\u{FE0F}', // ⚠️
  'agent:killed': '\u{1F6D1}', // 🛑
  'story:verified': '\u{2714}\u{FE0F}', // ✔️
  'story:mismatch': '\u{26A1}', // ⚡
  'story:retry': '\u{1F504}', // 🔄
};

const eventColors: Record<EventType, string> = {
  'agent:spawn': 'border-blue-500',
  'agent:complete': 'border-green-500',
  'agent:error': 'border-red-500',
  'agent:stuck': 'border-yellow-500',
  'agent:killed': 'border-orange-500',
  'story:verified': 'border-amber-500',
  'story:mismatch': 'border-red-500',
  'story:retry': 'border-purple-500',
};

const eventLabels: Record<EventType, string> = {
  'agent:spawn': 'Agent Started',
  'agent:complete': 'Agent Completed',
  'agent:error': 'Agent Error',
  'agent:stuck': 'Agent Stuck',
  'agent:killed': 'Agent Killed',
  'story:verified': 'Story Verified',
  'story:mismatch': 'Status Mismatch',
  'story:retry': 'Story Retry',
};

interface EventTimelineItemProps {
  event: ExecutionEvent;
}

function EventTimelineItem({ event }: EventTimelineItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const icon = eventIcons[event.type] || '\u{2022}'; // • as fallback
  const borderColor = eventColors[event.type] || 'border-gray-500';
  const label = eventLabels[event.type] || event.type;
  const hasDetails = Object.keys(event.details).length > 0;

  const timestamp = new Date(event.timestamp);
  const timeStr = timestamp.toLocaleTimeString();

  return (
    <div
      className={`pl-4 border-l-2 ${borderColor} cursor-pointer`}
      onClick={() => hasDetails && setIsExpanded(!isExpanded)}
      role={hasDetails ? 'button' : undefined}
      tabIndex={hasDetails ? 0 : undefined}
      onKeyDown={(e) => {
        if (hasDetails && (e.key === 'Enter' || e.key === ' ')) {
          setIsExpanded(!isExpanded);
        }
      }}
    >
      <div className="flex items-start gap-3 py-2">
        <span className="text-lg" role="img" aria-label={label}>
          {icon}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-[#EAECEF]">{label}</p>
            {event.storyId && (
              <span className="text-[#848E9C] text-sm">
                Story {event.storyId}
              </span>
            )}
            {event.agentId && (
              <span className="text-[#848E9C] text-sm">
                Agent {event.agentId}
              </span>
            )}
            {hasDetails && (
              <span className="text-[#848E9C] text-xs">
                {isExpanded ? '\u{25BC}' : '\u{25B6}'} {/* ▼ or ▶ */}
              </span>
            )}
          </div>
          <p className="text-sm text-[#5E6673]">{timeStr}</p>

          {/* Expanded details */}
          {isExpanded && hasDetails && (
            <pre className="mt-2 text-xs text-[#848E9C] bg-black/30 p-2 rounded overflow-x-auto">
              {JSON.stringify(event.details, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

interface EventTimelineProps {
  events: ExecutionEvent[];
}

export function EventTimeline({ events }: EventTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-[#848E9C]">
        <p>No events recorded for this run</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {events.map((event) => (
        <EventTimelineItem key={event.id} event={event} />
      ))}
    </div>
  );
}
