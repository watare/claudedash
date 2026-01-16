# Story 5.2: Toast Notification UI

Status: ready-for-dev

## Story

As a **user**,
I want **toast notifications for important events in the dashboard**,
So that **I see alerts even if not looking at the relevant project**.

## Acceptance Criteria

1. **Given** an event requires user attention
   **When** a notification is triggered
   **Then** a toast appears in the bottom-right corner
   **And** toasts stack (max 3 visible)

2. **Given** different notification types
   **When** toasts render
   **Then** styling matches type: yellow (approval), red (stuck/error), gold (complete), gray (info)
   **And** approval/error toasts persist until dismissed
   **And** info/success toasts auto-dismiss after 5-10 seconds

3. **Given** a toast has an action
   **When** I click the action button (e.g., [Approve], [View])
   **Then** I am taken to the relevant view
   **And** the toast dismisses

4. **Given** toasts are stacked
   **When** more than 3 notifications arrive
   **Then** oldest toasts are removed to make room
   **And** a badge shows "+N more" if notifications were hidden

5. **Given** I want to dismiss a toast manually
   **When** I click the close button or press Escape
   **Then** the toast animates out and is removed
   **And** remaining toasts reposition smoothly

## Tasks / Subtasks

- [ ] Task 1: Create toast notification store (AC: #1, #2)
  - [ ] Create `dashboard/src/stores/notificationStore.ts`
  - [ ] Define notification type interface with id, type, title, message, actions, timestamp
  - [ ] Implement `addNotification()` action
  - [ ] Implement `removeNotification(id)` action
  - [ ] Implement `clearAll()` action
  - [ ] Track notification count and visible count (max 3)

- [ ] Task 2: Create Toast component (AC: #1, #2, #5)
  - [ ] Create `dashboard/src/components/ui/Toast.tsx`
  - [ ] Implement base toast with title, message, close button
  - [ ] Apply type-based styling:
    - `approval`: yellow background (`--accent-yellow`), bell icon
    - `error`: red background (`--accent-red`), X icon
    - `stuck`: red background (`--accent-red`), warning icon
    - `complete`: gold background (`--accent-gold`), checkmark icon
    - `info`: gray background (`--bg-tertiary`), info icon
  - [ ] Add slide-in animation from right (300ms ease-out)
  - [ ] Add slide-out animation on dismiss (200ms ease-in)

- [ ] Task 3: Implement action buttons (AC: #3)
  - [ ] Add action button slot to Toast component
  - [ ] Style action buttons based on toast type
  - [ ] Implement onClick handler that:
    - Executes the action callback
    - Navigates to relevant route (using React Router)
    - Dismisses the toast

- [ ] Task 4: Create ToastContainer component (AC: #1, #4)
  - [ ] Create `dashboard/src/components/ui/ToastContainer.tsx`
  - [ ] Position fixed bottom-right with appropriate spacing
  - [ ] Render max 3 toasts in stack
  - [ ] Show "+N more" badge when overflow occurs
  - [ ] Handle z-index for proper layering (z-50)

- [ ] Task 5: Implement auto-dismiss logic (AC: #2)
  - [ ] Add `autoDismiss` property to notification type
  - [ ] Set default dismiss times:
    - `info`: 5 seconds
    - `complete`: 10 seconds
    - `approval`: never (persist)
    - `error`: never (persist)
    - `stuck`: never (persist)
  - [ ] Use useEffect with setTimeout for auto-dismiss
  - [ ] Clear timeout on manual dismiss or unmount

- [ ] Task 6: Connect to WebSocket notifications (AC: #1)
  - [ ] Listen for `notification:new` WebSocket events
  - [ ] Parse notification data and add to store
  - [ ] Map backend notification types to frontend toast types

- [ ] Task 7: Add keyboard support (AC: #5)
  - [ ] Listen for Escape key to dismiss top toast
  - [ ] Ensure focus management for accessibility
  - [ ] Add aria-live region for screen reader announcements

- [ ] Task 8: Write component tests
  - [ ] Create `Toast.test.tsx` with rendering tests
  - [ ] Test auto-dismiss timing
  - [ ] Test action button clicks
  - [ ] Test stack overflow behavior

## Dev Notes

### Critical Implementation Rules

1. **Zustand Pattern** - Follow the established store pattern with `isLoading`, `error` states
2. **Immutable Updates** - Use spread operator for state updates, never mutate directly
3. **React Router Navigation** - Use `useNavigate` hook for action-based navigation

### Toast Type Definitions

```typescript
// dashboard/src/types/notification.ts
export type NotificationType = 'approval' | 'error' | 'stuck' | 'complete' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  project?: string;
  story?: string;
  actions?: NotificationAction[];
  timestamp: string;
  autoDismiss?: boolean;
  dismissAfter?: number; // ms
}

export interface NotificationAction {
  label: string;
  action: string;
  route?: string; // optional route to navigate to
}
```

### Store Pattern

```typescript
// dashboard/src/stores/notificationStore.ts
import { create } from 'zustand';

interface NotificationState {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  addNotification: (notification) =>
    set((state) => ({
      notifications: [
        { ...notification, id: crypto.randomUUID() },
        ...state.notifications
      ].slice(0, 10) // keep max 10 in memory
    })),
  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter(n => n.id !== id)
    })),
  clearAll: () => set({ notifications: [] })
}));
```

### Color Mapping

| Type | Background | Border | Icon |
|------|------------|--------|------|
| approval | `--accent-yellow` (20% opacity) | `--accent-yellow` | Bell |
| error | `--accent-red` (20% opacity) | `--accent-red` | XCircle |
| stuck | `--accent-red` (20% opacity) | `--accent-red` | AlertTriangle |
| complete | `--accent-gold` (20% opacity) | `--accent-gold` | CheckCircle |
| info | `--bg-tertiary` | `--border-default` | Info |

### Animation CSS

```css
/* Toast animations */
@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes slideOut {
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(100%);
    opacity: 0;
  }
}

.toast-enter {
  animation: slideIn 300ms ease-out;
}

.toast-exit {
  animation: slideOut 200ms ease-in;
}
```

### Component Structure

```
dashboard/src/
├── components/
│   └── ui/
│       ├── Toast.tsx           # NEW: Individual toast component
│       ├── Toast.test.tsx      # NEW: Toast tests
│       └── ToastContainer.tsx  # NEW: Container for stacked toasts
├── stores/
│   └── notificationStore.ts    # NEW: Notification state
└── types/
    └── notification.ts         # NEW: Notification types
```

### WebSocket Integration

The Toast system listens to WebSocket messages from the notification service:

```typescript
// In useWebSocket hook or WebSocket service
websocket.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.type === 'notification:new') {
    const notification = mapBackendNotification(message.data);
    useNotificationStore.getState().addNotification(notification);
  }
};

// Map backend types to frontend types
function mapBackendNotification(data: BackendNotification): Notification {
  const typeMap = {
    'APPROVAL_NEEDED': 'approval',
    'AGENT_STUCK': 'stuck',
    'PROJECT_COMPLETE': 'complete',
    'EPIC_COMPLETE': 'complete',
    'CRITICAL_ERROR': 'error',
    'INFO': 'info'
  };
  return {
    type: typeMap[data.type] || 'info',
    title: data.title,
    message: data.message,
    project: data.project,
    story: data.story,
    actions: data.actions,
    timestamp: data.timestamp
  };
}
```

### References

- [Source: ux-design-specification.md#Notification Toast Component] - Toast specifications
- [Source: architecture.md#Frontend Architecture] - Component structure
- [Source: project-context.md#Code Organization Rules] - Frontend structure
- [Source: ux-design-specification.md#Color System (Binance-Inspired)] - Color tokens

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

