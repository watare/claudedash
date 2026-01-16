# Story 5.1: Notification Service Backend

Status: ready-for-dev

## Story

As a **system**,
I want **a notification service that routes events to configured channels**,
So that **important events reach the user regardless of dashboard state** (FR51).

## Acceptance Criteria

1. **Given** a notifiable event occurs (approval needed, stuck agent, completion, error)
   **When** the notification service receives it
   **Then** it routes to all configured channels
   **And** channels include: console (always), dashboard (always), webhook (if configured), Slack (if configured)

2. **Given** notification configuration exists in secrets file
   **When** the service initializes
   **Then** it reads webhook_url and slack_webhook_url if present
   **And** validates URLs are reachable (non-blocking validation)

3. **Given** a webhook is configured
   **When** a notification is sent
   **Then** an HTTP POST is made to the webhook URL
   **And** the payload includes: type, project, story (if applicable), message, timestamp

4. **Given** a Slack webhook is configured
   **When** a notification is sent
   **Then** a properly formatted Slack message is posted
   **And** the message includes appropriate emoji for notification type

5. **Given** a channel fails to deliver
   **When** the failure occurs
   **Then** the error is logged
   **And** other channels continue to receive notifications
   **And** delivery is not retried (fire-and-forget)

## Tasks / Subtasks

- [ ] Task 1: Create notification service module (AC: #1)
  - [ ] Create `src/services/notification.js` file
  - [ ] Define notification event types enum: `APPROVAL_NEEDED`, `AGENT_STUCK`, `PROJECT_COMPLETE`, `EPIC_COMPLETE`, `CRITICAL_ERROR`, `INFO`
  - [ ] Create `NotificationService` class with `send(event)` method
  - [ ] Implement channel routing logic (console, dashboard, webhook, slack)

- [ ] Task 2: Implement console channel (AC: #1)
  - [ ] Always log notifications to console with chalk formatting
  - [ ] Use appropriate colors: gold for completion, red for errors, yellow for warnings
  - [ ] Include timestamp and event type in log output

- [ ] Task 3: Implement dashboard channel via WebSocket (AC: #1)
  - [ ] Create WebSocket broadcast method for notifications
  - [ ] Send `{ type: 'notification:new', data: { ... } }` message format
  - [ ] Include notification type, message, actions (if any), timestamp

- [ ] Task 4: Load webhook configuration (AC: #2)
  - [ ] Read `webhook_url` from secrets config file
  - [ ] Read `slack_webhook_url` from secrets config file
  - [ ] Validate URLs on startup (log warning if unreachable, don't block)
  - [ ] Store configuration in service instance

- [ ] Task 5: Implement webhook channel (AC: #3)
  - [ ] Use native fetch for HTTP POST requests
  - [ ] Send JSON payload: `{ type, project, story, message, timestamp }`
  - [ ] Set appropriate headers: `Content-Type: application/json`
  - [ ] Handle errors without blocking other channels

- [ ] Task 6: Implement Slack channel (AC: #4)
  - [ ] Format message for Slack incoming webhook
  - [ ] Include emoji based on notification type:
    - Approval: `:bell:`
    - Stuck: `:warning:`
    - Complete: `:white_check_mark:`
    - Error: `:x:`
  - [ ] Include project name, story reference, and action URL if applicable

- [ ] Task 7: Implement error handling (AC: #5)
  - [ ] Wrap each channel in try-catch
  - [ ] Log errors with channel name and error message
  - [ ] Use Promise.allSettled for parallel channel delivery
  - [ ] Never throw from the send method (fire-and-forget pattern)

- [ ] Task 8: Export and integrate
  - [ ] Export singleton instance from `src/services/notification.js`
  - [ ] Create convenience methods: `notifyApproval()`, `notifyStuck()`, `notifyComplete()`, `notifyError()`
  - [ ] Document usage in module JSDoc

## Dev Notes

### Critical Implementation Rules

1. **ES Modules Only** - Use `import/export` syntax, never `require/module.exports`
2. **File Extensions** - Include `.js` extension in local imports: `import { x } from './file.js'`
3. **Fire-and-Forget** - Notification failures must never block orchestration flow
4. **No Secrets in Logs** - Never log webhook URLs or tokens

### API Response Format

The notification service should follow the project's WebSocket message format:

```javascript
// WebSocket notification message
{
  type: 'notification:new',
  data: {
    id: 'uuid',
    type: 'APPROVAL_NEEDED' | 'AGENT_STUCK' | 'PROJECT_COMPLETE' | 'EPIC_COMPLETE' | 'CRITICAL_ERROR' | 'INFO',
    title: 'Approval Required',
    message: 'Project X needs architecture decision approval',
    project: 'project-name',
    story: '2-3-feature-name', // optional
    actions: [{ label: 'Approve', action: 'approve' }], // optional
    timestamp: '2026-01-15T12:00:00Z'
  },
  timestamp: '2026-01-15T12:00:00Z'
}
```

### Secrets Configuration

The notification service reads from `bmad-orchestrator.secrets.yaml`:

```yaml
# Notification channels (optional)
webhook_url: "https://your-webhook.example.com/notify"
slack_webhook_url: "https://hooks.slack.com/services/XXX/YYY/ZZZ"
```

### Webhook Payload Format

```json
{
  "type": "APPROVAL_NEEDED",
  "project": "bmad-orchestrator",
  "story": "2-3-oauth-setup",
  "message": "Architecture decision approval needed: Database choice",
  "timestamp": "2026-01-15T12:00:00Z",
  "dashboardUrl": "https://claudedash.padaw.ovh/projects/bmad-orchestrator"
}
```

### Slack Message Format

```json
{
  "text": ":bell: *Approval Required*\n*Project:* bmad-orchestrator\n*Story:* 2-3-oauth-setup\nArchitecture decision approval needed: Database choice\n<https://claudedash.padaw.ovh|View Dashboard>"
}
```

### File Location

```
src/
└── services/
    └── notification.js    # NEW: Notification service
```

### Dependencies

The notification service uses only built-in Node.js features:
- `fetch` (native in Node 18+)
- No external HTTP libraries needed

### Project Structure Notes

- Service follows singleton pattern for easy import throughout codebase
- Integrates with existing WebSocket server in `src/server.js`
- Reads config from existing `src/config.js` module

### References

- [Source: architecture.md#API & Communication Patterns] - WebSocket message format
- [Source: architecture.md#Project Structure & Boundaries] - File location in src/services/
- [Source: project-context.md#WebSocket Message Format] - Message type conventions
- [Source: epics.md#Story 5.1] - Original requirements
- [Source: ux-design-specification.md#Notification Toast Component] - UI expectations for notifications

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

