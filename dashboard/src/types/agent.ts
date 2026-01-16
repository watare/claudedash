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
