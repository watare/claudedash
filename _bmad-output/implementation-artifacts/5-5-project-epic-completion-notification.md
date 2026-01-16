# Story 5.5: Project/Epic Completion Notification

Status: ready-for-dev

## Story

As a **user**,
I want **to be notified when a project or epic completes**,
So that **I know my work is done without checking constantly** (FR49).

## Acceptance Criteria

1. **Given** all stories in an epic complete and verify
   **When** the epic is marked done
   **Then** a gold toast appears: "Epic X complete: [Epic Title]"
   **And** the toast auto-dismisses after 10 seconds

2. **Given** all epics in a project complete
   **When** the project is marked done
   **Then** a persistent gold toast appears: "Project complete: [Project Name]"
   **And** the toast has a [View Summary] action button
   **And** webhook/Slack are notified with completion details

3. **Given** Slack is configured
   **When** project completes
   **Then** Slack message includes:
   - Project name
   - Epic count and story count
   - Duration (start to finish)
   - Link to dashboard

4. **Given** webhook is configured
   **When** epic or project completes
   **Then** webhook receives completion payload with statistics

5. **Given** a completion notification is shown
   **When** I click [View Summary]
   **Then** I am navigated to the project detail view
   **And** summary information is highlighted

## Tasks / Subtasks

- [ ] Task 1: Detect epic completion in orchestrator (AC: #1)
  - [ ] Track story completion status per epic
  - [ ] Check if all stories in epic are verified "done"
  - [ ] Emit `epic:complete` event with epic details
  - [ ] Update sprint-status.yaml epic status to "done"

- [ ] Task 2: Detect project completion in orchestrator (AC: #2)
  - [ ] Track epic completion status per project
  - [ ] Check if all epics (excluding deferred) are "done"
  - [ ] Emit `project:complete` event with project details
  - [ ] Calculate project duration (first story start to last story complete)

- [ ] Task 3: Add completion notifications to notification service (AC: #1, #2)
  - [ ] Create `notifyEpicComplete(data)` method
  - [ ] Create `notifyProjectComplete(data)` method
  - [ ] Include statistics: story count, duration, verification status
  - [ ] Broadcast WebSocket events for dashboard

- [ ] Task 4: Format webhook payloads for completion (AC: #4)
  - [ ] Epic completion payload:
    ```json
    {
      "type": "EPIC_COMPLETE",
      "project": "project-name",
      "epicNumber": 2,
      "epicTitle": "Real-Time Project Monitoring",
      "storyCount": 7,
      "duration": "3d 4h",
      "timestamp": "2026-01-15T12:00:00Z"
    }
    ```
  - [ ] Project completion payload with aggregate stats

- [ ] Task 5: Format Slack messages for completion (AC: #3)
  - [ ] Epic: `:white_check_mark: Epic 2 complete: Real-Time Monitoring`
  - [ ] Project: Full summary with stats and link
  - [ ] Include celebratory emoji for project completion

- [ ] Task 6: Create CompletionToast component (AC: #1, #2)
  - [ ] Gold background styling (`--accent-gold`)
  - [ ] CheckCircle icon from lucide-react
  - [ ] Epic toast: auto-dismiss after 10 seconds
  - [ ] Project toast: persistent until dismissed
  - [ ] [View Summary] action button for project completion

- [ ] Task 7: Implement [View Summary] action (AC: #5)
  - [ ] Navigate to `/projects/:id` route
  - [ ] Highlight or expand completion summary section
  - [ ] Show stats: epics, stories, PRs, duration
  - [ ] Include deployment status if applicable

- [ ] Task 8: Calculate and display completion statistics (AC: #3, #4)
  - [ ] Track project start time (first agent spawn)
  - [ ] Track project end time (last story verified)
  - [ ] Calculate total duration
  - [ ] Count stories by status
  - [ ] Include in notification payloads

- [ ] Task 9: Write tests
  - [ ] Test epic completion detection
  - [ ] Test project completion detection
  - [ ] Test notification service methods
  - [ ] Test webhook and Slack payloads
  - [ ] Test CompletionToast component

## Dev Notes

### Critical Implementation Rules

1. **ES Modules Only** - Use `import/export` syntax
2. **Verification Required** - Only mark complete when verified, not just claimed
3. **WebSocket Format** - Follow `{ type: 'entity:action', data: {...} }` pattern

### Completion Detection Logic

```javascript
// src/orchestrator.js

class CompletionDetector {
  constructor(notificationService, sprintStatus) {
    this.notificationService = notificationService;
    this.sprintStatus = sprintStatus;
    this.projectStartTime = null;
  }

  onStoryVerified(storyId, epicNum) {
    // Check if all stories in epic are done
    const epicStories = this.getEpicStories(epicNum);
    const allDone = epicStories.every(s =>
      this.sprintStatus[s] === 'done'
    );

    if (allDone && !this.epicNotified[epicNum]) {
      this.epicNotified[epicNum] = true;
      this.notificationService.notifyEpicComplete({
        epicNumber: epicNum,
        epicTitle: this.getEpicTitle(epicNum),
        storyCount: epicStories.length,
        project: this.projectName
      });

      // Check if project is complete
      this.checkProjectCompletion();
    }
  }

  checkProjectCompletion() {
    const activeEpics = this.getActiveEpics(); // Exclude deferred
    const allComplete = activeEpics.every(e =>
      this.epicNotified[e]
    );

    if (allComplete && !this.projectNotified) {
      this.projectNotified = true;
      this.notificationService.notifyProjectComplete({
        project: this.projectName,
        epicCount: activeEpics.length,
        storyCount: this.getTotalStoryCount(),
        duration: this.calculateDuration(),
        startTime: this.projectStartTime,
        endTime: new Date().toISOString()
      });
    }
  }
}
```

### Webhook Payloads

**Epic Completion:**
```typescript
interface EpicCompleteWebhookPayload {
  type: 'EPIC_COMPLETE';
  project: string;
  epicNumber: number;
  epicTitle: string;
  storyCount: number;
  storiesCompleted: number;
  duration: string;           // Human-readable: "3d 4h"
  durationMs: number;
  timestamp: string;
  dashboardUrl: string;
}
```

**Project Completion:**
```typescript
interface ProjectCompleteWebhookPayload {
  type: 'PROJECT_COMPLETE';
  project: string;
  epicCount: number;
  storyCount: number;
  duration: string;           // Human-readable: "2w 3d"
  durationMs: number;
  startTime: string;
  endTime: string;
  summary: {
    epicsCompleted: number;
    storiesCompleted: number;
    storiesFailed: number;
    verificationsPassed: number;
  };
  timestamp: string;
  dashboardUrl: string;
}
```

### Slack Message Formats

**Epic Completion:**
```
:white_check_mark: *Epic Complete*

*Project:* bmad-orchestrator
*Epic 2:* Real-Time Project Monitoring
*Stories:* 7 completed
*Duration:* 3d 4h

<https://claudedash.padaw.ovh/projects/bmad-orchestrator|View Project>
```

**Project Completion:**
```
:tada: *Project Complete!*

*bmad-orchestrator* has finished!

:chart_with_upwards_trend: *Summary*
• Epics: 5 completed
• Stories: 32 completed
• Duration: 2 weeks 3 days
• Started: Jan 10, 2026
• Finished: Jan 15, 2026

:rocket: Ready for deployment!

<https://claudedash.padaw.ovh/projects/bmad-orchestrator|View Summary>
```

### Toast Styling

| Type | Auto-dismiss | Background | Icon |
|------|--------------|------------|------|
| Epic | 10 seconds | `--accent-gold` (20%) | CheckCircle |
| Project | Never | `--accent-gold` (30%) | Trophy |

### Project Summary View

When [View Summary] is clicked, navigate to project detail with completion stats:

```typescript
// dashboard/src/pages/ProjectView.tsx
interface CompletionSummary {
  epics: {
    number: number;
    title: string;
    storyCount: number;
    duration: string;
    completedAt: string;
  }[];
  totalDuration: string;
  startTime: string;
  endTime: string;
  stats: {
    totalStories: number;
    passedVerification: number;
    retriesRequired: number;
  };
}
```

### Duration Calculation

```typescript
// dashboard/src/utils/formatters.ts
export function formatProjectDuration(ms: number): string {
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days >= 7) {
    const weeks = Math.floor(days / 7);
    const remainingDays = days % 7;
    return `${weeks}w ${remainingDays}d`;
  }
  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  return `${hours}h`;
}
```

### File Structure

```
src/
├── services/
│   └── notification.js     # Add notifyEpicComplete(), notifyProjectComplete()
└── orchestrator.js         # Add completion detection logic

dashboard/src/
├── components/
│   └── projects/
│       └── CompletionSummary.tsx  # NEW: Summary display component
└── utils/
    └── formatters.ts              # Add formatProjectDuration
```

### References

- [Source: epics.md#Story 5.5] - Original requirements
- [Source: ux-design-specification.md#Journey 5: Project Completion] - User journey
- [Source: ux-design-specification.md#Critical Success Moments] - "Fleet at Work" moment
- [Source: architecture.md#WebSocket Protocol] - Event format

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

