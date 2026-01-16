# Story 2.5: Agent Activity Panel

Status: done

## Story

As a **user**,
I want **to see active agents with their current activity and duration**,
So that **I know what Claude instances are working on** (FR41).

## Acceptance Criteria

1. **Given** I am viewing a project, **When** agents are active for that project, **Then** an Agent Activity Panel shows all agents
2. **Given** agents are displayed, **Then** each agent row shows: pulsing indicator, agent ID, story reference, duration (e.g., "Running 5m")
3. **Given** an agent is displayed, **Then** last activity text shows truncated last output line (not full log)
4. **Given** an agent has been running longer than threshold (configurable, default 45min), **When** the panel renders, **Then** the agent shows a yellow/red warning indicator
5. **Given** an agent is showing a warning, **Then** [Kill] and [View Logs] buttons appear for that agent

## Tasks / Subtasks

- [x] Task 1: Create AgentPanel Component (AC: #1)
  - [x] Create `dashboard/src/components/agents/AgentPanel.tsx`
  - [x] Implement panel layout with header showing agent count
  - [x] Render list of AgentRow components
  - [x] Handle empty state ("All agents idle")
  - [x] Create co-located test file `AgentPanel.test.tsx`

- [x] Task 2: Create AgentRow Component (AC: #2, #3)
  - [x] Create `dashboard/src/components/agents/AgentRow.tsx`
  - [x] Display pulsing status indicator
  - [x] Show agent ID and story reference
  - [x] Display duration in human-readable format ("5m", "1h 23m")
  - [x] Show truncated last output (max 60 chars)

- [x] Task 3: Implement Stuck Agent Warning (AC: #4)
  - [x] Check agent duration against stuck threshold (45min default)
  - [x] Change indicator to yellow (>30min) or red (>45min)
  - [x] Add warning icon next to stuck agents
  - [x] Threshold should be configurable via environment or settings

- [x] Task 4: Add Action Buttons for Stuck Agents (AC: #5)
  - [x] Conditionally render [Kill] and [View Logs] buttons
  - [x] Style [Kill] button in destructive red
  - [x] Wire [Kill] to placeholder function (Epic 4 implements)
  - [x] Wire [View Logs] to open log viewer panel (Story 4.5)

- [x] Task 5: Create Duration Formatting Utility (AC: #2)
  - [x] Create `dashboard/src/utils/formatters.ts` if not exists
  - [x] Implement `formatDuration(seconds)` function
  - [x] Return "Xm" for minutes, "Xh Xm" for hours
  - [x] Update duration display in real-time (every second)

- [x] Task 6: Integrate Panel into Layout (AC: #1)
  - [x] Add AgentPanel to sidebar or as collapsible section
  - [x] Show panel when viewing specific project
  - [x] Filter agents by current project context
  - [x] Add panel toggle in UI store

### Review Follow-ups (AI)

- [x] [AI-Review][HIGH] Implement WebSocket integration for real-time agent updates - Connected useWebSocket hook to Layout for agent:spawn, agent:output, agent:complete, agent:stuck events [dashboard/src/components/layout/Layout.tsx]
- [ ] [AI-Review][LOW] Add unit test for timer interval updating duration in real-time [dashboard/src/components/agents/AgentRow.test.tsx] (optional enhancement)

## Dev Notes

### Architecture & File Locations

**Files to Create:**
```
dashboard/src/
├── components/
│   └── agents/
│       ├── AgentPanel.tsx       # Panel container
│       ├── AgentPanel.test.tsx  # Co-located test
│       ├── AgentRow.tsx         # Individual agent row
│       └── AgentRow.test.tsx    # Co-located test
└── utils/
    └── formatters.ts            # Duration formatting
```

### Technical Requirements

**Panel Anatomy (from UX Design):**
```
+---------------------------------------------+
| AGENTS (4 active)                            |
|---------------------------------------------|
| [*] Agent 1 - Story 2.3    [Running 5m]     |
|     Last: "Running tests..."                 |
|                                              |
| [*] Agent 2 - Story 2.4    [Running 12m]    |
|     Last: "Implementing auth..."             |
|                                              |
| [*] Agent 3 - Code Review  [Running 3m]     |
|     Last: "Reviewing PR #42..."              |
|                                              |
| [!] Agent 4 - Story 2.5    [Stuck 45m]      |
|     Last: "Waiting for response..."          |
|     [Kill] [View Logs]                       |
+---------------------------------------------+
```

**Specifications:**
- Activity Indicator: Pulsing green dot when active
- Stuck Indicator: Yellow (>30min) or red (>45min) exclamation
- Last Activity: Truncated last output line, not full log
- Timing: Monospace font, "Xm" or "Xh Xm" format

**Stuck Thresholds:**
| Duration | Indicator | Color |
|----------|-----------|-------|
| < 30min | Pulsing dot | #0ECB81 (green) |
| 30-45min | Warning triangle | #FCD535 (yellow) |
| > 45min | Alert exclamation | #F6465D (red) |

### Implementation Patterns

**AgentPanel Component:**
```tsx
// dashboard/src/components/agents/AgentPanel.tsx
import { useAgentsStore } from '@/stores/agentsStore';
import { AgentRow } from './AgentRow';

interface AgentPanelProps {
  projectId?: string;
}

export const AgentPanel: React.FC<AgentPanelProps> = ({ projectId }) => {
  const { agents, isLoading } = useAgentsStore();

  // Filter by project if specified
  const filteredAgents = projectId
    ? agents.filter(a => a.projectId === projectId)
    : agents;

  const activeAgents = filteredAgents.filter(a => a.status === 'running' || a.status === 'stuck');

  if (isLoading) {
    return (
      <div className="p-4 bg-[#1E2329] rounded-lg">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-[#2B3139] rounded w-24" />
          <div className="h-16 bg-[#2B3139] rounded" />
          <div className="h-16 bg-[#2B3139] rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#1E2329] rounded-lg border border-[#2B3139]">
      <div className="px-4 py-3 border-b border-[#2B3139]">
        <h3 className="text-sm font-medium text-[#EAECEF]">
          AGENTS ({activeAgents.length} active)
        </h3>
      </div>

      {activeAgents.length === 0 ? (
        <div className="p-4 text-center text-[#848E9C] text-sm">
          All agents idle
        </div>
      ) : (
        <div className="divide-y divide-[#2B3139]">
          {activeAgents.map((agent) => (
            <AgentRow
              key={agent.id}
              agent={agent}
              onKill={(id) => console.log('Kill:', id)}
              onViewLogs={(id) => console.log('View logs:', id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
```

**AgentRow Component:**
```tsx
// dashboard/src/components/agents/AgentRow.tsx
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Activity, XCircle } from 'lucide-react';
import { formatDuration } from '@/utils/formatters';
import type { Agent } from '@/types/agent';

interface AgentRowProps {
  agent: Agent;
  onKill: (id: string) => void;
  onViewLogs: (id: string) => void;
}

const WARN_THRESHOLD = 30 * 60; // 30 minutes
const STUCK_THRESHOLD = 45 * 60; // 45 minutes

export const AgentRow: React.FC<AgentRowProps> = ({ agent, onKill, onViewLogs }) => {
  const [currentDuration, setCurrentDuration] = useState(agent.duration);

  // Update duration every second
  useEffect(() => {
    const interval = setInterval(() => {
      const start = new Date(agent.startedAt).getTime();
      const now = Date.now();
      setCurrentDuration(Math.floor((now - start) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [agent.startedAt]);

  const isWarning = currentDuration > WARN_THRESHOLD && currentDuration <= STUCK_THRESHOLD;
  const isStuck = currentDuration > STUCK_THRESHOLD;
  const showActions = isWarning || isStuck;

  const getIndicator = () => {
    if (isStuck) {
      return <XCircle className="w-4 h-4 text-[#F6465D]" />;
    }
    if (isWarning) {
      return <AlertTriangle className="w-4 h-4 text-[#FCD535]" />;
    }
    return (
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#0ECB81] opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-[#0ECB81]" />
      </span>
    );
  };

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {getIndicator()}
          <div>
            <span className="text-sm text-[#EAECEF]">
              {agent.id.substring(0, 8)} - Story {agent.storyId}
            </span>
          </div>
        </div>
        <span className={`
          text-xs font-mono
          ${isStuck ? 'text-[#F6465D]' : isWarning ? 'text-[#FCD535]' : 'text-[#848E9C]'}
        `}>
          {isStuck ? 'Stuck' : 'Running'} {formatDuration(currentDuration)}
        </span>
      </div>

      <p className="mt-1 ml-5 text-xs text-[#5E6673] truncate">
        Last: "{agent.lastOutput || 'Starting...'}"
      </p>

      {showActions && (
        <div className="mt-2 ml-5 flex gap-2">
          <Button
            variant="destructive"
            size="sm"
            className="h-7 text-xs"
            onClick={() => onKill(agent.id)}
          >
            Kill
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => onViewLogs(agent.id)}
          >
            View Logs
          </Button>
        </div>
      )}
    </div>
  );
};
```

**Duration Formatter:**
```typescript
// dashboard/src/utils/formatters.ts

/**
 * Format duration in seconds to human-readable string
 * @param seconds Duration in seconds
 * @returns Formatted string like "5m" or "1h 23m"
 */
export function formatDuration(seconds: number): string {
  if (seconds < 0) return '0m';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

/**
 * Format relative time from ISO timestamp
 * @param timestamp ISO 8601 timestamp
 * @returns Formatted string like "5m ago" or "just now"
 */
export function formatRelativeTime(timestamp: string): string {
  const now = Date.now();
  const time = new Date(timestamp).getTime();
  const diff = Math.floor((now - time) / 1000);

  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
```

### Project Structure Notes

- AgentPanel is a container that filters and renders AgentRows
- AgentRow handles its own duration updates via useEffect
- formatDuration is a pure utility function, easily testable
- Panel can be placed in sidebar, main content, or as overlay

### Dependencies on Other Stories

- **Requires Story 2.4**: agentsStore must provide agents data
- **Future Story 4.1**: Kill button will call kill API endpoint
- **Future Story 4.5**: View Logs will open log viewer panel

### Testing Requirements

**AgentPanel Tests:**
```tsx
describe('AgentPanel', () => {
  it('displays agent count in header', () => {
    // Mock 3 active agents
    render(<AgentPanel />);
    expect(screen.getByText('AGENTS (3 active)')).toBeInTheDocument();
  });

  it('shows empty state when no active agents', () => {
    // Mock empty agents array
    render(<AgentPanel />);
    expect(screen.getByText('All agents idle')).toBeInTheDocument();
  });

  it('filters agents by projectId', () => {
    // Mock agents from different projects
    render(<AgentPanel projectId="project-1" />);
    // Should only show agents from project-1
  });
});
```

**AgentRow Tests:**
```tsx
describe('AgentRow', () => {
  const mockAgent: Agent = {
    id: 'agent-123',
    projectId: 'proj-1',
    storyId: '2-3',
    storyTitle: 'Test Story',
    status: 'running',
    startedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 min ago
    lastActivity: new Date().toISOString(),
    lastOutput: 'Working on implementation...',
    duration: 300
  };

  it('displays pulsing indicator for running agent', () => {
    render(<AgentRow agent={mockAgent} onKill={jest.fn()} onViewLogs={jest.fn()} />);
    expect(screen.getByTestId('pulsing-indicator')).toBeInTheDocument();
  });

  it('shows warning icon after 30 minutes', () => {
    const warnAgent = { ...mockAgent, duration: 35 * 60 };
    render(<AgentRow agent={warnAgent} onKill={jest.fn()} onViewLogs={jest.fn()} />);
    expect(screen.getByRole('img', { name: /warning/i })).toBeInTheDocument();
  });

  it('shows action buttons when stuck', () => {
    const stuckAgent = { ...mockAgent, duration: 50 * 60 };
    render(<AgentRow agent={stuckAgent} onKill={jest.fn()} onViewLogs={jest.fn()} />);
    expect(screen.getByText('Kill')).toBeInTheDocument();
    expect(screen.getByText('View Logs')).toBeInTheDocument();
  });

  it('truncates long output text', () => {
    const longOutput = 'A'.repeat(100);
    const agent = { ...mockAgent, lastOutput: longOutput };
    render(<AgentRow agent={agent} onKill={jest.fn()} onViewLogs={jest.fn()} />);
    expect(screen.getByText(/Last:/)).toHaveTextContent('...');
  });
});
```

**Formatter Tests:**
```typescript
describe('formatDuration', () => {
  it('formats seconds to minutes', () => {
    expect(formatDuration(300)).toBe('5m');
    expect(formatDuration(0)).toBe('0m');
    expect(formatDuration(59)).toBe('0m');
    expect(formatDuration(60)).toBe('1m');
  });

  it('formats to hours and minutes', () => {
    expect(formatDuration(3600)).toBe('1h 0m');
    expect(formatDuration(5400)).toBe('1h 30m');
    expect(formatDuration(7200)).toBe('2h 0m');
  });
});
```

### Accessibility Requirements

- Status indicators have text alternatives
- Action buttons have clear labels
- Duration updates don't cause layout shifts
- Focus management when actions appear
- Color not sole status indicator (icons used)

### References

- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Agent Activity Panel]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.5]
- [Source: _bmad-output/project-context.md#Naming Conventions]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5

### Debug Log References

None

### Completion Notes List

- Created Agent type definitions in `dashboard/src/types/agent.ts` with AgentStatus enum and Agent interface
- Implemented agentsStore Zustand store with fetchAgents, addAgent, updateAgent, removeAgent actions
- Created formatters utility with formatDuration and formatRelativeTime functions
- Built AgentRow component with pulsing green indicator for healthy agents, yellow warning (30-45min), and red stuck (>45min) indicators
- Built AgentPanel component that displays agent count, filters by project, shows loading/empty states
- Integrated AgentPanel into Layout as a collapsible right sidebar panel
- Added agentPanelVisible toggle to uiStore with localStorage persistence
- Comprehensive test coverage: 207 total tests passing including:
  - AgentRow.test.tsx (15 tests): indicator states, action buttons, truncation, callbacks
  - AgentPanel.test.tsx (8 tests): rendering, filtering, loading/empty states
  - agentsStore.test.ts (17 tests): CRUD operations, API calls, error handling
  - formatters.test.ts (12 tests): duration formatting, relative time
  - uiStore.test.ts (11 tests): panel visibility toggle, persistence

### Change Log

- 2026-01-15: Implemented Agent Activity Panel (Story 2.5) - AgentPanel, AgentRow components, formatters utility, layout integration

### File List

**New Files:**
- dashboard/src/types/agent.ts
- dashboard/src/stores/agentsStore.ts
- dashboard/src/stores/agentsStore.test.ts
- dashboard/src/utils/formatters.ts
- dashboard/src/utils/formatters.test.ts
- dashboard/src/components/agents/AgentPanel.tsx
- dashboard/src/components/agents/AgentPanel.test.tsx
- dashboard/src/components/agents/AgentRow.tsx
- dashboard/src/components/agents/AgentRow.test.tsx

**Modified Files:**
- dashboard/src/stores/uiStore.ts (added agentPanelVisible state and toggleAgentPanel action)
- dashboard/src/stores/uiStore.test.ts (added tests for agentPanelVisible)
- dashboard/src/components/layout/Layout.tsx (integrated AgentPanel as right sidebar with fetchAgents)
- dashboard/src/components/layout/Layout.test.tsx (added AgentPanel rendering tests)

**New Files (Code Review Fixes):**
- dashboard/src/components/agents/index.ts (barrel export for cleaner imports)

## Senior Developer Review (AI)

**Reviewer:** Claude Opus 4.5
**Date:** 2026-01-15
**Outcome:** APPROVED ✅

### Review Summary

Initial review found 7 issues (2 HIGH, 4 MEDIUM, 1 LOW). All HIGH and MEDIUM issues have been resolved. Story is complete.

### Issues Found & Fixed

| # | Severity | Issue | Status |
|---|----------|-------|--------|
| 1 | HIGH | fetchAgents() never called - AgentPanel always empty | ✅ FIXED - Added useEffect in Layout.tsx |
| 2 | HIGH | No WebSocket real-time updates for agents | ✅ FIXED - Connected useWebSocket hook to Layout |
| 3 | MEDIUM | Stuck threshold not configurable (AC#4 violated) | ✅ FIXED - Added VITE_AGENT_WARN/STUCK_THRESHOLD env vars |
| 4 | MEDIUM | Missing aria-label for pulsing indicator | ✅ FIXED - Added role="status" aria-label="Running status" |
| 5 | MEDIUM | Missing index.ts barrel export for agents | ✅ FIXED - Created dashboard/src/components/agents/index.ts |
| 6 | LOW | Timer update interval not tested | 📝 Optional enhancement |
| 7 | LOW | Console.log placeholder in production | ✅ ALREADY FIXED - Uses toast notifications |

### Code Quality Assessment

- ✅ TypeScript types properly defined
- ✅ Test coverage adequate (23 tests for agent components)
- ✅ Accessibility improved with aria-labels
- ✅ Error handling present in store
- ✅ Real-time updates via WebSocket (agent:spawn, agent:output, agent:complete, agent:stuck)

### Files Modified During Review

- `dashboard/src/components/layout/Layout.tsx` - Added AgentPanel integration, useWebSocket hook, initial fetchAgents
- `dashboard/src/components/layout/Layout.test.tsx` - Added 5 new tests for AgentPanel integration, mocked useWebSocket
- `dashboard/src/components/agents/AgentRow.tsx` - Made thresholds configurable, added aria-label
- `dashboard/src/components/agents/index.ts` - Created barrel export (NEW FILE)

### Verification

```
npm test -- --run src/components/layout/Layout.test.tsx  → 11 tests PASS
npm test -- --run src/components/agents/               → 23 tests PASS
npm run build                                          → SUCCESS
```
