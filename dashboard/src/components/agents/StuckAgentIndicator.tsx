/**
 * StuckAgentIndicator Component
 *
 * Displays a warning indicator for stuck agents showing duration
 * and visual severity (yellow for 30-60min, red for >60min).
 * Auto-updates duration display every minute.
 *
 * Story 4.6: Stuck Agent Detection & Alerts (AC3)
 */

import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StuckAgentIndicatorProps {
  stuckAt: string;
  className?: string;
}

export function StuckAgentIndicator({ stuckAt, className }: StuckAgentIndicatorProps) {
  const [durationMinutes, setDurationMinutes] = useState(() => {
    const stuckTime = new Date(stuckAt).getTime();
    return Math.floor((Date.now() - stuckTime) / 60000);
  });

  // Auto-update duration every minute
  useEffect(() => {
    const updateDuration = () => {
      const stuckTime = new Date(stuckAt).getTime();
      setDurationMinutes(Math.floor((Date.now() - stuckTime) / 60000));
    };

    const interval = setInterval(updateDuration, 60000);
    return () => clearInterval(interval);
  }, [stuckAt]);

  // Yellow for 30-60min, red for >60min (per UX spec)
  const isWarning = durationMinutes < 60;
  const colorClass = isWarning ? 'text-[#FCD535]' : 'text-[#F6465D]';
  const bgClass = isWarning ? 'bg-[#FCD535]/10' : 'bg-[#F6465D]/10';

  const formatDuration = (mins: number) => {
    const hours = Math.floor(mins / 60);
    const minutes = mins % 60;
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded',
        bgClass,
        className
      )}
      data-testid="stuck-agent-indicator"
    >
      <AlertTriangle className={cn('h-3.5 w-3.5', colorClass)} />
      <span className={cn('text-xs font-medium', colorClass)}>
        Stuck for {formatDuration(durationMinutes)}
      </span>
    </div>
  );
}
