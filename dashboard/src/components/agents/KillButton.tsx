/**
 * KillButton component - secondary button with red text for terminating agents
 */

import { Button } from '@/components/ui/button';

interface KillButtonProps {
  agentId: string;
  storyId: string;
  onKillRequest: () => void;
  isKilling?: boolean;
}

export function KillButton({ onKillRequest, isKilling }: KillButtonProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 text-xs text-[#F6465D] hover:bg-[#F6465D]/10 active:bg-[#F6465D]/20"
      onClick={onKillRequest}
      disabled={isKilling}
      data-testid="kill-button"
    >
      {isKilling ? 'Killing...' : 'Kill'}
    </Button>
  );
}
