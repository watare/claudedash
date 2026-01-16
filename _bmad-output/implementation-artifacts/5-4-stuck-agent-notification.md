# Story 5.4: Stuck Agent Notification

Status: ready-for-dev

## Story

As a **user**,
I want **to be notified when an agent is stuck**,
So that **I can kill and retry before wasting hours** (FR48).

## Acceptance Criteria

1. **Given** an agent is detected as stuck
   **When** the stuck event fires
   **Then** a red toast appears: "Agent stuck on Story X.Y for Zh Zm"
   **And** the toast has [Kill] and [View Logs] action buttons

2. **Given** webhook is configured
   **When** agent is stuck
   **Then** webhook is called with: agentId, storyId, duration, project

3. **Given** Slack is configured
   **When** agent is stuck
   **Then** Slack message says: ":warning: Agent stuck: [Project] Story X.Y - no activity for Zh Zm"

4. **Given** a stuck notification is shown
   **When** I click [Kill]
   **Then** the agent is terminated
   **And** the notification updates to show "Agent killed"
   **And** a [Retry] button appears

5. **Given** a stuck notification is shown
   **When** I click [View Logs]
   **Then** the log viewer panel opens for that agent
   **And** the notification remains visible

## Tasks / Subtasks

- [ ] Task 1: Implement stuck detection in orchestrator (AC: #1)
  - [ ] Configure stuck threshold (default: 30 minutes, from config)
  - [ ] Track last activity timestamp for each agent
  - [ ] Create periodic check (every 5 minutes) for stuck agents
  - [ ] Emit `agent:stuck` event when threshold exceeded
  - [ ] Include stuck duration in event data

- [ ] Task 2: Add stuck notification to notification service (AC: #2, #3)
  - [ ] Create `notifyAgentStuck(data)` method
  - [ ] Format webhook payload:
    ```json
    {
      "type": "AGENT_STUCK",
      "agentId": "agent-123",
      "project": "project-name",
      "story": "2-3-story-name",
      "duration": "2h 15m",
      "durationMs": 8100000,
      "lastActivity": "2026-01-15T10:00:00Z",
      "timestamp": "2026-01-15T12:15:00Z"
    }
    ```
  - [ ] Format Slack message with warning emoji
  - [ ] Broadcast WebSocket `notification:new` event

- [ ] Task 3: Create StuckAgentToast component (AC: #1)
  - [ ] Extend base Toast with stuck-specific styling (red background)
  - [ ] Display: "Agent stuck on Story X.Y for Zh Zm"
  - [ ] Include AlertTriangle icon from lucide-react
  - [ ] Add [Kill] button (destructive style)
  - [ ] Add [View Logs] button (secondary style)

- [ ] Task 4: Connect toast actions to API (AC: #4, #5)
  - [ ] [Kill] button calls `POST /api/agents/:id/kill`
  - [ ] On kill success, update toast to show "Agent killed"
  - [ ] Replace action buttons with [Retry] button
  - [ ] [View Logs] button opens log viewer panel
  - [ ] Pass agentId to log viewer component

- [ ] Task 5: Implement kill confirmation for stuck agents (AC: #4)
  - [ ] Show brief confirmation dialog before kill
  - [ ] Include agent info and story reference
  - [ ] Skip confirmation if user has "skip confirmations" preference
  - [ ] Handle kill API errors with error toast

- [ ] Task 6: Update agent store with stuck state (AC: #1)
  - [ ] Add `stuckSince` property to agent type
  - [ ] Update agentsStore when stuck event received
  - [ ] Calculate human-readable duration in component
  - [ ] Clear stuck state when agent is killed or resumes

- [ ] Task 7: Add stuck indicator to AgentPanel (AC: #1)
  - [ ] Show yellow/red warning indicator for stuck agents
  - [ ] Display stuck duration in agent row
  - [ ] Highlight stuck agents visually in the list
  - [ ] Sort stuck agents to top of list

- [ ] Task 8: Write tests
  - [ ] Test stuck detection timing logic
  - [ ] Test notification service stuck method
  - [ ] Test webhook and Slack payload formats
  - [ ] Test StuckAgentToast component
  - [ ] Test kill action flow

## Dev Notes

### Critical Implementation Rules

1. **ES Modules Only** - Use `import/export` syntax
2. **No Blocking Operations** - Stuck check should be non-blocking
3. **WebSocket Format** - Follow `{ type: 'entity:action', data: {...} }` pattern

### Stuck Detection Logic

```javascript
// src/orchestrator.js or src/services/stuck-detector.js

const STUCK_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes default
const CHECK_INTERVAL_MS = 5 * 60 * 1000;   // Check every 5 minutes

class StuckDetector {
  constructor(notificationService, config) {
    this.threshold = config.stuckThreshold || STUCK_THRESHOLD_MS;
    this.notificationService = notificationService;
    this.agents = new Map(); // agentId -> { lastActivity, stuckNotified }
  }

  updateActivity(agentId, timestamp = Date.now()) {
    const agent = this.agents.get(agentId) || { stuckNotified: false };
    agent.lastActivity = timestamp;
    agent.stuckNotified = false; // Reset on new activity
    this.agents.set(agentId, agent);
  }

  checkForStuckAgents() {
    const now = Date.now();
    for (const [agentId, data] of this.agents) {
      const idleTime = now - data.lastActivity;
      if (idleTime > this.threshold && !data.stuckNotified) {
        this.notificationService.notifyAgentStuck({
          agentId,
          duration: this.formatDuration(idleTime),
          durationMs: idleTime,
          lastActivity: new Date(data.lastActivity).toISOString()
        });
        data.stuckNotified = true;
      }
    }
  }

  formatDuration(ms) {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }
}
```

### Webhook Payload Schema

```typescript
interface StuckAgentWebhookPayload {
  type: 'AGENT_STUCK';
  agentId: string;
  project: string;
  story: string;
  duration: string;      // Human-readable: "2h 15m"
  durationMs: number;    // Milliseconds for programmatic use
  lastActivity: string;  // ISO timestamp of last output
  timestamp: string;     // When stuck was detected
  dashboardUrl: string;
}
```

### Slack Message Format

```
:warning: *Agent Stuck*

*Project:* bmad-orchestrator
*Story:* 2-3-oauth-implementation
*Agent:* agent-abc123
*Idle for:* 2h 15m

No output since 10:00 AM

<https://claudedash.padaw.ovh/projects/bmad-orchestrator|Kill Agent> | <https://claudedash.padaw.ovh/logs/agent-abc123|View Logs>
```

### Toast Component

```typescript
// StuckAgentToast actions
const actions: NotificationAction[] = [
  {
    label: 'Kill',
    action: 'kill',
    variant: 'destructive',
    handler: async () => {
      await api.post(`/api/agents/${agentId}/kill`);
    }
  },
  {
    label: 'View Logs',
    action: 'view-logs',
    variant: 'secondary',
    handler: () => {
      openLogViewer(agentId);
    }
  }
];
```

### Duration Formatting Utility

```typescript
// dashboard/src/utils/formatters.ts
export function formatDuration(ms: number): string {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}
```

### Configuration

```yaml
# bmad-orchestrator.secrets.yaml or config
orchestrator:
  stuckThresholdMinutes: 30  # When to consider agent stuck
  stuckCheckIntervalMinutes: 5  # How often to check
```

### File Structure

```
src/
├── services/
│   ├── notification.js       # Add notifyAgentStuck() method
│   └── stuck-detector.js     # NEW: Stuck detection service

dashboard/src/
├── components/
│   └── ui/
│       └── Toast.tsx         # Extend for stuck-specific actions
└── utils/
    └── formatters.ts         # Add formatDuration utility
```

### References

- [Source: epics.md#Story 5.4] - Original requirements
- [Source: epics.md#Story 4.6] - Stuck agent detection (related)
- [Source: ux-design-specification.md#Agent Activity Panel] - Stuck indicator UI
- [Source: architecture.md#API Endpoints Structure] - Kill agent endpoint

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

