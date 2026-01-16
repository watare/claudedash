/**
 * Log entry type for agent/orchestrator logs
 */
export interface LogEntry {
  id: string | number;
  timestamp: string;
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  agentId?: string;
}

/**
 * Logs API response
 */
export interface LogsResponse {
  logs: LogEntry[];
  total: number;
}
