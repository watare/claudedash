# Story 4.2: Kill Agent Dashboard Button

Status: done

## Story

As a **user**,
I want **to kill a stuck agent with one click from the dashboard**,
So that **I can quickly recover from stuck situations** (FR44).

## Acceptance Criteria

**AC1: Kill Button Display**
**Given** I see an agent in the activity panel
**When** the agent row renders
**Then** a [Kill] button is visible (secondary style, red text)

**AC2: Confirmation Dialog**
**Given** I see an agent in the activity panel
**When** I click the [Kill] button
**Then** a confirmation dialog appears: "Kill agent working on Story X.Y?"
**And** the dialog has [Cancel] and [Kill Agent] (red) buttons

**AC3: Kill Action Success**
**Given** I confirm the kill action
**When** the API call completes successfully
**Then** the agent disappears from the active list
**And** a toast notification confirms "Agent terminated"
**And** the story status updates to show it can be retried

**AC4: Kill Action Error**
**Given** the kill API call fails
**When** the error response is received
**Then** a red toast notification shows the error message
**And** the agent remains in the list

## Tasks / Subtasks

- [x] Task 1: Create KillButton component (AC: 1)
  - [x] 1.1: Create `dashboard/src/components/agents/KillButton.tsx`
  - [x] 1.2: Style as secondary button with red text (`--accent-red`)
  - [x] 1.3: Accept props: agentId, storyId, onKillRequest callback
- [x] Task 2: Create ConfirmKillDialog component (AC: 2)
  - [x] 2.1: Create `dashboard/src/components/agents/ConfirmKillDialog.tsx`
  - [x] 2.2: Use Radix AlertDialog primitive from shadcn/ui
  - [x] 2.3: Display agent/story context in dialog body
  - [x] 2.4: Include [Cancel] (secondary) and [Kill Agent] (destructive red) buttons
- [x] Task 3: Implement kill API service (AC: 3, 4)
  - [x] 3.1: Add `killAgent(agentId)` function to `dashboard/src/services/api.ts`
  - [x] 3.2: POST to `/api/agents/:id/kill`
  - [x] 3.3: Return typed response with success/error
- [x] Task 4: Add kill action to agentsStore (AC: 3, 4)
  - [x] 4.1: Add `killAgent` action to `dashboard/src/stores/agentsStore.ts`
  - [x] 4.2: Handle loading state during API call (killingAgentId)
  - [x] 4.3: On success: remove agent from store, trigger toast
  - [x] 4.4: On error: keep agent in store, trigger error toast
- [x] Task 5: Integrate with AgentPanel (AC: 1)
  - [x] 5.1: Import ConfirmKillDialog into AgentPanel component
  - [x] 5.2: Render Kill button in each agent row (via AgentRow)
  - [x] 5.3: Wire up confirmation dialog flow
- [x] Task 6: Add toast notifications (AC: 3, 4)
  - [x] 6.1: Use existing toast system from sonner
  - [x] 6.2: Success toast: "Agent terminated" (5s auto-dismiss)
  - [x] 6.3: Error toast: error message (persist until dismissed)
- [x] Task 7: Handle WebSocket update (AC: 3)
  - [x] 7.1: Listen for `agent:kill` WebSocket event
  - [x] 7.2: Auto-remove killed agent from store when event received
- [x] Task 8: Write component tests
  - [x] 8.1: Test KillButton renders with correct styling
  - [x] 8.2: Test ConfirmKillDialog opens/closes correctly
  - [x] 8.3: Test agentsStore kill action flow

### Review Follow-ups (AI)

- [ ] [AI-Review][MEDIUM] Add AgentPanel integration tests for full kill flow (dialog open/confirm/toasts) [dashboard/src/components/agents/AgentPanel.tsx]
- [ ] [AI-Review][LOW] Remove unused `agentId` and `storyId` props from KillButton if not needed [dashboard/src/components/agents/KillButton.tsx:7-8]
- [ ] [AI-Review][LOW] Consider displaying `agentId` in ConfirmKillDialog for additional context [dashboard/src/components/agents/ConfirmKillDialog.tsx:19]

## Dev Notes

### Architecture Compliance

**File Structure (from Architecture doc):**
```
dashboard/src/
├── components/
│   └── agents/
│       ├── KillButton.tsx           # NEW
│       ├── KillButton.test.tsx      # NEW
│       ├── ConfirmKillDialog.tsx    # NEW
│       └── AgentPanel.tsx           # MODIFY
├── stores/
│   └── agentsStore.ts               # MODIFY
└── services/
    └── api.ts                       # MODIFY
```

### UI Design Specifications (from UX Design doc)

**Button Styling:**
```typescript
// Destructive button tier
// Default: Red text (#F6465D)
// Hover: Red bg at 10% opacity
// Active: Red bg at 20% opacity

<Button variant="destructive" size="sm">Kill</Button>
```

