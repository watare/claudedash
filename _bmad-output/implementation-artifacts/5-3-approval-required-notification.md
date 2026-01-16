# Story 5.3: Approval Required Notification

Status: ready-for-dev

## Story

As a **user**,
I want **to be notified when an agent needs my approval**,
So that **I can unblock work quickly** (FR47).

## Acceptance Criteria

1. **Given** an agent reaches an approval checkpoint
   **When** approval is needed
   **Then** a toast notification appears: "Project X: Approval needed"
   **And** the toast has an [Approve] action button
   **And** clicking [Approve] opens the approval modal

2. **Given** webhook is configured
   **When** approval is needed
   **Then** a POST request is sent to webhook_url
   **And** payload includes: project, story, approval_type, timestamp

3. **Given** Slack is configured
   **When** approval is needed
   **Then** a message is sent to the Slack channel
   **And** message includes project name and link to dashboard

4. **Given** an approval notification is shown
   **When** the approval is completed (approved or rejected)
   **Then** the notification is automatically dismissed
   **And** a success/rejection notification replaces it

5. **Given** multiple approvals are pending
   **When** notifications display
   **Then** each approval shows as a separate toast
   **And** toasts are ordered by priority (oldest first)

## Tasks / Subtasks

- [ ] Task 1: Create approval event detector in orchestrator (AC: #1)
  - [ ] Identify approval checkpoints in orchestrator workflow
  - [ ] Create `emitApprovalNeeded(project, story, approvalType, details)` function
  - [ ] Trigger notification service when approval checkpoint reached
  - [ ] Include approval context: type, options, agent recommendation

- [ ] Task 2: Implement approval notification in backend (AC: #2, #3)
  - [ ] Add `notifyApproval(data)` method to notification service
  - [ ] Format webhook payload for approval events:
    ```json
    {
      "type": "APPROVAL_NEEDED",
      "project": "project-name",
      "story": "2-3-story-name",
      "approvalType": "architecture_decision",
      "details": "Database choice: PostgreSQL vs SQLite",
      "timestamp": "2026-01-15T12:00:00Z",
      "dashboardUrl": "https://claudedash.padaw.ovh/projects/X"
    }
    ```
  - [ ] Format Slack message with bell emoji and action link
  - [ ] Broadcast WebSocket event for dashboard

- [ ] Task 3: Create ApprovalModal component (AC: #1)
  - [ ] Create `dashboard/src/components/projects/ApprovalModal.tsx`
  - [ ] Display approval context: type, options, agent recommendation
  - [ ] Include [Approve Recommended] primary button (gold)
  - [ ] Include [Approve Alternative] secondary button if applicable
  - [ ] Include [Reject] destructive button
  - [ ] Handle modal open/close state

- [ ] Task 4: Connect toast action to modal (AC: #1)
  - [ ] Store pending approval data in projectsStore or dedicated approvalStore
  - [ ] Toast [Approve] button opens ApprovalModal with correct data
  - [ ] Pass approval context to modal component

- [ ] Task 5: Implement approval API endpoint (AC: #4)
  - [ ] Create `POST /api/approvals/:id/approve` endpoint
  - [ ] Create `POST /api/approvals/:id/reject` endpoint
  - [ ] Validate approval ID exists and is pending
  - [ ] Update orchestrator state on approval/rejection
  - [ ] Return success response with next action info

- [ ] Task 6: Handle approval completion (AC: #4)
  - [ ] On approval API success, dismiss pending notification
  - [ ] Show success toast: "Approved: {approval_type}"
  - [ ] Resume agent workflow via orchestrator
  - [ ] On rejection, show info toast and update project state

- [ ] Task 7: Handle multiple pending approvals (AC: #5)
  - [ ] Track pending approvals in backend state
  - [ ] Send separate WebSocket notification for each
  - [ ] Order by timestamp (oldest first)
  - [ ] Allow batch operations in future (mark as enhancement)

- [ ] Task 8: Write tests
  - [ ] Test approval notification emission
  - [ ] Test webhook payload format
  - [ ] Test Slack message format
  - [ ] Test ApprovalModal rendering and actions
  - [ ] Test approval API endpoints

## Dev Notes

### Critical Implementation Rules

1. **ES Modules Only** - Use `import/export` syntax
2. **API Response Format** - Use `{ data: {...}, meta: {...} }` for success
3. **WebSocket Format** - Use `{ type: 'entity:action', data: {...} }` pattern

### Approval Types

The orchestrator may request approval for various decisions:

| Type | Description | Options |
|------|-------------|---------|
| `architecture_decision` | Technical choice | Agent recommendation + alternatives |
| `story_completion` | Verify story is done | Approve / Request changes |
| `epic_transition` | Move to next epic | Proceed / Pause |
| `deployment` | Deploy to staging/prod | Deploy / Skip |

### Webhook Payload Schema

```typescript
interface ApprovalWebhookPayload {
  type: 'APPROVAL_NEEDED';
  project: string;
  story?: string;
  approvalType: 'architecture_decision' | 'story_completion' | 'epic_transition' | 'deployment';
  details: string;
  options?: {
    recommended: string;
    alternatives?: string[];
  };
  agentId?: string;
  timestamp: string;
  dashboardUrl: string;
}
```

### Slack Message Format

```
:bell: *Approval Required*

*Project:* bmad-orchestrator
*Story:* 2-3-github-oauth
*Type:* Architecture Decision

Database choice needed:
- *Recommended:* SQLite (agent's choice)
- Alternatives: PostgreSQL, MongoDB

<https://claudedash.padaw.ovh/projects/bmad-orchestrator|View in Dashboard>
```

### ApprovalModal Component

```typescript
// dashboard/src/components/projects/ApprovalModal.tsx
interface ApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  approval: {
    id: string;
    project: string;
    story?: string;
    type: string;
    details: string;
    options?: {
      recommended: string;
      alternatives?: string[];
    };
  };
  onApprove: (choice: string) => Promise<void>;
  onReject: () => Promise<void>;
}
```

### API Endpoints

```
POST /api/approvals/:id/approve
Body: { choice: "recommended" | "alternative_name" }
Response: { data: { status: "approved", resumedAgent: "agent-id" } }

POST /api/approvals/:id/reject
Body: { reason?: "optional rejection reason" }
Response: { data: { status: "rejected" } }
```

### State Management

```typescript
// In projectsStore.ts or dedicated approvalStore.ts
interface ApprovalState {
  pendingApprovals: Approval[];
  isSubmitting: boolean;

  addPendingApproval: (approval: Approval) => void;
  removePendingApproval: (id: string) => void;
  approveDecision: (id: string, choice: string) => Promise<void>;
  rejectDecision: (id: string, reason?: string) => Promise<void>;
}
```

### File Structure

```
src/
└── services/
    └── notification.js     # Add notifyApproval() method

dashboard/src/
├── components/
│   └── projects/
│       ├── ApprovalModal.tsx       # NEW
│       └── ApprovalModal.test.tsx  # NEW
└── stores/
    └── approvalStore.ts            # NEW (or extend projectsStore)
```

### References

- [Source: epics.md#Story 5.3] - Original requirements
- [Source: ux-design-specification.md#Journey 3: Architecture Approval] - User journey
- [Source: architecture.md#API & Communication Patterns] - API format
- [Source: ux-design-specification.md#Notification Toast Component] - Toast styling

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

