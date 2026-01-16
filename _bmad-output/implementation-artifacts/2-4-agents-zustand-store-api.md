# Story 2.4: Agents Zustand Store & API

Status: done

## Story

As a **system**,
I want **a Zustand store for agents state with REST API endpoints**,
So that **active Claude instances are tracked and displayed** (FR41).

## Acceptance Criteria

1. **Given** the dashboard loads, **When** the agentsStore initializes, **Then** it fetches agents from `GET /api/agents`
2. **Given** the agentsStore initializes, **Then** the store contains: agents array, isLoading boolean, error string
3. **Given** agents are running, **When** `GET /api/agents` is called, **Then** it returns all active Claude instances
4. **Given** the API response, **Then** each agent includes: id, projectId, storyId, status, startedAt, lastActivity, lastOutput
5. **Given** I want agents for a specific project, **When** `GET /api/agents?projectId=X` is called, **Then** only agents for that project are returned

## Tasks / Subtasks

- [x] Task 1: Create Agents API Route (AC: #3, #4, #5)
  - [x] Create `src/api/agents.js` with Express router
  - [x] Implement `GET /api/agents` - list all active agents
  - [x] Implement `GET /api/agents?projectId=X` - filter by project
  - [x] Implement `GET /api/agents/:id` - get single agent details
  - [x] Wire routes into `src/server.js`

- [x] Task 2: Implement Agent Data Service (AC: #3, #4)
  - [x] Create `src/services/agents.js` service layer
  - [x] Implement `getAllAgents()` - reads from orchestrator state
  - [x] Implement `getAgentsByProject(projectId)` - filtered list
  - [x] Implement `getAgentById(id)` - single agent details
  - [x] Transform internal Claude runner data to API format

- [x] Task 3: Create Agents Zustand Store (AC: #1, #2)
  - [x] Create `dashboard/src/stores/agentsStore.ts`
  - [x] Define AgentsState interface with agents, isLoading, error
  - [x] Implement `fetchAgents()` async action
  - [x] Implement `fetchAgentsByProject(projectId)` async action
  - [x] Implement `updateAgent(agent)` for WebSocket updates
  - [x] Implement `addAgent(agent)` for new agent spawns
  - [x] Implement `removeAgent(id)` for agent completion/termination

- [x] Task 4: Define TypeScript Types (AC: #4)
  - [x] Create `dashboard/src/types/agent.ts`
  - [x] Define Agent interface
  - [x] Define AgentStatus enum
  - [x] Export all types for store and components

- [x] Task 5: Integrate with Existing Claude Runner (AC: #3, #4)
  - [x] Review `src/claude-runner.js` to understand agent tracking
  - [x] Expose agent state through getter methods
  - [x] Ensure lastOutput captures truncated recent output
  - [x] Calculate duration from startedAt timestamp

### Review Follow-ups (AI)

- [ ] [AI-Review][LOW] Add @export JSDoc tags to exported functions in src/claude-runner.js for consistency
- [ ] [AI-Review][LOW] Make stuck threshold (30 minutes) configurable via config instead of hardcoded [src/services/agents.js:35-36]

## Dev Notes

### Architecture & File Locations

**Backend Files to Create:**
```
src/
├── api/
│   └── agents.js             # Agents API routes
└── services/
    └── agents.js             # Agent business logic
```

**Frontend Files to Create:**
```
dashboard/src/
├── stores/
│   └── agentsStore.ts        # Agents state
└── types/
    └── agent.ts              # Agent types
```

**Existing Files to Reference:**
- `src/claude-runner.js` - Contains Claude subprocess management
- `src/orchestrator.js` - Tracks active agents per project
- `src/story-worker.js` - Spawns agents for stories

### Technical Requirements

**API Response Format:**
```javascript
// GET /api/agents - List response
{
  data: [
    {
      id: "agent-1",
      projectId: "bmad-orchestrator",
      storyId: "2-3",
      storyTitle: "Project Cards Display",
      status: "running",           // running | stuck | completed | killed
      startedAt: "2026-01-15T12:00:00Z",
      lastActivity: "2026-01-15T12:05:30Z",
      lastOutput: "Implementing ProjectCard component...",
      duration: 330                // seconds since start
    },
    {
      id: "agent-2",
      projectId: "bmad-orchestrator",
      storyId: "2-4",
      storyTitle: "Agents Store & API",
      status: "running",
      startedAt: "2026-01-15T12:03:00Z",
      lastActivity: "2026-01-15T12:05:45Z",
      lastOutput: "Creating API endpoint...",
      duration: 165
    }
  ],
  meta: {
    total: 2,
    timestamp: "2026-01-15T12:06:00Z"
  }
}

// GET /api/agents/:id - Single agent
{
  data: {
    id: "agent-1",
    projectId: "bmad-orchestrator",
    storyId: "2-3",
    storyTitle: "Project Cards Display",
    status: "running",
    startedAt: "2026-01-15T12:00:00Z",
    lastActivity: "2026-01-15T12:05:30Z",
    lastOutput: "Implementing ProjectCard component...",
    duration: 330,
    outputHistory: [
      "Starting story implementation...",
      "Creating ProjectCard.tsx...",
      "Implementing ProjectCard component..."
    ]
  },
  meta: { timestamp: "2026-01-15T12:06:00Z" }
}
```

### Implementation Patterns

**Backend API Route:**
```javascript
// src/api/agents.js
import express from 'express';
import { getAllAgents, getAgentsByProject, getAgentById } from '../services/agents.js';
import { authMiddleware } from '../auth/middleware.js';

const router = express.Router();

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// GET /api/agents
router.get('/', authMiddleware, asyncHandler(async (req, res) => {
  const { projectId } = req.query;

  const agents = projectId
    ? await getAgentsByProject(projectId)
    : await getAllAgents();

  res.json({
    data: agents,
    meta: { total: agents.length, timestamp: new Date().toISOString() }
  });
}));

// GET /api/agents/:id
router.get('/:id', authMiddleware, asyncHandler(async (req, res) => {
  const agent = await getAgentById(req.params.id);
  if (!agent) {
    return res.status(404).json({
      error: 'Agent not found',
      code: 'AGENT_NOT_FOUND'
    });
  }
  res.json({
    data: agent,
    meta: { timestamp: new Date().toISOString() }
  });
}));

export default router;
```

**Agent Service (integrating with existing code):**
```javascript
// src/services/agents.js
import { claudeRunner } from '../claude-runner.js';

export async function getAllAgents() {
  // Get all active Claude processes from the runner
  const activeProcesses = claudeRunner.getActiveProcesses();

  return activeProcesses.map(formatAgentData);
}

export async function getAgentsByProject(projectId) {
  const allAgents = await getAllAgents();
  return allAgents.filter(agent => agent.projectId === projectId);
}

export async function getAgentById(id) {
  const activeProcesses = claudeRunner.getActiveProcesses();
  const process = activeProcesses.find(p => p.id === id);

  if (!process) return null;

  return {
    ...formatAgentData(process),
    outputHistory: process.outputHistory || []
  };
}

function formatAgentData(process) {
  const now = Date.now();
  const startTime = new Date(process.startedAt).getTime();

  return {
    id: process.id,
    projectId: process.projectId,
    storyId: process.storyId,
    storyTitle: process.storyTitle || `Story ${process.storyId}`,
    status: deriveAgentStatus(process),
    startedAt: process.startedAt,
    lastActivity: process.lastActivity || process.startedAt,
    lastOutput: truncateOutput(process.lastOutput, 100),
    duration: Math.floor((now - startTime) / 1000)
  };
}

function deriveAgentStatus(process) {
  if (process.killed) return 'killed';
  if (process.completed) return 'completed';

  // Check for stuck (no activity for 30 minutes)
  const inactiveMs = Date.now() - new Date(process.lastActivity).getTime();
  if (inactiveMs > 30 * 60 * 1000) return 'stuck';

  return 'running';
}

function truncateOutput(output, maxLength) {
  if (!output) return '';
  return output.length > maxLength
    ? output.substring(0, maxLength) + '...'
    : output;
}
```

**Frontend Zustand Store:**
```typescript
// dashboard/src/stores/agentsStore.ts
import { create } from 'zustand';
import { api } from '../services/api';
import type { Agent } from '../types/agent';

interface AgentsState {
  agents: Agent[];
  isLoading: boolean;
  error: string | null;

  fetchAgents: () => Promise<void>;
  fetchAgentsByProject: (projectId: string) => Promise<void>;
  updateAgent: (agent: Agent) => void;
  addAgent: (agent: Agent) => void;
  removeAgent: (id: string) => void;
  clearError: () => void;
}

export const useAgentsStore = create<AgentsState>((set, get) => ({
  agents: [],
  isLoading: false,
  error: null,

  fetchAgents: async () => {
    try {
      set({ isLoading: true, error: null });
      const response = await api.get<{ data: Agent[] }>('/api/agents');
      set({ agents: response.data, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch agents',
        isLoading: false
      });
    }
  },

  fetchAgentsByProject: async (projectId: string) => {
    try {
      set({ isLoading: true, error: null });
      const response = await api.get<{ data: Agent[] }>(`/api/agents?projectId=${projectId}`);
      set({ agents: response.data, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch agents',
        isLoading: false
      });
    }
  },

  updateAgent: (updatedAgent: Agent) => {
    set((state) => ({
      agents: state.agents.map((agent) =>
        agent.id === updatedAgent.id ? updatedAgent : agent
      )
    }));
  },

  addAgent: (newAgent: Agent) => {
    set((state) => ({
      agents: [...state.agents, newAgent]
    }));
  },

  removeAgent: (id: string) => {
    set((state) => ({
      agents: state.agents.filter((agent) => agent.id !== id)
    }));
  },

  clearError: () => set({ error: null })
}));
```

**TypeScript Types:**
```typescript
// dashboard/src/types/agent.ts
export type AgentStatus = 'running' | 'stuck' | 'completed' | 'killed';

export interface Agent {
  id: string;
  projectId: string;
  storyId: string;
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
```

### Integration with Existing Code

**Claude Runner Integration:**

The `src/claude-runner.js` already manages subprocess spawning. You need to:

1. Add tracking of active processes in an array/map
2. Store lastOutput from stdout/stderr streams
3. Track lastActivity timestamp on each output
4. Expose getter methods for the agents service

```javascript
// Modifications needed in src/claude-runner.js

// Add to module scope
const activeProcesses = new Map();

// When spawning a process
function spawnClaude(options) {
  const id = `agent-${Date.now()}`;
  const process = {
    id,
    projectId: options.projectId,
    storyId: options.storyId,
    storyTitle: options.storyTitle,
    startedAt: new Date().toISOString(),
    lastActivity: new Date().toISOString(),
    lastOutput: '',
    outputHistory: [],
    subprocess: null // actual subprocess reference
  };

  activeProcesses.set(id, process);
  // ... rest of spawn logic
}

// Update on output
subprocess.stdout.on('data', (data) => {
  const output = data.toString().trim();
  process.lastOutput = output;
  process.lastActivity = new Date().toISOString();
  process.outputHistory.push(output);
  // Keep only last 100 lines
  if (process.outputHistory.length > 100) {
    process.outputHistory.shift();
  }
});

// Export getter
export function getActiveProcesses() {
  return Array.from(activeProcesses.values())
    .filter(p => !p.completed && !p.killed);
}
```

### Project Structure Notes

- Agents API follows same pattern as Projects API
- Service layer abstracts claude-runner internals
- Frontend store methods mirror WebSocket events (add, update, remove)
- Duration calculated dynamically from startedAt

### Dependencies on Other Stories

- **Requires**: Auth system from Epic 1 (for middleware)
- **Used by Story 2.1**: Header displays agent count
- **Used by Story 2.5**: Agent Activity Panel displays agent list
- **Used by Story 2.6**: WebSocket updates agent state

### Testing Requirements

**Backend Tests:**
```javascript
describe('GET /api/agents', () => {
  it('returns all active agents', async () => {
    const response = await request(app)
      .get('/api/agents')
      .set('Cookie', authCookie);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  it('filters by projectId', async () => {
    const response = await request(app)
      .get('/api/agents?projectId=test-project')
      .set('Cookie', authCookie);

    expect(response.body.data.every(a => a.projectId === 'test-project')).toBe(true);
  });
});
```

**Frontend Tests:**
```typescript
describe('agentsStore', () => {
  it('adds new agent to store', () => {
    const store = useAgentsStore.getState();
    const newAgent: Agent = {
      id: 'test-1',
      projectId: 'proj-1',
      storyId: '2-3',
      storyTitle: 'Test Story',
      status: 'running',
      startedAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      lastOutput: 'Working...',
      duration: 0
    };

    store.addAgent(newAgent);
    expect(useAgentsStore.getState().agents).toContainEqual(newAgent);
  });

  it('removes agent by id', () => {
    const store = useAgentsStore.getState();
    store.removeAgent('test-1');
    expect(useAgentsStore.getState().agents.find(a => a.id === 'test-1')).toBeUndefined();
  });
});
```

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#API & Communication Patterns]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.4]
- [Source: src/claude-runner.js - existing subprocess management]
- [Source: _bmad-output/project-context.md#Error Handling Pattern]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None - implementation completed without errors.

### Completion Notes List

- Implemented complete agent tracking system in claude-runner.js with:
  - `registerAgent()` - creates and tracks new agents
  - `updateAgentOutput()` - updates agent output and activity timestamps
  - `completeAgent()` / `killAgent()` - agent lifecycle management
  - `getActiveAgents()` / `getAllAgents()` / `getAgentById()` / `getAgentsByProject()` - query functions
  - `cleanupOldAgents()` - cleanup of old completed/killed agents
- Created agents service layer (src/services/agents.js) with:
  - Data formatting/transformation for API responses
  - Duration calculation from startedAt timestamp
  - Status derivation (running/stuck/completed/killed/failed)
  - Output truncation to 100 chars for list view
- Created REST API endpoints (src/api/agents.js):
  - GET /api/agents - list all active agents
  - GET /api/agents?projectId=X - filter by project
  - GET /api/agents/:id - single agent with output history
- Wired agents router into src/server.js
- Updated TypeScript types (dashboard/src/types/agent.ts):
  - Added 'failed' status to AgentStatus type
  - Made storyId nullable (string | null)
- Created agentsStore.ts with Zustand pattern following architecture spec
- All tests pass (128 tests across 15 test files)

### File List

**Created:**
- src/api/agents.js
- src/api/agents.test.js
- src/services/agents.js
- src/services/agents.test.js
- dashboard/src/stores/agentsStore.ts
- dashboard/src/stores/agentsStore.test.ts

**Modified:**
- src/claude-runner.js (added agent tracking functions, integrated with runClaude)
- src/server.js (added agents router)
- dashboard/src/types/agent.ts (added 'failed' status, made storyId nullable)

### Change Log

- 2026-01-15: Implemented agents API and Zustand store for tracking active Claude instances
- 2026-01-15: Code review - Fixed 6 issues (2 HIGH, 4 MEDIUM), created 2 LOW action items