**Dialog Styling:**
- Background: `--bg-secondary` (#1E2329)
- Border: 1px `--border-default` (#2B3139)
- Border radius: 8px
- Primary action (Kill Agent): Red background

**Toast Specifications (from UX doc):**
- Position: Bottom-right
- Stack max: 3
- Success: Auto-dismiss 5s
- Error: Persist until dismissed

### Zustand Store Pattern

**agentsStore.ts additions:**
```typescript
interface AgentsState {
  agents: Agent[];
  isLoading: boolean;
  error: string | null;
  killingAgentId: string | null; // Track which agent is being killed

  // Actions
  fetchAgents: () => Promise<void>;
  killAgent: (agentId: string) => Promise<boolean>;
  removeAgent: (agentId: string) => void;
}

// Kill action implementation
killAgent: async (agentId) => {
  set({ killingAgentId: agentId, error: null });
  try {
    await api.killAgent(agentId);
    set((state) => ({
      agents: state.agents.filter(a => a.id !== agentId),
      killingAgentId: null
    }));
    return true;
  } catch (error) {
    set({
      error: error instanceof Error ? error.message : 'Failed to kill agent',
      killingAgentId: null
    });
    return false;
  }
}
```

### API Service Pattern

**api.ts addition:**
```typescript
export async function killAgent(agentId: string): Promise<KillAgentResponse> {
  const response = await fetch(`${API_BASE}/api/agents/${agentId}/kill`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include', // For auth cookies
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to kill agent');
  }

  return response.json();
}

interface KillAgentResponse {
  data: {
    agentId: string;
    status: 'killed';
    method: 'SIGTERM' | 'SIGKILL';
  };
  meta: { timestamp: string };
}
```

### WebSocket Integration

**Handle kill event in useWebSocket hook:**
```typescript
// In WebSocket message handler
case 'agent:kill':
  useAgentsStore.getState().removeAgent(message.data.agentId);
  break;
```

### Component Examples

**KillButton.tsx:**
```tsx
interface KillButtonProps {
  agentId: string;
  storyId: string;
  onKillRequest: () => void;
  isKilling?: boolean;
}

export function KillButton({ agentId, storyId, onKillRequest, isKilling }: KillButtonProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-red-500 hover:bg-red-500/10"
      onClick={onKillRequest}
      disabled={isKilling}
    >
      {isKilling ? 'Killing...' : 'Kill'}
    </Button>
  );
}
```

**ConfirmKillDialog.tsx:**
```tsx
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ConfirmKillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  storyId: string;
  onConfirm: () => void;
}

export function ConfirmKillDialog({ open, onOpenChange, storyId, onConfirm }: ConfirmKillDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Kill Agent?</AlertDialogTitle>
          <AlertDialogDescription>
            Kill agent working on Story {storyId}? The story will need to be retried.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-600 hover:bg-red-700"
            onClick={onConfirm}
          >
            Kill Agent
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

### Dependencies

**Story 4.1** must be completed first (Kill Agent API & Backend)

### Anti-Patterns to Avoid

1. **DO NOT** call API directly in component - use store action
2. **DO NOT** mutate state directly: `state.agents.splice()` - use immutable updates
3. **DO NOT** use localStorage for auth tokens - use HTTP-only cookies
4. **DO NOT** hardcode API URLs - use environment variable `import.meta.env.VITE_API_URL`
5. **DO NOT** forget to handle loading states in UI

### Color Tokens (from UX Design)

```css
--accent-red: #F6465D;      /* Failed, error, destructive */
--bg-secondary: #1E2329;    /* Cards, panels, dialogs */
--border-default: #2B3139;  /* Subtle borders */
--text-primary: #EAECEF;    /* Primary content */
```

### References

- [Source: ux-design-specification.md#Button-Hierarchy] - Button styling tiers
- [Source: ux-design-specification.md#Toast-Notification-Component] - Toast specs
- [Source: architecture.md#Frontend-Architecture] - Zustand store pattern
- [Source: project-context.md#Zustand-Store-Pattern] - Store implementation
- [Source: Story 4.1] - Backend kill API (dependency)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A

### Completion Notes List

- Implemented KillButton component with ghost variant styling and red text (#F6465D)
- Created ConfirmKillDialog using @radix-ui/react-alert-dialog primitive
- Added killAgent API function to api.ts with typed response
- Extended agentsStore with killAgent action and killingAgentId state tracking
- Integrated confirmation dialog flow in AgentPanel
- Toast notifications: success (5s auto-dismiss) and error (persist until dismissed)
- Added agent:kill WebSocket event handler in useWebSocket hook
- Wrote comprehensive tests for KillButton, ConfirmKillDialog, and agentsStore killAgent action
- All 418 tests pass, build succeeds

**Code Review Fixes (2026-01-16):**
- Fixed AC1 violation: Kill button now always visible in AgentRow (was only showing for warning/stuck agents)
- Integrated KillButton component into AgentRow (was duplicated inline, making KillButton dead code)
- Updated AgentRow tests to verify Kill button is always visible per AC1
- All 418 tests pass after fixes

### Change Log

- 2026-01-16: Implemented kill agent dashboard button functionality (Story 4.2)
- 2026-01-16: Code review fixes - AC1 compliance (Kill button always visible), KillButton component integration

### File List

**New Files:**
- dashboard/src/components/agents/KillButton.tsx
- dashboard/src/components/agents/KillButton.test.tsx
- dashboard/src/components/agents/ConfirmKillDialog.tsx
- dashboard/src/components/agents/ConfirmKillDialog.test.tsx
- dashboard/src/components/ui/alert-dialog.tsx

**Modified Files:**
- dashboard/src/components/agents/AgentPanel.tsx
- dashboard/src/components/agents/AgentRow.tsx
- dashboard/src/services/api.ts
- dashboard/src/stores/agentsStore.ts
- dashboard/src/stores/agentsStore.test.ts
- dashboard/src/hooks/useWebSocket.ts
- dashboard/package.json (added @radix-ui/react-alert-dialog)
