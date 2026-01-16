import { useAgentsStore } from '@/stores/agentsStore';
import { AgentRow } from './AgentRow';
import { toast } from 'sonner';

interface AgentPanelProps {
  projectId?: string;
}

export function AgentPanel({ projectId }: AgentPanelProps) {
  const { agents, isLoading } = useAgentsStore();

  // Filter by project if specified
  const filteredAgents = projectId
    ? agents.filter((a) => a.projectId === projectId)
    : agents;

  const activeAgents = filteredAgents.filter(
    (a) => a.status === 'running' || a.status === 'stuck'
  );

  const handleKill = (id: string) => {
    // Placeholder - Epic 4 implements actual kill functionality
    toast.info('Kill agent coming in Epic 4', {
      description: `Agent ${id} will be terminated`,
    });
  };

  const handleViewLogs = (id: string) => {
    // Placeholder - Story 4.5 implements log viewer panel
    toast.info('Log viewer coming in Story 4.5', {
      description: `Viewing logs for agent ${id}`,
    });
  };

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
              onKill={handleKill}
              onViewLogs={handleViewLogs}
            />
          ))}
        </div>
      )}
    </div>
  );
}
