# Story 4.4: Retry Story Dashboard Button

Status: done

## Story

As a **user**,
I want **to retry a failed story with one click**,
So that **I can quickly recover from failures** (FR45).

## Acceptance Criteria

**AC1: Retry Button Display**
**Given** a story is in failed state
**When** I view the project details
**Then** a [Retry] button appears next to the failed story

**AC2: Retry Action Success**
**Given** I click [Retry]
**When** the API call succeeds
**Then** the story status changes to "pending" then "in-progress"
**And** a new agent appears in the activity panel
**And** a toast confirms "Retrying Story X.Y"

**AC3: Retry with Warning**
**Given** the story has exceeded max retries
**When** the API returns a warning
**Then** a yellow toast shows the warning message
**And** the retry still proceeds

**AC4: Retry Action Error**
**Given** the retry API call fails
**When** the error response is received
**Then** a red toast notification shows the error message
**And** the story remains in failed state

## Tasks / Subtasks

- [x] Task 1: Create RetryButton component (AC: 1)
  - [x] 1.1: Create `dashboard/src/components/stories/RetryButton.tsx`
  - [x] 1.2: Style as primary button (gold) for failed stories
  - [x] 1.3: Accept props: storyId, onRetrySuccess callback, disabled state
- [x] Task 2: Implement retry API service (AC: 2, 3, 4)
  - [x] 2.1: Add `retryStory(storyId)` function to `dashboard/src/services/api.ts`
  - [x] 2.2: POST to `/api/stories/:id/retry`
  - [x] 2.3: Handle both success and warning responses
- [x] Task 3: Create storiesStore (AC: 2, 3, 4)
  - [x] 3.1: Create `dashboard/src/stores/storiesStore.ts` if not exists
  - [x] 3.2: Add `retryStory` action with loading state
  - [x] 3.3: Update story status on success
  - [x] 3.4: Handle error and warning states
- [x] Task 4: Integrate with ProjectDetail view (AC: 1)
  - [x] 4.1: Import RetryButton into story list component
  - [x] 4.2: Conditionally render for failed stories
  - [x] 4.3: Connect to storiesStore action
- [x] Task 5: Add toast notifications (AC: 2, 3, 4)
  - [x] 5.1: Success toast: "Retrying Story X.Y" (gold, 5s)
  - [x] 5.2: Warning toast: warning message (yellow, persist)
  - [x] 5.3: Error toast: error message (red, persist)
- [x] Task 6: Handle WebSocket updates (AC: 2)
  - [x] 6.1: Listen for `story:retry` event, update story status
  - [x] 6.2: Listen for `agent:spawn` event, add to agents list
- [x] Task 7: Status badge update (AC: 2)
  - [x] 7.1: Create StatusBadge with animation for status transitions
  - [x] 7.2: Show pending → in-progress transition smoothly
- [x] Task 8: Write component tests
  - [x] 8.1: Test RetryButton conditional rendering
  - [x] 8.2: Test storiesStore retry flow
  - [x] 8.3: Test toast notification triggers

### Review Follow-ups (AI)

- [ ] [AI-Review][LOW] Update Dev Notes code examples to use actual uiStore.addToast API instead of toast() hook pattern
- [ ] [AI-Review][LOW] Update AC1 description to include 'killed' state: "Given a story is in failed or killed state"

## Dev Notes

### Architecture Compliance

**File Structure:**
```
dashboard/src/
├── components/
│   └── stories/
│       ├── RetryButton.tsx          # NEW
│       ├── RetryButton.test.tsx     # NEW
│       └── StoryStatusBadge.tsx     # NEW or MODIFY
├── stores/
│   └── storiesStore.ts              # NEW or MODIFY
└── services/
    └── api.ts                       # MODIFY
```

### UI Design Specifications

**RetryButton Styling:**
```typescript
// Primary action button (gold) for retry
<Button
  variant="default"
  size="sm"
  className="bg-amber-500 hover:bg-amber-600 text-black"
>
  Retry
</Button>
```

