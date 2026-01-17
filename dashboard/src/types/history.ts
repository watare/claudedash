/**
 * History types
 * Story 4.7: Execution History View
 */

export type ExecutionStatus = 'running' | 'completed' | 'failed' | 'stopped';

export interface ExecutionRun {
  id: number;
  project: string;
  startedAt: string;
  endedAt: string | null;
  status: ExecutionStatus;
  storiesCompleted: number;
  storiesFailed: number;
  storiesTotal: number;
  duration: string;
  durationMs: number;
  config?: {
    projectRoot?: string;
    batchSize?: number;
    maxRetries?: number;
    epicFilter?: number[];
    storyFilter?: string[];
  } | null;
  createdAt: string;
}

export type EventType =
  | 'agent:spawn'
  | 'agent:complete'
  | 'agent:error'
  | 'agent:stuck'
  | 'agent:killed'
  | 'story:verified'
  | 'story:mismatch'
  | 'story:retry';

export interface ExecutionEvent {
  id: number;
  timestamp: string;
  type: EventType;
  agentId: string | null;
  storyId: string | null;
  epicNumber: number | null;
  details: Record<string, unknown>;
}

export interface ExecutionRunWithEvents extends ExecutionRun {
  events: ExecutionEvent[];
}

export interface HistoryFilters {
  project: string | null;
  status: ExecutionStatus | null;
  startDate: string | null;
  endDate: string | null;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
}
