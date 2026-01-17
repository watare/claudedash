# Story 4.6: Stuck Agent Detection & Alerts

Status: done

## Story

As a **system**,
I want **to detect when an agent is stuck and alert the user**,
So that **problems are surfaced before wasting too much time** (FR7 enhancement).

## Acceptance Criteria

**AC1: Stuck Detection**
**Given** an agent has been running
**When** no output is received for the stuck threshold (configurable, default 30 minutes)
**Then** the agent is marked as "stuck"
**And** the stuckAt timestamp is recorded

**AC2: WebSocket Broadcast**
**Given** an agent becomes stuck
**When** the status changes
**Then** a WebSocket event broadcasts `{ type: "agent:stuck", data: { agentId, duration } }`
**And** the UI shows a warning indicator on that agent

**AC3: Dashboard Warning UI**
**Given** an agent is marked as stuck
**When** the agent panel renders
**Then** a yellow/red warning indicator is shown
**And** [Kill] and [View Logs] buttons become prominent
**And** text shows "Stuck for Xh Xm"

**AC4: Configurable Threshold**
**Given** the system configuration
**When** stuck detection runs
**Then** it uses the configurable `stuckThresholdMinutes` value (default: 30)

## Tasks / Subtasks

- [x] Task 1: Implement stuck detection service (AC: 1, 4)
  - [x] 1.1: Create `src/services/stuckDetector.js`
  - [x] 1.2: Track lastActivity timestamp per agent in agentRegistry
  - [x] 1.3: Implement interval-based check (every 1 minute)
  - [x] 1.4: Mark agents as stuck when inactive > threshold
- [x] Task 2: Update agentRegistry with activity tracking (AC: 1)
  - [x] 2.1: Add `lastActivity` field to agent metadata
  - [x] 2.2: Add `stuckAt` field (null if not stuck)
  - [x] 2.3: Add `updateActivity(agentId)` method
  - [x] 2.4: Add `markStuck(agentId)` method
- [x] Task 3: Integrate with claude-runner output (AC: 1)
  - [x] 3.1: On stdout/stderr output, call `updateActivity(agentId)`
  - [x] 3.2: Parse output events from execa process
- [x] Task 4: Implement WebSocket broadcast (AC: 2)
  - [x] 4.1: Broadcast `agent:stuck` event when detected
  - [x] 4.2: Include agentId, storyId, duration in message
- [x] Task 5: Add configuration option (AC: 4)
  - [x] 5.1: Add `stuckThresholdMinutes` to config.js (default: 30)
  - [x] 5.2: Support environment variable override
- [x] Task 6: Create StuckAgentIndicator component (AC: 3)
  - [x] 6.1: Create `dashboard/src/components/agents/StuckAgentIndicator.tsx`
  - [x] 6.2: Show warning icon with duration text
  - [x] 6.3: Use yellow for warning (30-60min), red for critical (>60min)
- [x] Task 7: Update AgentPanel for stuck state (AC: 3)
  - [x] 7.1: Detect stuck agents from store
  - [x] 7.2: Show StuckAgentIndicator for stuck agents
  - [x] 7.3: Make [Kill] and [View Logs] buttons prominent (larger, colored)
- [x] Task 8: Handle stuck state in agentsStore (AC: 2, 3)
  - [x] 8.1: Add `stuckAt` field to Agent type
  - [x] 8.2: Handle `agent:stuck` WebSocket event
  - [x] 8.3: Add selector for stuck agents
- [x] Task 9: Write tests
  - [x] 9.1: Test stuck detection timing
  - [x] 9.2: Test activity update resets stuck timer
  - [x] 9.3: Test UI warning display

## Dev Notes

### Architecture Compliance

**Backend File Structure:**
```
src/
├── services/
│   ├── stuckDetector.js    # NEW: Stuck detection service
│   └── agentRegistry.js    # MODIFY: Add activity tracking
└── config.js               # MODIFY: Add stuckThresholdMinutes
```

**Frontend File Structure:**
```
dashboard/src/
├── components/
│   └── agents/
│       ├── StuckAgentIndicator.tsx  # NEW
│       └── AgentPanel.tsx           # MODIFY
└── stores/
    └── agentsStore.ts               # MODIFY
```