**Status Badge States:**
```typescript
const statusStyles = {
  pending: 'bg-gray-500/20 text-gray-400',      // Waiting
  'in-progress': 'bg-blue-500/20 text-blue-400 animate-pulse', // Active
  failed: 'bg-red-500/20 text-red-400',         // Error
  killed: 'bg-red-500/20 text-red-400',         // Terminated
  done: 'bg-amber-500/20 text-amber-400',       // Verified success
  review: 'bg-purple-500/20 text-purple-400',   // In review
};
```

**Toast Types (via uiStore.addToast):**
```typescript
// Success (uses 'success' type)
addToast({ type: 'success', message: 'Retrying Story 4.3', duration: 5000 });

// Warning (yellow, persists without duration)
addToast({ type: 'warning', message: warningMessage });

// Error (red, persists without duration)
addToast({ type: 'error', message: errorMessage });
```

### Zustand Store Pattern

**storiesStore.ts:**
```typescript
import { create } from 'zustand';
import * as api from '@/services/api';

interface Story {
  id: string;
  title: string;
  epicNumber: number;
  status: 'pending' | 'in-progress' | 'failed' | 'killed' | 'done' | 'review';
  retryCount?: number;
}

interface StoriesState {
  stories: Story[];
  isLoading: boolean;
  error: string | null;
  retryingStoryId: string | null;

  fetchStories: () => Promise<void>;
  retryStory: (storyId: string) => Promise<{ success: boolean; warning?: string }>;
  updateStoryStatus: (storyId: string, status: Story['status']) => void;
}

export const useStoriesStore = create<StoriesState>((set, get) => ({
  stories: [],
  isLoading: false,
  error: null,
  retryingStoryId: null,

  retryStory: async (storyId) => {
    set({ retryingStoryId: storyId, error: null });
    try {
      const result = await api.retryStory(storyId);

      // Update story status
      set((state) => ({
        stories: state.stories.map((s) =>
          s.id === storyId ? { ...s, status: 'pending' } : s
        ),
        retryingStoryId: null,
      }));

      return { success: true, warning: result.warning };
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Retry failed',
        retryingStoryId: null,
      });
      return { success: false };
    }
  },

  updateStoryStatus: (storyId, status) => {
    set((state) => ({
      stories: state.stories.map((s) =>
        s.id === storyId ? { ...s, status } : s
      ),
    }));
  },
}));
```

### API Service Addition

**api.ts:**
```typescript
export interface RetryStoryResponse {
  data: {
    storyId: string;
    status: string;
    agentId: string;
  };
  meta: { timestamp: string };
  warning?: string;
}

export async function retryStory(storyId: string): Promise<RetryStoryResponse> {
  const response = await fetch(`${API_BASE}/api/stories/${storyId}/retry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to retry story');
  }

  return response.json();
}
```

### Component Implementation

**RetryButton.tsx:**
```tsx
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';

interface RetryButtonProps {
  storyId: string;
  onRetry: () => void;
  isRetrying?: boolean;
}

export function RetryButton({ storyId, onRetry, isRetrying }: RetryButtonProps) {
  return (
    <Button
      size="sm"
      onClick={onRetry}
      disabled={isRetrying}
      className="bg-amber-500 hover:bg-amber-600 text-black"
    >
      <RotateCcw className={`h-4 w-4 mr-1 ${isRetrying ? 'animate-spin' : ''}`} />
      {isRetrying ? 'Retrying...' : 'Retry'}
    </Button>
  );
}
```

**Usage in ProjectDetail:**
```tsx
import { useStoriesStore } from '@/stores/storiesStore';
import { RetryButton } from '@/components/stories/RetryButton';
import { toast } from '@/hooks/use-toast';

