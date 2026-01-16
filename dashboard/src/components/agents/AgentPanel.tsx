import { useState } from 'react';
import { useAgentsStore } from '@/stores/agentsStore';
import { AgentRow } from './AgentRow';
import { ConfirmKillDialog } from './ConfirmKillDialog';
import { LogViewerPanel } from '@/components/logs/LogViewerPanel';
import { toast } from 'sonner';
import type { Agent } from '@/types/agent';

interface AgentPanelProps {
  projectId?: string;
}

export function AgentPanel({ projectId }: AgentPanelProps) {
  const { agents, isLoading, killingAgentId, killAgent } = useAgentsStore();
  const [agentToKill, setAgentToKill] = useState<Agent | null>(null);
  const [logViewerAgentId, setLogViewerAgentId] = useState<string | null>(null);

  // Filter by project if specified
  const filteredAgents = projectId
    ? agents.filter((a) => a.projectId === projectId)
    : agents;

  const activeAgents = filteredAgents.filter(
    (a) => a.status === 'running' || a.status === 'stuck'
  );

  const handleKillRequest = (agent: Agent) => {
    setAgentToKill(agent);
  };

  const handleKillConfirm = async () => {
    if (!agentToKill) return;

    const success = await killAgent(agentToKill.id);

    if (success) {
      toast.success('Agent terminated', {
        duration: 5000,
      });
    } else {
      const error = useAgentsStore.getState().error;
      toast.error(error || 'Failed to kill agent', {
        duration: Infinity,
        dismissible: true,
      });
    }

    setAgentToKill(null);
  };

  const handleKillCancel = () => {
    setAgentToKill(null);
  };

  const handleViewLogs = (id: string) => {
    setLogViewerAgentId(id);
  };

  // Get agent title for log viewer
  const logViewerAgent = logViewerAgentId
    ? agents.find((a) => a.id === logViewerAgentId)
    : null;
  const logViewerTitle = logViewerAgent
    ? `Logs: ${logViewerAgent.storyId || logViewerAgent.id}`
    : undefined;

  if (isLoading) {
    return (
      <div className="p-4 bg-[#1E2329] rounded-lg" data-testid="agent-panel-loading">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-[#2B3139] rounded w-24" />
          <div className="h-16 bg-[#2B3139] rounded" />
          <div className="h-16 bg-[#2B3139] rounded" />
        </div>
      </div>
    );
  }

  return (
    <div
      className="bg-[#1E2329] rounded-lg border border-[#2B3139]"
      data-testid="agent-panel"
    >
      <div className="px-4 py-3 border-b border-[#2B3139]">
        <h3 className="text-sm font-medium text-[#EAECEF]">
          AGENTS ({activeAgents.length} active)
        </h3>
      </div>

      {activeAgents.length === 0 ? (
        <div
          className="p-4 text-center text-[#848E9C] text-sm"
          data-testid="agent-panel-empty"
        >
          All agents idle
        </div>
      ) : (
        <div className="divide-y divide-[#2B3139]">
          {activeAgents.map((agent) => (
            <AgentRow
              key={agent.id}
              agent={agent}
              onKill={() => handleKillRequest(agent)}
              onViewLogs={handleViewLogs}
              isKilling={killingAgentId === agent.id}
            />
          ))}
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmKillDialog
        open={agentToKill !== null}
        onOpenChange={(open) => {
          if (!open) handleKillCancel();
        }}
        agentId={agentToKill?.id || ''}
        storyId={agentToKill?.storyId || ''}
        onConfirm={handleKillConfirm}
        isKilling={killingAgentId !== null}
      />

      {/* Log Viewer Panel - Story 4.5 */}
      <LogViewerPanel
        open={logViewerAgentId !== null}
        onOpenChange={(open) => {
          if (!open) setLogViewerAgentId(null);
        }}
        agentId={logViewerAgentId || undefined}
        title={logViewerTitle}
      />
    </div>
  );
}
