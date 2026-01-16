# Story 3.4: Verification Blocking Logic

Status: done

## Story

As a **system**,
I want **progression blocked until status is verified**,
So that **wrong status never cascades to subsequent steps** (FR12).

## Acceptance Criteria

1. **Given** an agent claims completion
   **When** the orchestrator receives the claim
   **Then** it does NOT proceed to the next story/epic
   **And** instead, it triggers status verification first

2. **Given** verification confirms the status
   **When** match is true
   **Then** the orchestrator proceeds to the next step
   **And** logs "Status verified, proceeding"

3. **Given** verification fails after max retries (configurable, default 3)
   **When** mismatch persists
   **Then** the story is marked as "verification_failed"
   **And** user is alerted via notification
   **And** orchestration pauses for that project

## Tasks / Subtasks

- [x] Task 1: Create verification gate in orchestrator (AC: 1)
  - [x] 1.1 Add `verifyBeforeProceeding(storyKey, claimedStatus, projectPath)` function
  - [x] 1.2 Integrate with story completion handler in `orchestrator.js`
  - [x] 1.3 Block next story/epic execution until verification passes
  - [x] 1.4 Return blocking result with verification status

- [x] Task 2: Implement verification-gated progression (AC: 2)
  - [x] 2.1 After verification match, call proceed callback
  - [x] 2.2 Log successful verification with timing
  - [x] 2.3 Update verification result storage with "passed" status
  - [x] 2.4 Clear blocking state for that story

- [x] Task 3: Implement verification failure handling (AC: 3)
  - [x] 3.1 After max retries, mark story as "verification_failed"
  - [x] 3.2 Update sprint-status.yaml with failed status
  - [x] 3.3 Emit WebSocket event for user notification
  - [x] 3.4 Pause orchestration for affected project

- [x] Task 4: Create orchestration pause/resume logic (AC: 3)
  - [x] 4.1 Add `pauseProject(projectId)` function to orchestrator
  - [x] 4.2 Add `resumeProject(projectId)` function for manual recovery
  - [x] 4.3 Track paused state per project
  - [x] 4.4 Prevent new story starts while paused

- [x] Task 5: Integrate with story-worker.js (AC: 1, 2)
  - [x] 5.1 Modify story completion flow to call verification gate
  - [x] 5.2 Add async/await for verification before next story
  - [x] 5.3 Handle verification timeout gracefully

- [x] Task 6: Write unit tests (AC: 1, 2, 3)
  - [x] 6.1 Test blocking behavior - next story waits for verification
  - [x] 6.2 Test successful verification - proceeds
  - [x] 6.3 Test failed verification - pauses and alerts
  - [x] 6.4 Test pause/resume functionality

### Review Follow-ups (AI)

- [ ] [AI-Review][LOW] Add @typedef for `verifyStoryCompletion` return type `{ verified: boolean, reason?: string }` [src/story-worker.js:277-281]
- [ ] [AI-Review][LOW] Standardize section header comment styles across codebase (currently varies between files)
- [ ] [AI-Review][LOW] Add comment to `clearAllProjectStates()` noting it's intended for testing only [src/orchestrator.js:123-128]
- [ ] [AI-Review][LOW] Consider adding overall timeout parameter to `verifyBeforeProceeding()` to cap total blocking time [src/services/verification.js:665]

## Dev Notes

### Critical Implementation Requirements

**ES Modules - MANDATORY:**
```javascript
// CORRECT - ES Modules with .js extension
import { compareStatus, triggerReVerification, storeVerificationResult } from './services/verification.js';
import { updateSprintStatus } from './parser.js';

export async function verifyBeforeProceeding(storyKey, claimedStatus, projectPath) { ... }
```

**Integration Points:**
- `src/orchestrator.js` - Main orchestration logic (add verification gate)
- `src/story-worker.js` - Story execution (call verification before next)
- `src/services/verification.js` - Verification functions (from Stories 3.1-3.3)
- `src/parser.js` - YAML update functions

### Architecture Compliance

**Verification Gate Flow:**
```
Story Agent Claims "done"
         ↓
verifyBeforeProceeding()
         ↓
compareStatus() [Story 3.2]
         ↓
   ┌─────┴─────┐
   │           │
 MATCH      MISMATCH
   │           │
   ↓           ↓
Proceed    triggerReVerification() [Story 3.3]
   │           │
   │      ┌────┴────┐
   │      │         │
   │   RESOLVED   FAILED (max retries)
   │      │         │
   │      ↓         ↓
   └───→ Proceed   PAUSE + ALERT
```

