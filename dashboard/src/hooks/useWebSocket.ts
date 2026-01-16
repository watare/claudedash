/**
 * useWebSocket hook - connects stores to WebSocket events
 *
 * This hook:
 * - Establishes WebSocket connection on mount
 * - Routes incoming events to appropriate store actions
 * - Handles reconnection and state re-sync
 * - Cleans up on unmount
 */

import { useEffect, useRef } from 'react';
import { wsClient, type WSMessage } from '../services/websocket';
import { useAgentsStore } from '../stores/agentsStore';
import { useProjectsStore } from '../stores/projectsStore';
import { useStoriesStore } from '../stores/storiesStore';
import { useLogsStore } from '../stores/logsStore';
import { useUIStore } from '../stores/uiStore';
import { getAccessToken } from '../services/api';
import type { Agent } from '../types/agent';
import type { StoryStatus } from '../types/project';

// Type definitions for WebSocket event payloads
interface AgentSpawnPayload {
  agentId: string;
  projectId: string;
  storyId: string;
  storyTitle: string;
}

interface AgentOutputPayload {
  agentId: string;
  output: string;
  timestamp?: string;
}

interface AgentCompletePayload {
  agentId: string;
}

interface AgentKillPayload {
  agentId: string;
}

interface AgentStuckPayload {
  agentId: string;
  duration: number;
}

interface StoryVerifiedPayload {
  storyId: string;
  match: boolean;
}

interface ReconnectingPayload {
  attempt: number;
  delay: number;
}

// Story 4.4: Story retry event payload
interface StoryRetryPayload {
  storyId: string;
  status: StoryStatus;
}

// Story 4.5: Log event payload
interface LogPayload {
  id: string | number;
  time?: string;
  timestamp?: string;
  message: string;
  level?: 'error' | 'warn' | 'info' | 'debug';
  agentId?: string;
}

/**
 * Hook to manage WebSocket connection and event handling.
 * Should be called once in the top-level authenticated component.
 */
export function useWebSocket() {
  const isInitialized = useRef(false);

  // Store actions
  const { addAgent, updateAgent, removeAgent, fetchAgents } = useAgentsStore();
  const { fetchProjects } = useProjectsStore();
  const { updateStoryStatus } = useStoriesStore();
  const { appendLog } = useLogsStore();
  const { setConnectionStatus, addToast } = useUIStore();

  useEffect(() => {
    const token = getAccessToken();

    if (!token || isInitialized.current) return;

    isInitialized.current = true;
    wsClient.connect(token);

    // Connection events
    const unsubOpen = wsClient.on('connection:open', () => {
      setConnectionStatus('connected');
    });

    const unsubReconnecting = wsClient.on('connection:reconnecting', (msg: WSMessage) => {
      setConnectionStatus('reconnecting');
      const data = msg.data as ReconnectingPayload;
      addToast({
        type: 'info',
        message: `Reconnecting... (attempt ${data.attempt})`,
      });
    });

    // Agent events
    const unsubAgentSpawn = wsClient.on('agent:spawn', (msg: WSMessage) => {
      const data = msg.data as AgentSpawnPayload;
      const newAgent: Agent = {
        id: data.agentId,
        projectId: data.projectId,
        storyId: data.storyId,
        storyTitle: data.storyTitle,
        status: 'running',
        startedAt: msg.timestamp || new Date().toISOString(),
        lastActivity: msg.timestamp || new Date().toISOString(),
        lastOutput: 'Starting...',
        duration: 0,
      };
      addAgent(newAgent);
    });

    const unsubAgentOutput = wsClient.on('agent:output', (msg: WSMessage) => {
      const data = msg.data as AgentOutputPayload;
      const agents = useAgentsStore.getState().agents;
      const agent = agents.find((a) => a.id === data.agentId);
      if (agent) {
        updateAgent({
          ...agent,
          lastOutput: data.output,
          lastActivity: msg.timestamp || new Date().toISOString(),
        });
      }
    });

    const unsubAgentComplete = wsClient.on('agent:complete', (msg: WSMessage) => {
      const data = msg.data as AgentCompletePayload;
      removeAgent(data.agentId);
    });

    const unsubAgentKill = wsClient.on('agent:kill', (msg: WSMessage) => {
      const data = msg.data as AgentKillPayload;
      removeAgent(data.agentId);
    });

    const unsubAgentStuck = wsClient.on('agent:stuck', (msg: WSMessage) => {
      const data = msg.data as AgentStuckPayload;
      const agents = useAgentsStore.getState().agents;
      const agent = agents.find((a) => a.id === data.agentId);
      if (agent) {
        updateAgent({ ...agent, status: 'stuck' });
      }
      addToast({
        type: 'warning',
        message: `Agent stuck on story for ${Math.round(data.duration / 60)}m`,
      });
    });

    // Project events
    const unsubProjectUpdate = wsClient.on('project:update', () => {
      // Re-fetch to get full updated data
      fetchProjects();
    });

    // Story verification events
    const unsubStoryVerified = wsClient.on('story:verified', (msg: WSMessage) => {
      const data = msg.data as StoryVerifiedPayload;
      if (!data.match) {
        addToast({
          type: 'error',
          message: `Status mismatch on story ${data.storyId}`,
        });
      }
    });

    // Story 4.4: Story retry events (AC2, AC6)
    const unsubStoryRetry = wsClient.on('story:retry', (msg: WSMessage) => {
      const data = msg.data as StoryRetryPayload;
      updateStoryStatus(data.storyId, data.status);
    });

    // Story 4.5: Log events for real-time streaming
    const unsubLog = wsClient.on('log', (msg: WSMessage) => {
      const data = msg.data as LogPayload;
      // Route log to appropriate agent or use 'orchestrator' as fallback
      const agentId = data.agentId || 'orchestrator';
      appendLog(agentId, {
        id: data.id,
        timestamp: data.time || data.timestamp || msg.timestamp || new Date().toISOString(),
        message: data.message,
        level: data.level || 'info',
        agentId,
      });
    });

    // Re-sync on reconnection
    const unsubReconnected = wsClient.on('connection:established', () => {
      if (import.meta.env.DEV) console.log('Re-syncing state after reconnection');
      fetchProjects();
      fetchAgents();
      addToast({
        type: 'success',
        message: 'Connection restored',
      });
    });

    // Cleanup
    return () => {
      unsubOpen();
      unsubReconnecting();
      unsubAgentSpawn();
      unsubAgentOutput();
      unsubAgentComplete();
      unsubAgentKill();
      unsubAgentStuck();
      unsubProjectUpdate();
      unsubStoryVerified();
      unsubStoryRetry();
      unsubLog();
      unsubReconnected();
      wsClient.disconnect();
      isInitialized.current = false;
    };
  }, [addAgent, updateAgent, removeAgent, fetchAgents, fetchProjects, updateStoryStatus, appendLog, setConnectionStatus, addToast]);
}
