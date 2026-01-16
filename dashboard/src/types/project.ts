/**
 * Project-related TypeScript types
 */

// Note: 'idle' status is used when no sprint status file exists
export type ProjectStatus = 'running' | 'paused' | 'waiting' | 'failed' | 'done' | 'idle';
// Note: 'failed', 'killed', and 'pending' are runtime states for retry functionality
export type StoryStatus = 'backlog' | 'ready-for-dev' | 'in-progress' | 'review' | 'done' | 'failed' | 'killed' | 'pending';
export type EpicStatus = 'backlog' | 'in-progress' | 'done';

export interface Story {
  id: string;
  title: string;
  status: StoryStatus;
  acceptanceCriteria?: string[];
  assignedAgent?: string;
  duration?: number; // in minutes
}

export interface Epic {
  number: number;
  title: string;
  status: EpicStatus;
  stories: Story[];
}

export interface Project {
  id: string;
  name: string;
  path: string;
  status: ProjectStatus;
  currentEpic: number | null;
  currentStory: string | null;
  agentCount: number;
  lastActivity: string;
  epics?: Epic[];
  agents?: Agent[];
}

export interface ProjectsListResponse {
  data: Project[];
  meta: {
    total: number;
    timestamp: string;
  };
}

export interface ProjectDetailResponse {
  data: Project;
  meta: {
    timestamp: string;
  };
}

/**
 * Agent running within a project
 */
export interface Agent {
  id: string;
  projectId: string;
  storyId: string;
  storyTitle: string;
  status: 'running' | 'completed' | 'failed' | 'stuck' | 'killed';
  startedAt: string;
  lastActivity: string;
  lastOutput: string;
  duration: number;
}

/**
 * API error response format
 */
export interface ApiError {
  error: string;
  code: string;
  details?: Record<string, unknown>;
}
