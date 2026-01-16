import { Button } from '@/components/ui/button';
import { VerificationBadge, type VerificationStatus as VerificationStatusType } from './VerificationBadge';
import { cn } from '@/lib/utils';

interface VerificationStatusProps {
  storyKey: string;
  claimed: string;
  actual: string;
  status: VerificationStatusType;
  verifiedAt?: string;
  onReVerify: () => void;
  onViewDetails: () => void;
  className?: string;
}

/**
 * VerificationStatus displays detailed verification information
 * - For mismatch: Shows claimed vs actual status with action buttons
 * - For other states: Delegates to VerificationBadge
 */
export function VerificationStatus({
  storyKey,
  claimed,
  actual,
  status,
  verifiedAt,
  onReVerify,
  onViewDetails,
  className,
}: VerificationStatusProps) {
  if (status === 'mismatch') {
    return (
      <div
        className={cn(
          'p-3 bg-red-500/10 border border-red-500/20 rounded-lg',
          className
        )}
        role="alert"
        aria-label={`Status mismatch for story ${storyKey}`}
      >
        <div className="flex items-center gap-2 mb-2">
          <VerificationBadge status="mismatch" />
          <span className="text-sm font-medium text-red-400">Status Mismatch</span>
        </div>
        <div className="text-sm text-gray-400 space-y-1">
          <p>
            Claimed: <span className="text-white">{claimed}</span>
          </p>
          <p>
            Verified: <span className="text-red-400">{actual}</span>
          </p>
        </div>
        <div className="flex gap-2 mt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={onReVerify}
            aria-label={`Re-verify story ${storyKey}`}
          >
            Re-verify
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onViewDetails}
            aria-label={`View details for story ${storyKey}`}
          >
            View Details
          </Button>
        </div>
      </div>
    );
  }

  return (
    <VerificationBadge
      status={status}
      verifiedAt={verifiedAt}
      className={className}
    />
  );
}