function StoryRow({ story }) {
  const { retryStory, retryingStoryId } = useStoriesStore();

  const handleRetry = async () => {
    const result = await retryStory(story.id);

    if (result.success) {
      toast({ title: `Retrying Story ${story.id}` });

      if (result.warning) {
        toast({
          title: 'Warning',
          description: result.warning,
          variant: 'warning',
        });
      }
    } else {
      toast({
        title: 'Retry Failed',
        description: 'Could not retry story',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="flex items-center justify-between">
      <span>{story.title}</span>
      {['failed', 'killed'].includes(story.status) && (
        <RetryButton
          storyId={story.id}
          onRetry={handleRetry}
          isRetrying={retryingStoryId === story.id}
        />
      )}
    </div>
  );
}
```

### WebSocket Event Handling

```typescript
// In WebSocket message handler
switch (message.type) {
  case 'story:retry':
    useStoriesStore.getState().updateStoryStatus(
      message.data.storyId,
      message.data.status
    );
    break;

  case 'agent:spawn':
    useAgentsStore.getState().addAgent({
      id: message.data.agentId,
      storyId: message.data.storyId,
      status: 'running',
      startedAt: message.timestamp,
    });
    break;
}
```

### Dependencies

- **Story 4.3** (Retry Story API) must be completed first
- Uses toast component from shadcn/ui (should exist from earlier epics)

### Anti-Patterns to Avoid

1. **DO NOT** allow retry on non-failed stories (check status first)
2. **DO NOT** show retry button for in-progress or done stories
3. **DO NOT** mutate store state directly
4. **DO NOT** forget to handle both success and warning responses
5. **DO NOT** hardcode API URLs

### Color Tokens

```css
--accent-gold: #F0B90B;     /* Success, verified, primary actions */
--accent-yellow: #FCD535;   /* Warning, pending */
--accent-red: #F6465D;      /* Failed, error */
--accent-blue: #1E90FF;     /* In progress */
```

### References

- [Source: ux-design-specification.md#Project-Card-Component] - Status states
- [Source: ux-design-specification.md#Button-Hierarchy] - Button styling
- [Source: architecture.md#Frontend-Architecture] - Store pattern
- [Source: Story 4.3] - Backend retry API (dependency)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A - No debug issues encountered during implementation.

### Completion Notes List

- Implemented RetryButton component with gold (amber-500) styling and spinning icon during retry
- Added retryStory API service function to api.ts with full response type including warning
- Created storiesStore Zustand store for managing story state and retry operations
- Integrated RetryButton into StoryList component, showing button for failed/killed stories
- Toast notifications implemented via existing uiStore.addToast for success, warning, and error states
- WebSocket handler added for story:retry events to sync status in real-time
- Extended StoryStatus type to include 'failed', 'killed', and 'pending' states
- Updated StoryStatusBadge to display new statuses with animations
- Updated StatusIndicator to handle new status types
- All 451 frontend tests pass (36 test files)
- All 338 backend tests pass (24 test files)
- Build compiles successfully

### File List

**New Files:**
- dashboard/src/components/stories/RetryButton.tsx
- dashboard/src/components/stories/RetryButton.test.tsx
- dashboard/src/stores/storiesStore.ts
- dashboard/src/stores/storiesStore.test.ts

**Modified Files:**
- dashboard/src/services/api.ts (added retryStory function and types)
- dashboard/src/services/api.test.ts (added retryStory unit tests - code review fix)
- dashboard/src/stores/uiStore.ts (no changes - already had addToast)
- dashboard/src/types/project.ts (added failed, killed, pending to StoryStatus)
- dashboard/src/components/projects/StoryList.tsx (integrated RetryButton)
- dashboard/src/components/projects/StoryList.test.tsx (added retry button tests)
- dashboard/src/components/ui/StoryStatusBadge.tsx (added new status styles with animation)
- dashboard/src/components/ui/StoryStatusBadge.test.tsx (added new status tests)
- dashboard/src/components/status/StatusIndicator.tsx (added new status colors/labels)
- dashboard/src/components/status/StatusIndicator.test.tsx (added new status tests)
- dashboard/src/hooks/useWebSocket.ts (added story:retry event handler)

## Change Log

| Date | Change |
|------|--------|
| 2026-01-16 | Story 4.4 implementation complete - RetryButton component, storiesStore, API service, WebSocket integration, toast notifications |
| 2026-01-16 | Code review: Fixed H1 (added retryStory API tests), M1 (removed unused storyId prop), M2 (fixed redundant type union), M3 (updated toast docs). Added 2 LOW action items. |