**Verification Gate Function:**
```javascript
/**
 * Verification gate - blocks progression until status verified
 */
export async function verifyBeforeProceeding(storyKey, claimedStatus, projectPath) {
  const yamlPath = path.join(projectPath, '_bmad-output/implementation-artifacts/sprint-status.yaml');

  // Step 1: Compare status
  const result = await compareStatus(storyKey, claimedStatus, yamlPath);

  if (result.match) {
    console.log(chalk.green(`[VERIFY] Status verified for ${storyKey}, proceeding`));
    return { proceed: true, result };
  }

  // Step 2: Attempt re-verification
  console.log(chalk.yellow(`[VERIFY] Mismatch detected for ${storyKey}, triggering re-verification`));
  const reVerifyResult = await triggerReVerification(storyKey, result);

  if (reVerifyResult.resolved) {
    console.log(chalk.green(`[VERIFY] Re-verification resolved for ${storyKey}, proceeding`));
    return { proceed: true, result: reVerifyResult };
  }

  // Step 3: Max retries exceeded - pause and alert
  console.log(chalk.red(`[VERIFY] Verification failed for ${storyKey} after ${reVerifyResult.attempts} attempts`));
  return { proceed: false, result: reVerifyResult, action: 'pause' };
}
```

### Project Pause State Management

**Pause state pattern:**
```javascript
// In orchestrator.js or a separate state module
const projectStates = new Map();

export function pauseProject(projectId, reason) {
  projectStates.set(projectId, {
    status: 'paused',
    pausedAt: new Date().toISOString(),
    reason,
    pausedBy: 'verification_system'
  });

  // Emit WebSocket event
  broadcastEvent({
    type: 'project:paused',
    data: { projectId, reason }
  });
}

export function resumeProject(projectId) {
  const state = projectStates.get(projectId);
  if (state?.status === 'paused') {
    projectStates.set(projectId, {
      status: 'running',
      resumedAt: new Date().toISOString()
    });
    broadcastEvent({
      type: 'project:resumed',
      data: { projectId }
    });
    return true;
  }
  return false;
}

export function isProjectPaused(projectId) {
  return projectStates.get(projectId)?.status === 'paused';
}
```

### Integration with story-worker.js

**Modify story completion handler:**
```javascript
// In story-worker.js - after story completes
async function handleStoryCompletion(story, projectPath) {
  const claimedStatus = 'done'; // or whatever the story claims

  const verification = await verifyBeforeProceeding(
    story.slug,
    claimedStatus,
    projectPath
  );

  if (!verification.proceed) {
    // Pause the project - don't start next story
    pauseProject(story.projectId, `Verification failed for ${story.slug}`);
    return { success: false, reason: 'verification_failed' };
  }

  // Proceed to next story
  return { success: true };
}
```

### Library & Framework Requirements

**Dependencies (already installed):**
- `chalk` (5.3.x) - Colored logging
- Uses verification functions from previous stories

**No new dependencies required.**

### File Structure Requirements

**Files to modify:**
- `src/orchestrator.js` - Add pause/resume functions
- `src/story-worker.js` - Add verification gate call
- `src/services/verification.js` - Add `verifyBeforeProceeding()` export

**Function signatures to implement:**
```javascript
/**
 * Verification gate - blocks until verified
 * @param {string} storyKey
 * @param {string} claimedStatus
 * @param {string} projectPath
 * @returns {Promise<VerificationGateResult>}
 */
export async function verifyBeforeProceeding(storyKey, claimedStatus, projectPath)

/**
 * Pause project orchestration
 * @param {string} projectId
 * @param {string} reason
 */
export function pauseProject(projectId, reason)

/**
 * Resume paused project
 * @param {string} projectId
 * @returns {boolean} - true if resumed, false if wasn't paused
 */
export function resumeProject(projectId)

/**
 * Check if project is paused
 * @param {string} projectId
 * @returns {boolean}
 */
export function isProjectPaused(projectId)
```

