/**
 * RetryButton component - primary button with gold styling for retrying failed stories
 * Story 4.4: AC1 - Retry button for failed stories
 */

import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';

interface RetryButtonProps {
  onRetry: (e: React.MouseEvent<HTMLButtonElement>) => void;
  isRetrying?: boolean;
}

export function RetryButton({ onRetry, isRetrying }: RetryButtonProps) {
  return (
    <Button
      size="sm"
      onClick={onRetry}
      disabled={isRetrying}
      className="h-7 text-xs bg-amber-500 hover:bg-amber-600 text-black font-medium"
      data-testid="retry-button"
    >
      <RotateCcw className={`h-3 w-3 mr-1 ${isRetrying ? 'animate-spin' : ''}`} />
      {isRetrying ? 'Retrying...' : 'Retry'}
    </Button>
  );
}
