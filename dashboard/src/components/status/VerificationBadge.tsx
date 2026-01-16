import { CheckCircle2, Loader2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type VerificationStatus = 'pending' | 'verified' | 'mismatch' | 'unknown';

interface VerificationBadgeProps {
  status: VerificationStatus;
  verifiedAt?: string;
  className?: string;
}

/**
 * Get human-readable time ago string from ISO timestamp
 */
function getTimeAgo(timestamp: string): string {
  const mins = Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * VerificationBadge displays the verification status of a story
 * - pending: Gray spinner with "Verifying..."
 * - verified: Gold checkmark with timestamp
 * - mismatch: Red warning icon
 * - unknown: Returns null (no display)
 */
export function VerificationBadge({
  status,
  verifiedAt,
  className,
}: VerificationBadgeProps) {
  switch (status) {
    case 'pending':
      return (
        <span
          className={cn('flex items-center gap-1 text-gray-400', className)}
          role="status"
          aria-label="Verification pending"
        >
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          <span className="text-sm">Verifying...</span>
        </span>
      );

    case 'verified':
      return (
        <span
          className={cn('flex items-center gap-1 text-amber-500', className)}
          role="status"
          aria-label={`Verified ${verifiedAt ? getTimeAgo(verifiedAt) : ''}`}
        >
          <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
          <span className="text-sm">
            Verified {verifiedAt ? getTimeAgo(verifiedAt) : ''}
          </span>
        </span>
      );

    case 'mismatch':
      return (
        <span
          className={cn('flex items-center gap-1 text-red-500', className)}
          role="status"
          aria-label="Status mismatch detected"
        >
          <AlertTriangle className="w-4 h-4" aria-hidden="true" />
          <span className="text-sm">Mismatch</span>
        </span>
      );

    case 'unknown':
    default:
      return null;
  }
}
