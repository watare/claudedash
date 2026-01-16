# Story 5.6: Critical Error Notification

Status: ready-for-dev

## Story

As a **user**,
I want **to be notified immediately when a critical error occurs**,
So that **I can investigate and recover quickly** (FR50).

## Acceptance Criteria

1. **Given** a critical error occurs (orchestrator crash, database error, auth failure)
   **When** the error is caught
   **Then** a red toast persists until dismissed: "Critical error: [message]"
   **And** the toast has [View Logs] action

2. **Given** webhook is configured
   **When** critical error occurs
   **Then** webhook is called immediately with error details

3. **Given** Slack is configured
   **When** critical error occurs
   **Then** Slack message uses alert emoji and includes error message and timestamp

4. **Given** an error notification is shown
   **When** I click [View Logs]
   **Then** the log viewer opens with error context highlighted
   **And** the notification remains visible until manually dismissed

5. **Given** multiple critical errors occur
   **When** notifications display
   **Then** each error shows as a separate persistent toast
   **And** errors are not auto-dismissed

## Tasks / Subtasks

- [ ] Task 1: Define critical error categories (AC: #1)
  - [ ] Orchestrator crash/unhandled exception
  - [ ] Database connection/query failure
  - [ ] Authentication/authorization failure
  - [ ] Claude CLI spawn failure
  - [ ] Configuration parsing error
  - [ ] WebSocket server failure
  - [ ] File system access error (sprint-status.yaml, etc.)

- [ ] Task 2: Implement error catching in backend (AC: #1)
  - [ ] Add global error handler in server.js
  - [ ] Catch unhandled rejections and exceptions
  - [ ] Classify errors by severity (critical vs recoverable)
  - [ ] Emit notification for critical errors only

- [ ] Task 3: Add critical error notification to service (AC: #2, #3)
  - [ ] Create `notifyCriticalError(data)` method
  - [ ] Format webhook payload:
    ```json
    {
      "type": "CRITICAL_ERROR",
      "error": "Database connection failed",
      "code": "DB_CONNECTION_ERROR",
      "component": "sqlite",
      "stack": "Error: ...",
      "timestamp": "2026-01-15T12:00:00Z"
    }
    ```
  - [ ] Format Slack message with rotating_light emoji
  - [ ] Broadcast WebSocket event immediately

- [ ] Task 4: Create CriticalErrorToast component (AC: #1, #4)
  - [ ] Red background styling (`--accent-red`)
  - [ ] XCircle icon from lucide-react
  - [ ] Display: "Critical error: [brief message]"
  - [ ] [View Logs] action button
  - [ ] Never auto-dismiss (require manual dismissal)
  - [ ] Show timestamp of error

- [ ] Task 5: Implement [View Logs] action (AC: #4)
  - [ ] Open log viewer panel
  - [ ] Scroll to error timestamp
  - [ ] Highlight error lines in log view
  - [ ] Include stack trace if available

- [ ] Task 6: Ensure notification delivery priority (AC: #2)
  - [ ] Critical errors bypass any rate limiting
  - [ ] Send to all channels immediately
  - [ ] Log notification delivery status
  - [ ] Retry webhook once on failure (for critical only)

- [ ] Task 7: Handle multiple concurrent errors (AC: #5)
  - [ ] Each error creates separate notification
  - [ ] Stack toasts (max 5 for errors, override normal 3 limit)
  - [ ] Provide "Clear All" option for error toasts
  - [ ] Track error count in header status bar

- [ ] Task 8: Add error context to log viewer (AC: #4)
  - [ ] Store error context with notification
  - [ ] Pass context to log viewer when opened from error toast
  - [ ] Highlight relevant log entries
  - [ ] Show stack trace in expandable section

- [ ] Task 9: Write tests
  - [ ] Test error categorization logic
  - [ ] Test notification service critical error method
  - [ ] Test webhook and Slack payloads
  - [ ] Test CriticalErrorToast component
  - [ ] Test log viewer error highlighting

## Dev Notes

### Critical Implementation Rules

1. **ES Modules Only** - Use `import/export` syntax
2. **No Secrets in Errors** - Sanitize error messages before sending
3. **Fire Immediately** - No batching or debouncing for critical errors

### Error Categories

| Category | Examples | Severity |
|----------|----------|----------|
| **System** | Unhandled exception, memory error | Critical |
| **Database** | Connection failed, query error | Critical |
| **Auth** | Token refresh failed, OAuth error | Critical |
| **Claude** | CLI spawn failed, timeout | Critical |
| **Config** | Parse error, missing required | Critical |
| **Network** | WebSocket disconnect, API timeout | Warning (not critical) |
| **Agent** | Story failed, verification failed | Warning (not critical) |

### Global Error Handler

```javascript
// src/server.js

import { notificationService } from './services/notification.js';

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  notificationService.notifyCriticalError({
    error: error.message,
    code: 'UNHANDLED_REJECTION',
    component: 'process',
    stack: error.stack
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  notificationService.notifyCriticalError({
    error: error.message,
    code: 'UNCAUGHT_EXCEPTION',
    component: 'process',
    stack: error.stack
  });
  // Allow time for notification to send before exit
  setTimeout(() => process.exit(1), 1000);
});

// Express error middleware
app.use((err, req, res, next) => {
  if (isCriticalError(err)) {
    notificationService.notifyCriticalError({
      error: err.message,
      code: err.code || 'SERVER_ERROR',
      component: 'express',
      stack: err.stack,
      route: req.path
    });
  }
  res.status(err.status || 500).json({
    error: sanitizeErrorMessage(err.message),
    code: err.code || 'INTERNAL_ERROR'
  });
});

function isCriticalError(err) {
  const criticalCodes = [
    'DB_CONNECTION_ERROR',
    'AUTH_FAILURE',
    'CLAUDE_SPAWN_FAILED',
    'CONFIG_PARSE_ERROR'
  ];
  return criticalCodes.includes(err.code) || err.critical === true;
}

function sanitizeErrorMessage(message) {
  // Remove any potential secrets from error messages
  return message
    .replace(/token[=:]\s*\S+/gi, 'token=[REDACTED]')
    .replace(/password[=:]\s*\S+/gi, 'password=[REDACTED]')
    .replace(/secret[=:]\s*\S+/gi, 'secret=[REDACTED]');
}
```

### Webhook Payload Schema

```typescript
interface CriticalErrorWebhookPayload {
  type: 'CRITICAL_ERROR';
  error: string;           // Sanitized error message
  code: string;            // Error code for programmatic handling
  component: string;       // Which component failed
  stack?: string;          // Stack trace (if available)
  route?: string;          // API route if applicable
  project?: string;        // Project context if available
  timestamp: string;
  severity: 'critical';
  dashboardUrl: string;
}
```

### Slack Message Format

```
:rotating_light: *CRITICAL ERROR*

*Error:* Database connection failed
*Code:* DB_CONNECTION_ERROR
*Component:* sqlite
*Time:* Jan 15, 2026 12:00:00 PM

```
Error: SQLITE_CANTOPEN: unable to open database file
    at Database.exec (...)
```

<https://claudedash.padaw.ovh/logs|View Logs>
```

### Toast Component

```typescript
// CriticalErrorToast specific props
interface CriticalErrorToastProps {
  error: {
    message: string;
    code: string;
    component: string;
    timestamp: string;
    stack?: string;
  };
  onViewLogs: () => void;
  onDismiss: () => void;
}
```

### Error Context for Log Viewer

```typescript
// When opening log viewer from error toast
interface ErrorContext {
  errorId: string;
  timestamp: string;
  component: string;
  stack?: string;
  // Used to scroll to and highlight relevant logs
  highlightPatterns: string[];
}

// In log viewer
function scrollToError(context: ErrorContext) {
  const targetTime = new Date(context.timestamp);
  // Find log entry closest to error time
  // Scroll into view
  // Apply highlight styling
}
```

### Header Status Integration

Update header to show error count when critical errors occur:

```typescript
// Header shows: "[3 Projects] [8 Agents] [!2 Errors]"
// The error count badge should:
// - Be red with white text
// - Pulse on new error
// - Link to error log/notifications view
```

### File Structure

```
src/
├── server.js               # Add global error handlers
└── services/
    └── notification.js     # Add notifyCriticalError() method

dashboard/src/
├── components/
│   ├── ui/
│   │   └── Toast.tsx       # Add critical error variant
│   └── layout/
│       └── Header.tsx      # Add error count badge
└── stores/
    └── notificationStore.ts # Track error count
```

### References

- [Source: epics.md#Story 5.6] - Original requirements
- [Source: architecture.md#Error Handling Pattern] - Backend error handling
- [Source: project-context.md#Error Handling Pattern] - Frontend error handling
- [Source: ux-design-specification.md#Empty States] - Error UI patterns

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

