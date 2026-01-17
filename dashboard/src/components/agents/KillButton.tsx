/**
 * KillButton component - secondary button with red text for terminating agents
 * Supports a prominent mode for stuck agents (Story 4.6 AC3)
 */

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface KillButtonProps {
  agentId: string;
  storyId: string;
  onKillRequest: () => void;
  isKilling?: boolean;
  prominent?: boolean; // Story 4.6: More visible when agent is stuck
}

export function KillButton({ onKillRequest, isKilling, prominent }: KillButtonProps) {
  return (
    <Button
      variant={prominent ? 'destructive' : 'ghost'}
      size="sm"
      className={cn(
        'h-7 text-xs',
        prominent
          ? 'bg-[#F6465D] hover:bg-[#F6465D]/90 text-white'
          : 'text-[#F6465D] hover:bg-[#F6465D]/10 active:bg-[#F6465D]/20'
      )}
      onClick={onKillRequest}
      disabled={isKilling}
      data-testid="kill-button"
    >
      {isKilling ? 'Killing...' : 'Kill'}
    </Button>
  );
}