### Stuck Detection Service

**stuckDetector.js:**
```javascript
import { getAllAgents, markStuck, getAgent } from './agentRegistry.js';
import { loadConfig } from '../config.js';

let checkInterval = null;
let broadcastFn = null;

export function startStuckDetection(config, broadcast) {
  broadcastFn = broadcast;
  const thresholdMs = (config.stuckThresholdMinutes || 30) * 60 * 1000;

  // Check every minute
  checkInterval = setInterval(() => {
    checkForStuckAgents(thresholdMs);
  }, 60 * 1000);

  console.log(`Stuck detection started (threshold: ${config.stuckThresholdMinutes || 30}min)`);
}

export function stopStuckDetection() {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
}

function checkForStuckAgents(thresholdMs) {
  const now = Date.now();
  const agents = getAllAgents();

  for (const [agentId, agent] of agents) {
    // Skip already stuck or completed agents
    if (agent.stuckAt || agent.status === 'completed' || agent.status === 'killed') {
      continue;
    }

    const lastActivityTime = agent.lastActivity
      ? new Date(agent.lastActivity).getTime()
      : agent.startedAt ? new Date(agent.startedAt).getTime() : now;

    const inactiveMs = now - lastActivityTime;

    if (inactiveMs > thresholdMs) {
      markStuck(agentId);

      const durationMinutes = Math.floor(inactiveMs / 60000);

      // Broadcast stuck event
      if (broadcastFn) {
        broadcastFn({
          type: 'agent:stuck',
          data: {
            agentId,
            storyId: agent.storyId,
            duration: formatDuration(inactiveMs),
            durationMinutes,
          },
          timestamp: new Date().toISOString(),
        });
      }

      console.log(`Agent ${agentId} marked as stuck (inactive for ${durationMinutes}min)`);
    }
  }
}

function formatDuration(ms) {
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}
```

### AgentRegistry Updates

**agentRegistry.js additions:**
```javascript
// Agent metadata structure
interface AgentMetadata {
  id: string;
  pid: number;
  process: ChildProcess;
  storyId: string;
  projectId: string;
  startedAt: string;
  lastActivity: string;  // NEW
  stuckAt: string | null; // NEW
  status: 'running' | 'completed' | 'failed' | 'killed' | 'stuck';
}

export function updateActivity(agentId) {
  const agent = agents.get(agentId);
  if (agent) {
    agent.lastActivity = new Date().toISOString();
    // If was stuck, un-stick it
    if (agent.stuckAt) {
      agent.stuckAt = null;
      agent.status = 'running';
    }
    agents.set(agentId, agent);
  }
}

export function markStuck(agentId) {
  const agent = agents.get(agentId);
  if (agent && !agent.stuckAt) {
    agent.stuckAt = new Date().toISOString();
    agent.status = 'stuck';
    agents.set(agentId, agent);
  }
}
```

### Integration with Claude Runner

**claude-runner.js modification:**
```javascript
import { updateActivity } from './services/agentRegistry.js';

export async function runClaude(prompt, options = {}) {
  const agentId = options.agentId; // Pass this from caller

  const result = await execa(command, args, {
    cwd,
    timeout,
    reject: false,
    all: true,
    // Stream output to track activity
    stdout: 'pipe',
    stderr: 'pipe',
  });

  // If using streaming, update activity on each chunk
  if (agentId && result.stdout) {
    result.stdout.on('data', () => {
      updateActivity(agentId);
    });
  }

  // ... rest of implementation
}
```

### Config Addition

**config.js:**
```javascript
const defaults = {
  // ... existing defaults
  stuckThresholdMinutes: 30, // Minutes without output before marking as stuck
};
```

### Frontend Components

