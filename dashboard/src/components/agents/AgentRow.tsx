import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, XCircle } from 'lucide-react';
import { formatDuration } from '@/utils/formatters';
import { KillButton } from './KillButton';
import { StuckAgentIndicator } from './StuckAgentIndicator';
import type { Agent } from '@/types/agent';

interface AgentRowProps {
  agent: Agent;
  onKill: (id: string) => void;
  onViewLogs: (id: string) => void;
  isKilling?: boolean;
}

// Configurable thresholds via environment variables (defaults: 25min warn, 30min stuck - matches backend)
const WARN_THRESHOLD = parseInt(import.meta.env.VITE_AGENT_WARN_THRESHOLD || '1500', 10); // 25 minutes in seconds
const STUCK_THRESHOLD = parseInt(import.meta.env.VITE_AGENT_STUCK_THRESHOLD || '1800', 10); // 30 minutes in seconds (matches backend config.stuckThresholdMinutes)

export function AgentRow({ agent, onKill, onViewLogs, isKilling }: AgentRowProps) {
  const [currentDuration, setCurrentDuration] = useState(agent.duration);

  // Update duration every second for running agents
  useEffect(() => {
    if (agent.status !== 'running' && agent.status !== 'stuck') {
      return;
    }

    const interval = setInterval(() => {
      const start = new Date(agent.startedAt).getTime();
      const now = Date.now();
      setCurrentDuration(Math.floor((now - start) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [agent.startedAt, agent.status]);

  // Sync with prop when agent is updated externally
  useEffect(() => {
    setCurrentDuration(agent.duration);
  }, [agent.duration]);

  // Agent is stuck if stuckAt is set OR if duration exceeds threshold (fallback)
  const isStuck = agent.stuckAt !== null || currentDuration > STUCK_THRESHOLD;
  const isWarning = !isStuck && currentDuration > WARN_THRESHOLD && currentDuration <= STUCK_THRESHOLD;
  const showActions = isWarning || isStuck;

  const getIndicator = () => {
    if (isStuck) {
      return (
        <XCircle
          className="w-4 h-4 text-[#F6465D]"
          aria-label="Stuck status"
          data-testid="stuck-indicator"
        />
      );
    }
    if (isWarning) {
      return (
        <AlertTriangle
          className="w-4 h-4 text-[#FCD535]"
          aria-label="Warning status"
          data-testid="warning-indicator"
        />
      );
    }
    return (
      <span
        className="relative flex h-2 w-2"
        data-testid="pulsing-indicator"
        role="status"
        aria-label="Running status"
      >
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#0ECB81] opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-[#0ECB81]" />
      </span>
    );
  };

  const truncateOutput = (output: string, maxLength = 60): string => {
    if (!output) return 'Starting...';
    if (output.length <= maxLength) return output;
    return output.substring(0, maxLength) + '...';
  };

  return (
    <div className="px-4 py-3" data-testid="agent-row">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {getIndicator()}
          <div>
            <span className="text-sm text-[#EAECEF]">
              {agent.id.length > 8 ? agent.id.substring(0, 8) : agent.id} - Story {agent.storyId}
            </span>
          </div>
        </div>
        <span
          className={`
            text-xs font-mono
            ${isStuck ? 'text-[#F6465D]' : isWarning ? 'text-[#FCD535]' : 'text-[#848E9C]'}
          `}
        >
          {isStuck ? 'Stuck' : 'Running'} {formatDuration(currentDuration)}
        </span>
      </div>

      {/* Show StuckAgentIndicator when agent has stuckAt set (Story 4.6 AC3) */}
      {agent.stuckAt && (
        <div className="mt-1 ml-5">
          <StuckAgentIndicator stuckAt={agent.stuckAt} />
        </div>
      )}

      <p className="mt-1 ml-5 text-xs text-[#5E6673] truncate">
        Last: "{truncateOutput(agent.lastOutput)}"
      </p>

      {/* Kill and View Logs buttons more prominent when stuck (Story 4.6 AC3) */}
      <div className="mt-2 ml-5 flex gap-2">
        <KillButton
          agentId={agent.id}
          storyId={agent.storyId || 'unknown'}
          onKillRequest={() => onKill(agent.id)}
          isKilling={isKilling}
          prominent={isStuck}
        />
        {showActions && (
          <Button
            variant={isStuck ? 'secondary' : 'ghost'}
            size="sm"
            className={isStuck ? 'h-7 text-xs bg-[#2B3139] hover:bg-[#3B4149]' : 'h-7 text-xs'}
            onClick={() => onViewLogs(agent.id)}
          >
            View Logs
          </Button>
        )}
      </div>
    </div>
  );
}
