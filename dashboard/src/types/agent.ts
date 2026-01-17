/**
 * Agent-related TypeScript types
 */

export type AgentStatus = 'running' | 'stuck' | 'completed' | 'killed' | 'failed';

export interface Agent {
  id: string;
  projectId: string;
  storyId: string | null;
  storyTitle: string;
  status: AgentStatus;
  startedAt: string;
  lastActivity: string;
  lastOutput: string;
  duration: number;
  stuckAt: string | null; // Story 4.6: ISO timestamp when marked stuck, null if not stuck
}

export interface AgentWithHistory extends Agent {
  outputHistory: string[];
}

export interface AgentsListResponse {
  data: Agent[];
  meta: {
    total: number;
    timestamp: string;
  };
}

export interface AgentDetailResponse {
  data: AgentWithHistory;
  meta: {
    timestamp: string;
  };
}