**StuckAgentIndicator.tsx:**
```tsx
import { AlertTriangle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StuckAgentIndicatorProps {
  stuckAt: string;
  className?: string;
}

export function StuckAgentIndicator({ stuckAt, className }: StuckAgentIndicatorProps) {
  const stuckTime = new Date(stuckAt).getTime();
  const now = Date.now();
  const durationMs = now - stuckTime;
  const durationMinutes = Math.floor(durationMs / 60000);

  // Yellow for 30-60min, red for >60min
  const isWarning = durationMinutes < 60;
  const colorClass = isWarning ? 'text-yellow-500' : 'text-red-500';
  const bgClass = isWarning ? 'bg-yellow-500/10' : 'bg-red-500/10';

  const formatDuration = (mins: number) => {
    const hours = Math.floor(mins / 60);
    const minutes = mins % 60;
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  return (
    <div className={cn('flex items-center gap-2 px-2 py-1 rounded', bgClass, className)}>
      <AlertTriangle className={cn('h-4 w-4', colorClass)} />
      <span className={cn('text-sm font-medium', colorClass)}>
        Stuck for {formatDuration(durationMinutes)}
      </span>
    </div>
  );
}
```

**AgentPanel.tsx modifications:**
```tsx
import { StuckAgentIndicator } from './StuckAgentIndicator';

function AgentRow({ agent }: { agent: Agent }) {
  const isStuck = agent.stuckAt !== null;

  return (
    <div className={cn('flex items-center justify-between p-3 rounded', isStuck && 'border border-yellow-500/50')}>
      <div className="flex items-center gap-3">
        {/* Status indicator */}
        <div className={cn(
          'w-2 h-2 rounded-full',
          isStuck ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'
        )} />

        {/* Agent info */}
        <div>
          <span className="font-medium">Agent {agent.id}</span>
          <span className="text-gray-400 text-sm ml-2">Story {agent.storyId}</span>
        </div>

        {/* Stuck indicator */}
        {isStuck && <StuckAgentIndicator stuckAt={agent.stuckAt!} />}
      </div>

      {/* Action buttons - prominent when stuck */}
      <div className="flex items-center gap-2">
        {isStuck && (
          <>
            <Button
              variant="destructive"
              size="sm"
              className="bg-red-600 hover:bg-red-700"
            >
              Kill
            </Button>
            <Button variant="secondary" size="sm">
              View Logs
            </Button>
          </>
        )}
        {!isStuck && (
          <>
            <Button variant="ghost" size="sm">Kill</Button>
            <Button variant="ghost" size="sm">Logs</Button>
          </>
        )}
      </div>
    </div>
  );
}
```

### Zustand Store Updates

**agentsStore.ts:**
```typescript
interface Agent {
  id: string;
  storyId: string;
  projectId: string;
  status: 'running' | 'completed' | 'failed' | 'killed' | 'stuck';
  startedAt: string;
  lastActivity: string;
  stuckAt: string | null;  // NEW
}

// Handle stuck event
case 'agent:stuck':
  set((state) => ({
    agents: state.agents.map((a) =>
      a.id === message.data.agentId
        ? { ...a, stuckAt: message.timestamp, status: 'stuck' }
        : a
    ),
  }));
  break;

// Selector for stuck agents
export const useStuckAgents = () =>
  useAgentsStore((state) => state.agents.filter((a) => a.stuckAt !== null));
```

### WebSocket Message Format

```typescript
// agent:stuck event
{
  type: 'agent:stuck',
  data: {
    agentId: 'agent-4-3-1705312800',
    storyId: '4-3',
    duration: '45m',
    durationMinutes: 45,
  },
  timestamp: '2026-01-15T12:45:00Z'
}
```

### Server Integration

**server.js addition:**
```javascript
import { startStuckDetection } from './services/stuckDetector.js';

// In DashboardServer constructor or start method
startStuckDetection(this.config, (msg) => this.broadcast(msg));
```

### UI Color Mapping (from UX Design)

| Duration | Color | Indicator |
|----------|-------|-----------|
| 30-60 min | Yellow (`#FCD535`) | Warning triangle |
| >60 min | Red (`#F6465D`) | Warning triangle, pulsing |

### Anti-Patterns to Avoid

1. **DO NOT** check stuck status on every request (use interval)
2. **DO NOT** mark agent as stuck if it just hasn't started outputting yet
3. **DO NOT** forget to clear stuck interval on server shutdown
4. **DO NOT** show stuck indicator for completed/killed agents

