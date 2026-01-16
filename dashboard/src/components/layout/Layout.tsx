import { type ReactNode, useEffect } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { MainContent } from './MainContent';
import { AgentPanel } from '../agents/AgentPanel';
import { useUIStore } from '@/stores/uiStore';
import { useAgentsStore } from '@/stores/agentsStore';
import { useWebSocket } from '@/hooks/useWebSocket';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

/**
 * Main layout wrapper for authenticated dashboard views.
 * Story 2.1: Basic layout shell with header, sidebar, and main content area.
 * Story 2.5: Agent Activity Panel integrated as collapsible right sidebar.
 * Story 2.6: WebSocket real-time updates for agents and projects.
 */
export function Layout({ children }: LayoutProps) {
  const { agentPanelVisible, toggleAgentPanel, activeProjectId } = useUIStore();
  const { fetchAgents } = useAgentsStore();

  // Initialize WebSocket connection for real-time updates
  useWebSocket();

  // Initial fetch on mount (WebSocket handles subsequent updates)
  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  return (
    <div className="flex h-screen bg-[#0B0E11]">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <Header />
        <div className="flex-1 flex overflow-hidden">
          <MainContent>{children}</MainContent>
          <div className="w-80 shrink-0 border-l border-[#2B3139] bg-[#0B0E11] flex flex-col">
            <div className="p-3 border-b border-[#2B3139] flex items-center justify-between">
              <span className="text-sm font-medium text-[#EAECEF]">Agent Activity</span>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={toggleAgentPanel}
                aria-label={agentPanelVisible ? 'Hide agent panel' : 'Show agent panel'}
                aria-expanded={agentPanelVisible}
              >
                {agentPanelVisible ? (
                  <ChevronUp className="h-4 w-4 text-[#848E9C]" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-[#848E9C]" />
                )}
              </Button>
            </div>
            {agentPanelVisible && (
              <div className="flex-1 overflow-y-auto p-3">
                <AgentPanel projectId={activeProjectId ?? undefined} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
