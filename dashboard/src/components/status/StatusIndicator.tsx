import type { StoryStatus } from '@/types/project';
import { VerificationBadge, type VerificationStatus } from './VerificationBadge';
import { cn } from '@/lib/utils';

interface StatusIndicatorProps {
  /** The story's claimed status */
  storyStatus: StoryStatus;
  /** The verification state */
  verificationStatus: VerificationStatus;
  /** Timestamp of last verification */
  verifiedAt?: string;
  /** Show full text label next to status dot */
  showLabel?: boolean;
  /** Additional CSS classes */
  className?: string;
}

const statusColors: Record<StoryStatus, string> = {
  backlog: 'bg-[#5E6673]',
  'ready-for-dev': 'bg-[#FCD535]',
  'in-progress': 'bg-[#0ECB81]',
  review: 'bg-[#F0B90B]',
  done: 'bg-[#0ECB81]',
};

const statusLabels: Record<StoryStatus, string> = {
  backlog: 'Backlog',
  'ready-for-dev': 'Ready for Dev',
  'in-progress': 'In Progress',
  review: 'Review',
  done: 'Done',
};

/**
 * StatusIndicator combines status dot with verification badge
 * Handles all verification states: pending, verified, mismatch, unknown
 */
export function StatusIndicator({
  storyStatus,
  verificationStatus,
  verifiedAt,
  showLabel = false,
  className,
}: StatusIndicatorProps) {
  const colorClass = statusColors[storyStatus];
  const label = statusLabels[storyStatus];
  const isActive = storyStatus === 'in-progress';

  return (
    <div
      className={cn('flex items-center gap-2', className)}
      role="group"
      aria-label={`Story status: ${label}`}
    >
      {/* Status dot */}
      <span
        className={cn(
          'inline-block w-2 h-2 rounded-full shrink-0',
          colorClass,
          isActive && 'animate-pulse'
        )}
        aria-hidden="true"
      />

      {/* Status label (optional) */}
      {showLabel && (
        <span className="text-sm text-gray-300">{label}</span>
      )}

      {/* Verification badge */}
      <VerificationBadge status={verificationStatus} verifiedAt={verifiedAt} />
    </div>
  );
}