**VerificationGateResult type:**
```typescript
interface VerificationGateResult {
  proceed: boolean;
  result: VerificationResult | ReVerificationResult;
  action?: 'pause' | 'retry' | 'proceed';
}
```

### Testing Requirements

**Test file:** `src/services/verification.test.js` and `src/__tests__/orchestrator.test.js`

**Test scenarios:**
1. Verification gate blocks while verifying
2. Matching status - returns `proceed: true`
3. Mismatch resolved by re-verification - returns `proceed: true`
4. Mismatch persists - returns `proceed: false, action: 'pause'`
5. Pause project - sets paused state
6. Resume project - clears paused state
7. isProjectPaused returns correct state

### WebSocket Events

**Events to emit:**
```javascript
// When verification succeeds
{ type: 'story:verified', data: { storyKey, status, timestamp } }

// When verification fails and project pauses
{ type: 'story:verification_failed', data: { storyKey, attempts, claimed, actual } }
{ type: 'project:paused', data: { projectId, reason, pausedAt } }

// When project resumes
{ type: 'project:resumed', data: { projectId, resumedAt } }
```

### Project Structure Notes

- Modifies: `src/orchestrator.js` - Add project state management
- Modifies: `src/story-worker.js` - Add verification gate call
- Extends: `src/services/verification.js` - Add verifyBeforeProceeding export
- Test files: Co-located with source files

### Dependencies on Previous Stories

- **Story 3.1 REQUIRED:** `readYamlStatus()` must exist
- **Story 3.2 REQUIRED:** `compareStatus()` must exist
- **Story 3.3 REQUIRED:** `triggerReVerification()` must exist

### References

- [Source: architecture.md#Status Verification] - Verification state machine
- [Source: orchestrator.js] - Existing orchestration logic
- [Source: story-worker.js] - Story execution flow
- [Source: epics.md#Story 3.4] - Original acceptance criteria
- [Source: architecture.md#WebSocket Message Format] - Event structure

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A - Implementation completed without issues.

### Completion Notes List

- Implemented `verifyBeforeProceeding()` function in `src/services/verification.js` as the main verification gate entry point
- Added project state management (pause/resume) functions to `src/orchestrator.js`
- Added WebSocket event emitters (`emitStoryVerificationFailed`, `emitProjectPaused`, `emitProjectResumed`) to `src/services/websocket.js`
- Integrated verification gate into `StoryWorker.run()` flow with new `verifyStoryCompletion()` method
- Modified `runStoriesParallel()` to check project paused state before starting each story
- All 197 tests pass including 26 new tests for Story 3.4 functionality
- Follows ES Modules pattern as required by project standards
- Uses existing `compareStatus()` and `triggerReVerification()` from Stories 3.2-3.3

### File List

- src/services/verification.js (modified - added `verifyBeforeProceeding()` function)
- src/services/verification.test.js (modified - added 6 tests for `verifyBeforeProceeding`)
- src/orchestrator.js (modified - added pause/resume state management functions)
- src/orchestrator.test.js (new - 20 tests for pause/resume functionality)
- src/story-worker.js (modified - integrated verification gate into story flow)
- src/services/websocket.js (modified - added 3 new event emitter functions)

### Senior Developer Review (AI)

**Review Date:** 2026-01-16
**Reviewer:** Claude Opus 4.5 (Adversarial Code Review)
**Outcome:** APPROVED with action items

**Summary:**
- All 3 Acceptance Criteria verified as IMPLEMENTED
- All 6 Tasks (24 subtasks) verified as DONE - claims match code evidence
- All 197 tests pass including 26 new tests for Story 3.4
- Git vs Story File List: 1 discrepancy (unrelated pre-existing change to bmad-orchestrator.service)

**Issues Found:** 0 High, 3 Medium (fixed), 4 Low (action items created)

**Fixes Applied:**
1. Added clarifying comment for 'review' status verification in story-worker.js:75-77
2. Added documentation for queue behavior on pause in story-worker.js:349-354
3. Added JSDoc note about skipSubprocess testing pattern in verification.js:655-661

**Action Items:** 4 LOW issues added to Tasks section for future cleanup

### Change Log

- 2026-01-16: Code review completed - APPROVED with 4 action items (Claude Opus 4.5)
- 2026-01-16: Story 3.4 implemented - Verification blocking logic with project pause/resume (Claude Opus 4.5)