### References

- [Source: ux-design-specification.md#Agent-Activity-Panel] - Stuck indicator specs
- [Source: epics.md#FR7] - Stuck instance detection requirement
- [Source: src/claude-runner.js] - Output handling pattern
- [Source: Story 4.1] - agentRegistry pattern

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- All tests passing: 356 backend tests, 496 frontend tests

### Completion Notes List

- Created stuckDetector.js service with interval-based checking (every 1 minute)
- Added stuckAt field and markStuck/getStuckAgents functions to agentRegistry
- Integrated activity tracking with claude-runner's updateAgentOutput function
- Added stuckThresholdMinutes configuration option (default: 30 minutes)
- Created StuckAgentIndicator component with yellow/red color scheme based on duration
- Updated AgentRow to show StuckAgentIndicator and prominent buttons when stuck
- Updated useWebSocket hook to handle agent:stuck events and set stuckAt timestamp
- Added useStuckAgents selector to agentsStore
- Updated KillButton to support prominent mode for stuck agents
- Updated Agent type with stuckAt field
- All acceptance criteria satisfied

### File List

**New Files:**
- src/services/stuckDetector.js
- src/services/stuckDetector.test.js
- dashboard/src/components/agents/StuckAgentIndicator.tsx
- dashboard/src/components/agents/StuckAgentIndicator.test.tsx

**Modified Files:**
- src/services/agentRegistry.js - Added stuckAt field, markStuck(), getStuckAgents(), updated updateAgentActivity() to unstick agents
- src/services/agentRegistry.test.js - Added tests for stuck functionality
- src/services/websocket.js - Updated emitAgentStuck() signature for Story 4.6 format
- src/services/websocket.test.js - Updated emitAgentStuck test
- src/config.js - Added stuckThresholdMinutes configuration
- src/server.js - Integrated stuck detection service startup
- src/claude-runner.js - Added updateAgentActivity call on output
- dashboard/src/types/agent.ts - Added stuckAt field to Agent interface
- dashboard/src/hooks/useWebSocket.ts - Updated agent:stuck handler and AgentStuckPayload
- dashboard/src/stores/agentsStore.ts - Added useStuckAgents selector
- dashboard/src/components/agents/AgentRow.tsx - Added StuckAgentIndicator display and prominent buttons
- dashboard/src/components/agents/AgentRow.test.tsx - Added stuckAt to mock agent
- dashboard/src/components/agents/KillButton.tsx - Added prominent prop for stuck state

## Senior Developer Review (AI)

**Reviewer:** Claude Opus 4.5
**Date:** 2026-01-17
**Outcome:** ✅ **APPROVED** (with fixes applied)

### Summary

All acceptance criteria validated against implementation. 4 Medium issues identified and fixed. 3 Low issues documented as action items for future cleanup.

### Medium Issues Fixed

1. **M1: emitAgentStuck unused** - stuckDetector.js now imports and uses `emitAgentStuck` from websocket.js for consistency with other agent events.

2. **M2: Frontend threshold mismatch** - Synced frontend STUCK_THRESHOLD to 30 minutes (was 45) to match backend config.stuckThresholdMinutes. Warning threshold set to 25 minutes.

3. **M3: Missing broadcast test** - Added tests for WebSocket broadcast in stuckDetector.test.js verifying correct payload format.

4. **M4: StuckAgentIndicator static duration** - Added useEffect interval to auto-update duration display every minute.

### Low Issues (Action Items)

- [ ] **L1:** Remove unused `updateAgentActivity` import from stuckDetector.js
- [ ] **L2:** Add JSDoc for internal `checkForStuckAgents` function
- [ ] **L3:** Add explicit StuckAgentIndicator render test when `stuckAt` is set in AgentRow.test.tsx

### Test Results

- Backend: 358 tests passed
- Frontend: 523 tests passed

## Change Log

- 2026-01-17: Code review fixes applied (M1-M4) - threshold sync, broadcast consistency, auto-update
- 2026-01-17: Implemented Story 4.6 - Stuck Agent Detection & Alerts (all ACs satisfied)
