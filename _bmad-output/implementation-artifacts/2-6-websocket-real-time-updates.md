# Story 2.6: WebSocket Real-Time Updates

Status: done

## Story

As a **user**,
I want **the dashboard to update in real-time without page refresh**,
So that **I see current status as agents progress** (FR40).

## Acceptance Criteria

1. **Given** I am viewing the dashboard, **When** a WebSocket connection is established, **Then** the connection authenticates using my JWT token
2. **Given** I have an authenticated WebSocket, **Then** I receive real-time events for all projects I have access to
3. **Given** an agent spawns, completes, or updates, **When** the server broadcasts a WebSocket event, **Then** the dashboard receives `{ type: "agent:spawn|complete|output", data: {...} }`
4. **Given** a WebSocket event is received, **Then** the relevant Zustand store updates automatically
5. **Given** a WebSocket event is received, **Then** UI re-renders within 500ms (NFR-P3)
6. **Given** the WebSocket connection drops, **When** reconnection is attempted, **Then** the client automatically reconnects with exponential backoff
7. **Given** the client reconnects, **Then** state is re-synced on reconnection

## Tasks / Subtasks

- [x] Task 1: Enhance Backend WebSocket Server (AC: #1, #2, #3)
  - [x] Update `src/server.js` WebSocket handling for auth
  - [x] Implement JWT token verification on connection
  - [x] Add connection tracking per authenticated user
  - [x] Define event types and message format

- [x] Task 2: Create WebSocket Event Broadcasting (AC: #3)
  - [x] Create `src/services/websocket.js` broadcast service
  - [x] Implement `broadcast(event, data)` function
  - [x] Implement `broadcastToUser(userId, event, data)`
  - [x] Integrate with orchestrator events

- [x] Task 3: Create Frontend WebSocket Client (AC: #1, #6)
  - [x] Create `dashboard/src/services/websocket.ts`
  - [x] Implement connection with auth token
  - [x] Implement automatic reconnection with exponential backoff
  - [x] Handle connection state (connected, disconnected, reconnecting)

- [x] Task 4: Create useWebSocket Hook (AC: #4, #5)
  - [x] Create `dashboard/src/hooks/useWebSocket.ts`
  - [x] Subscribe to WebSocket on mount
  - [x] Route events to appropriate store actions
  - [x] Track connection state in uiStore

- [x] Task 5: Implement Store Event Handlers (AC: #4)
  - [x] Add WebSocket event handlers to agentsStore
  - [x] Add WebSocket event handlers to projectsStore
  - [x] Handle: agent:spawn, agent:complete, agent:output, agent:stuck
  - [x] Handle: project:update, story:verified

- [x] Task 6: Implement State Re-Sync on Reconnect (AC: #7)
  - [x] Detect reconnection in WebSocket client
  - [x] Trigger full data refresh on reconnect
  - [x] Re-fetch projects and agents from API
  - [x] Display reconnection toast notification

### Review Follow-ups (AI)

- [x] [AI-Review][MEDIUM] Define distinct WebSocket close code constants (4001 vs 4002) [src/server.js:24-25]
- [ ] [AI-Review][MEDIUM] Add integration tests for WebSocket authentication handshake [src/server.js:141-209]
- [x] [AI-Review][LOW] Remove duplicate timestamp in emitAgentOutput [src/services/websocket.js:91-94]
- [ ] [AI-Review][LOW] Consider consolidating dual client tracking (this.clients Set vs authenticatedClients Map) [src/server.js:48,51]

## Dev Notes

### Architecture & File Locations

**Backend Files to Modify/Create:**
```
src/
├── server.js                 # Modify WebSocket setup
└── services/
    └── websocket.js          # NEW: Broadcast service
```

**Frontend Files to Create:**
```
dashboard/src/
├── services/
│   └── websocket.ts          # WebSocket client
└── hooks/
    └── useWebSocket.ts       # React hook for WS
```

### Technical Requirements

**WebSocket Message Format (from architecture.md):**
```typescript
interface WSMessage {
  type: string;      // Format: '{entity}:{action}'
  data: unknown;     // Payload
  timestamp?: string; // ISO 8601
}

// Event Types
type WSEventType =
  | 'agent:spawn'     // New agent started
  | 'agent:output'    // Agent produced output
  | 'agent:complete'  // Agent finished
  | 'agent:stuck'     // Agent detected as stuck
  | 'agent:killed'    // Agent was terminated
  | 'project:update'  // Project status changed
  | 'project:start'   // Project orchestration started
  | 'project:complete'// Project finished
  | 'story:verified'  // Story status verified
  | 'story:mismatch'; // Status verification failed
```

**Event Payloads:**
```typescript
// agent:spawn
{ agentId: string, projectId: string, storyId: string, storyTitle: string }

// agent:output
{ agentId: string, output: string, timestamp: string }

// agent:complete
{ agentId: string, projectId: string, storyId: string, result: 'success' | 'failed' }

// agent:stuck
{ agentId: string, projectId: string, duration: number }

// project:update
{ projectId: string, status: ProjectStatus, currentEpic?: number, currentStory?: string }

// story:verified
{ projectId: string, storyId: string, claimed: string, actual: string, match: boolean }
```

### Implementation Patterns

**Backend WebSocket Server Enhancement:**
```javascript
// src/server.js - Modify existing WebSocket setup
import { WebSocketServer } from 'ws';
import { verifyToken } from './auth/jwt.js';
import { broadcastService } from './services/websocket.js';

// Store authenticated connections
const authenticatedClients = new Map();

wss.on('connection', (ws, req) => {
  // Extract token from query string or cookie
  const url = new URL(req.url, `http://${req.headers.host}`);
  const token = url.searchParams.get('token');

  if (!token) {
    ws.close(4001, 'Authentication required');
    return;
  }

  try {
    const user = verifyToken(token);
    ws.userId = user.id;
    ws.isAuthenticated = true;

    authenticatedClients.set(user.id, ws);

    ws.on('close', () => {
      authenticatedClients.delete(user.id);
    });

    // Send connection acknowledgment
    ws.send(JSON.stringify({
      type: 'connection:established',
      data: { userId: user.id },
      timestamp: new Date().toISOString()
    }));
  } catch (error) {
    ws.close(4001, 'Invalid token');
  }
});

// Export for broadcast service
export { wss, authenticatedClients };
```

**Backend Broadcast Service:**
```javascript
// src/services/websocket.js
import { wss, authenticatedClients } from '../server.js';

/**
 * Broadcast event to all authenticated clients
 */
export function broadcast(type, data) {
  const message = JSON.stringify({
    type,
    data,
    timestamp: new Date().toISOString()
  });

  authenticatedClients.forEach((ws) => {
    if (ws.readyState === 1) { // OPEN
      ws.send(message);
    }
  });
}

/**
 * Broadcast event to specific user
 */
export function broadcastToUser(userId, type, data) {
  const ws = authenticatedClients.get(userId);
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify({
      type,
      data,
      timestamp: new Date().toISOString()
    }));
  }
}

/**
 * Integration with orchestrator - call these when events occur
 */
export function emitAgentSpawn(agent) {
  broadcast('agent:spawn', {
    agentId: agent.id,
    projectId: agent.projectId,
    storyId: agent.storyId,
    storyTitle: agent.storyTitle
  });
}

export function emitAgentOutput(agentId, output) {
  broadcast('agent:output', {
    agentId,
    output,
    timestamp: new Date().toISOString()
  });
}

export function emitAgentComplete(agent, result) {
  broadcast('agent:complete', {
    agentId: agent.id,
    projectId: agent.projectId,
    storyId: agent.storyId,
    result
  });
}

export function emitAgentStuck(agent, duration) {
  broadcast('agent:stuck', {
    agentId: agent.id,
    projectId: agent.projectId,
    duration
  });
}

export function emitProjectUpdate(project) {
  broadcast('project:update', {
    projectId: project.id,
    status: project.status,
    currentEpic: project.currentEpic,
    currentStory: project.currentStory
  });
}

export function emitStoryVerified(result) {
  broadcast('story:verified', result);
}
```

**Frontend WebSocket Client:**
```typescript
// dashboard/src/services/websocket.ts
type MessageHandler = (message: WSMessage) => void;

interface WSMessage {
  type: string;
  data: unknown;
  timestamp?: string;
}

class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private token: string | null = null;
  private handlers: Map<string, MessageHandler[]> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private isReconnecting = false;

  constructor() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.url = `${protocol}//${window.location.host}`;
  }

  connect(token: string): void {
    this.token = token;
    this.establishConnection();
  }

  private establishConnection(): void {
    if (!this.token) return;

    this.ws = new WebSocket(`${this.url}?token=${this.token}`);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      this.isReconnecting = false;
      this.emit('connection:open', {});
    };

    this.ws.onmessage = (event) => {
      try {
        const message: WSMessage = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    this.ws.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason);
      if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  private scheduleReconnect(): void {
    if (this.isReconnecting) return;

    this.isReconnecting = true;
    this.reconnectAttempts++;

    // Exponential backoff: 1s, 2s, 4s, 8s, ...max 30s
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      30000
    );

    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    this.emit('connection:reconnecting', { attempt: this.reconnectAttempts, delay });

    setTimeout(() => {
      this.establishConnection();
    }, delay);
  }

  private handleMessage(message: WSMessage): void {
    const handlers = this.handlers.get(message.type) || [];
    handlers.forEach(handler => handler(message));

    // Also trigger wildcard handlers
    const wildcardHandlers = this.handlers.get('*') || [];
    wildcardHandlers.forEach(handler => handler(message));
  }

  on(type: string, handler: MessageHandler): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, []);
    }
    this.handlers.get(type)!.push(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.handlers.get(type);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) handlers.splice(index, 1);
      }
    };
  }

  private emit(type: string, data: unknown): void {
    this.handleMessage({ type, data, timestamp: new Date().toISOString() });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const wsClient = new WebSocketClient();
```

**useWebSocket Hook:**
```typescript
// dashboard/src/hooks/useWebSocket.ts
import { useEffect, useRef } from 'react';
import { wsClient } from '../services/websocket';
import { useAgentsStore } from '../stores/agentsStore';
import { useProjectsStore } from '../stores/projectsStore';
import { useUIStore } from '../stores/uiStore';
import { useAuthStore } from '../stores/authStore';
import type { Agent } from '../types/agent';
import type { Project } from '../types/project';

export function useWebSocket() {
  const { token } = useAuthStore();
  const { addAgent, updateAgent, removeAgent, fetchAgents } = useAgentsStore();
  const { fetchProjects } = useProjectsStore();
  const { setConnectionStatus, addToast } = useUIStore();
  const isInitialized = useRef(false);

  useEffect(() => {
    if (!token || isInitialized.current) return;

    isInitialized.current = true;
    wsClient.connect(token);

    // Connection events
    const unsubOpen = wsClient.on('connection:open', () => {
      setConnectionStatus('connected');
    });

    const unsubReconnecting = wsClient.on('connection:reconnecting', (msg) => {
      setConnectionStatus('reconnecting');
      addToast({
        type: 'info',
        message: `Reconnecting... (attempt ${(msg.data as any).attempt})`
      });
    });

    // Agent events
    const unsubAgentSpawn = wsClient.on('agent:spawn', (msg) => {
      const data = msg.data as {
        agentId: string;
        projectId: string;
        storyId: string;
        storyTitle: string;
      };
      addAgent({
        id: data.agentId,
        projectId: data.projectId,
        storyId: data.storyId,
        storyTitle: data.storyTitle,
        status: 'running',
        startedAt: msg.timestamp || new Date().toISOString(),
        lastActivity: msg.timestamp || new Date().toISOString(),
        lastOutput: 'Starting...',
        duration: 0
      });
    });

    const unsubAgentOutput = wsClient.on('agent:output', (msg) => {
      const data = msg.data as { agentId: string; output: string };
      const agents = useAgentsStore.getState().agents;
      const agent = agents.find(a => a.id === data.agentId);
      if (agent) {
        updateAgent({
          ...agent,
          lastOutput: data.output,
          lastActivity: msg.timestamp || new Date().toISOString()
        });
      }
    });

    const unsubAgentComplete = wsClient.on('agent:complete', (msg) => {
      const data = msg.data as { agentId: string };
      removeAgent(data.agentId);
    });

    const unsubAgentStuck = wsClient.on('agent:stuck', (msg) => {
      const data = msg.data as { agentId: string; duration: number };
      const agents = useAgentsStore.getState().agents;
      const agent = agents.find(a => a.id === data.agentId);
      if (agent) {
        updateAgent({ ...agent, status: 'stuck' });
      }
      addToast({
        type: 'warning',
        message: `Agent stuck on story for ${Math.round(data.duration / 60)}m`
      });
    });

    // Project events
    const unsubProjectUpdate = wsClient.on('project:update', () => {
      // Re-fetch to get full updated data
      fetchProjects();
    });

    // Story verification events
    const unsubStoryVerified = wsClient.on('story:verified', (msg) => {
      const data = msg.data as { storyId: string; match: boolean };
      if (!data.match) {
        addToast({
          type: 'error',
          message: `Status mismatch on story ${data.storyId}`
        });
      }
    });

    // Re-sync on reconnection
    const unsubReconnected = wsClient.on('connection:established', () => {
      console.log('Re-syncing state after reconnection');
      fetchProjects();
      fetchAgents();
      addToast({
        type: 'success',
        message: 'Connection restored'
      });
    });

    // Cleanup
    return () => {
      unsubOpen();
      unsubReconnecting();
      unsubAgentSpawn();
      unsubAgentOutput();
      unsubAgentComplete();
      unsubAgentStuck();
      unsubProjectUpdate();
      unsubStoryVerified();
      unsubReconnected();
      wsClient.disconnect();
      isInitialized.current = false;
    };
  }, [token]);
}
```

### Orchestrator Integration

**Add to existing orchestrator events:**

In `src/claude-runner.js` or `src/story-worker.js`, emit WebSocket events:

```javascript
import { emitAgentSpawn, emitAgentOutput, emitAgentComplete } from './services/websocket.js';

// When spawning
const agent = createAgent(options);
emitAgentSpawn(agent);

// When receiving output
subprocess.stdout.on('data', (data) => {
  const output = data.toString().trim();
  emitAgentOutput(agent.id, output);
});

// When completing
subprocess.on('close', (code) => {
  emitAgentComplete(agent, code === 0 ? 'success' : 'failed');
});
```

### Project Structure Notes

- WebSocket server enhancement goes in existing server.js
- Broadcast service is new module for clean separation
- Frontend client uses singleton pattern
- useWebSocket hook wires everything to stores

### Dependencies on Other Stories

- **Requires Story 2.4**: agentsStore methods (addAgent, updateAgent, removeAgent)
- **Requires Story 2.2**: projectsStore fetchProjects
- **Requires Epic 1**: Auth system for JWT tokens
- **Used by all UI**: Real-time updates drive all displays

### Testing Requirements

**WebSocket Client Tests:**
```typescript
describe('WebSocketClient', () => {
  it('connects with token', () => {
    const client = new WebSocketClient();
    client.connect('test-token');
    expect(client.isConnected).toBe(true);
  });

  it('routes messages to handlers', () => {
    const handler = jest.fn();
    wsClient.on('agent:spawn', handler);

    // Simulate message
    const message = { type: 'agent:spawn', data: { agentId: '1' } };
    // Trigger via mock WebSocket

    expect(handler).toHaveBeenCalledWith(message);
  });

  it('implements exponential backoff', async () => {
    // Force disconnect
    // Verify reconnect delays: 1s, 2s, 4s, ...
  });
});
```

**Integration Tests:**
```typescript
describe('useWebSocket', () => {
  it('adds agent to store on spawn event', () => {
    renderHook(() => useWebSocket());

    // Simulate WebSocket message
    act(() => {
      wsClient.emit('agent:spawn', {
        agentId: 'new-1',
        projectId: 'proj-1',
        storyId: '2-3',
        storyTitle: 'Test'
      });
    });

    expect(useAgentsStore.getState().agents).toContainEqual(
      expect.objectContaining({ id: 'new-1' })
    );
  });

  it('re-fetches data on reconnection', async () => {
    const fetchProjects = jest.spyOn(useProjectsStore.getState(), 'fetchProjects');

    // Simulate reconnection
    act(() => {
      wsClient.emit('connection:established', {});
    });

    expect(fetchProjects).toHaveBeenCalled();
  });
});
```

### Performance Requirements

- UI updates within 500ms of event (NFR-P3)
- Reconnection should not cause data loss
- Message queuing during reconnection not required (re-sync handles)
- Connection should handle 10+ concurrent updates

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#API & Communication Patterns]
- [Source: _bmad-output/planning-artifacts/architecture.md#WebSocket Message Format]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.6]
- [Source: _bmad-output/project-context.md#WebSocket Message Format]
- [Source: src/server.js - existing WebSocket setup]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Code review conducted 2026-01-15

### Completion Notes List

- Backend WebSocket server enhanced with JWT authentication (AC #1)
- WebSocket broadcast service created with typed event emitters (AC #3)
- WebSocket emit functions integrated with agent lifecycle in claude-runner.js (AC #3)
- Tests added for broadcast service (12 tests passing)
- **Review Fix**: Added missing orchestrator integration - emitAgentSpawn/Output/Complete now called from registerAgent/updateAgentOutput/completeAgent

### Change Log

| Date | Change | By |
|------|--------|-----|
| 2026-01-15 | Code review: Fixed missing orchestrator integration | AI Review |
| 2026-01-15 | Code review: Fixed WS_CLOSE_INVALID_TOKEN to use distinct code (4002), updated File List to include src/config.js | AI Review |

### File List

**Modified:**
- `src/server.js` - WebSocket auth with JWT verification, connection tracking
- `src/claude-runner.js` - Added WebSocket emit calls to agent lifecycle functions
- `src/config.js` - Configuration updates for WebSocket support

**Created:**
- `src/services/websocket.js` - Broadcast service with typed event emitters
- `src/services/websocket.test.js` - Unit tests for broadcast service (12 tests)
