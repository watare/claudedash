# Story 3.2: Status Comparison Engine

Status: done

## Story

As a **system**,
I want **to compare agent-claimed status against YAML file status**,
So that **mismatches are detected before proceeding** (FR9, FR10).

## Acceptance Criteria

1. **Given** an agent claims a story is "done"
   **When** the verification service compares with YAML
   **Then** it reads the actual status from sprint-status.yaml
   **And** returns: `{ claimed: "done", actual: "done", match: true }` or `{ claimed: "done", actual: "in-progress", match: false }`

2. **Given** a status mismatch is detected
   **When** the comparison completes
   **Then** the mismatch is logged with story ID, claimed status, actual status, timestamp
   **And** the verification result is stored for UI display

## Tasks / Subtasks

- [x] Task 1: Create comparison engine function (AC: 1)
  - [x] 1.1 Add `compareStatus(storyKey, claimedStatus, yamlFilePath)` to `src/services/verification.js`
  - [x] 1.2 Use `readYamlStatus()` from Story 3.1 to get actual status
  - [x] 1.3 Return structured comparison result object
  - [x] 1.4 Handle edge cases (missing story in YAML, file not found)

- [x] Task 2: Implement mismatch detection logic (AC: 1, 2)
  - [x] 2.1 Normalize status strings before comparison (lowercase, trim)
  - [x] 2.2 Handle status aliases (e.g., "complete" vs "done")
  - [x] 2.3 Determine if mismatch is critical (blocking) vs informational

- [x] Task 3: Create verification result storage (AC: 2)
  - [x] 3.1 Create in-memory store for verification results (Map)
  - [x] 3.2 Store: `{ storyKey, claimed, actual, match, timestamp, attemptCount }`
  - [x] 3.3 Implement `getVerificationResult(storyKey)` to retrieve stored results
  - [x] 3.4 Implement `clearVerificationResult(storyKey)` for cleanup

- [x] Task 4: Implement logging for mismatches (AC: 2)
  - [x] 4.1 Log mismatches with chalk styling (red for mismatch, green for match)
  - [x] 4.2 Include story ID, claimed status, actual status, timestamp in log
  - [x] 4.3 Log at appropriate level (warn for mismatch, info for match)

- [x] Task 5: Write unit tests (AC: 1, 2)
  - [x] 5.1 Test matching status comparison
  - [x] 5.2 Test mismatching status comparison
  - [x] 5.3 Test status normalization (case, aliases)
  - [x] 5.4 Test verification result storage and retrieval

### Review Follow-ups (AI)

- [ ] [AI-Review][MEDIUM] Commit test file changes - 17 Story 3.2 tests (276 lines) are uncommitted [src/services/verification.test.js]
- [ ] [AI-Review][MEDIUM] Enhance `getAllStatuses()` to filter metadata strings from status strings - currently includes any string value like `project: "test"` [verification.js:305-310]

## Dev Notes

### Critical Implementation Requirements

**ES Modules - MANDATORY:**
```javascript
// CORRECT - ES Modules
import { readYamlStatus, getStoryStatus } from './verification.js';
export function compareStatus(storyKey, claimedStatus, yamlFilePath) { ... }

// WRONG - No .js extension will break
import { readYamlStatus } from './verification';
```

**Build on Story 3.1:**
This story extends `src/services/verification.js` created in Story 3.1. Add to the existing module, don't create a new file.

### Architecture Compliance

**Comparison Result Structure:**
```javascript
// Verification result object structure
{
  storyKey: '3-1-yaml-status-reader-service',
  claimed: 'done',
  actual: 'in-progress',
  match: false,
  timestamp: '2026-01-15T12:00:00Z',
  attemptCount: 1,
  lastChecked: '2026-01-15T12:00:00Z'
}
```

**Status Normalization Rules:**
```javascript
const STATUS_ALIASES = {
  'complete': 'done',
  'completed': 'done',
  'finished': 'done',
  'pending': 'backlog',
  'todo': 'backlog',
  'wip': 'in-progress',
  'working': 'in-progress'
};

function normalizeStatus(status) {
  const normalized = status?.toLowerCase()?.trim() || 'unknown';
  return STATUS_ALIASES[normalized] || normalized;
}
```

### In-Memory Storage Pattern

**Use Map for verification results:**
```javascript
// Module-level storage (private)
const verificationResults = new Map();

export function storeVerificationResult(storyKey, result) {
  verificationResults.set(storyKey, {
    ...result,
    timestamp: new Date().toISOString()
  });
}

export function getVerificationResult(storyKey) {
  return verificationResults.get(storyKey) || null;
}

export function clearVerificationResult(storyKey) {
  verificationResults.delete(storyKey);
}

export function getAllVerificationResults() {
  return new Map(verificationResults);
}
```

### Library & Framework Requirements

**Dependencies (already installed, no new deps needed):**
- `js-yaml` (4.1.x) - Via Story 3.1's readYamlStatus
- `chalk` (5.3.x) - Colored logging for mismatches

### File Structure Requirements

**Function signatures to implement:**
```javascript
/**
 * Compare claimed status against actual YAML status
 * @param {string} storyKey - Story identifier (e.g., '3-1-yaml-status-reader-service')
 * @param {string} claimedStatus - Status the agent claims
 * @param {string} yamlFilePath - Path to sprint-status.yaml
 * @returns {Promise<VerificationResult>}
 */
export async function compareStatus(storyKey, claimedStatus, yamlFilePath)

/**
 * Store verification result for later retrieval
 * @param {string} storyKey
 * @param {VerificationResult} result
 */
export function storeVerificationResult(storyKey, result)

/**
 * Get stored verification result
 * @param {string} storyKey
 * @returns {VerificationResult|null}
 */
export function getVerificationResult(storyKey)

/**
 * Clear verification result
 * @param {string} storyKey
 */
export function clearVerificationResult(storyKey)
```

**VerificationResult type:**
```typescript
interface VerificationResult {
  storyKey: string;
  claimed: string;
  actual: string;
  match: boolean;
  timestamp: string;
  attemptCount: number;
  error?: string;
}
```

### Testing Requirements

**Test file:** `src/services/verification.test.js` (add to existing from Story 3.1)

**Test scenarios:**
1. Compare matching statuses - returns `match: true`
2. Compare mismatching statuses - returns `match: false`
3. Status normalization - "Complete" matches "done"
4. Missing story in YAML - returns `actual: 'unknown'`
5. Store and retrieve verification result
6. Clear verification result
7. Multiple verification attempts increment attemptCount

### Logging Output Examples

```
// Match case
[VERIFY] Story 3-1-yaml-status-reader-service: MATCH (in-progress)

// Mismatch case (highlighted in red)
[VERIFY] Story 3-1-yaml-status-reader-service: MISMATCH
  Claimed: done
  Actual:  in-progress
  Action:  Blocking progression until resolved
```

### Project Structure Notes

- Extends: `src/services/verification.js` from Story 3.1
- Test file: `src/services/verification.test.js` (co-located, add new tests)
- No new files needed - all additions to existing verification module

### Dependencies on Previous Stories

- **Story 3.1 REQUIRED:** `readYamlStatus()` and `getStoryStatus()` must exist before implementing this story

### References

- [Source: architecture.md#Data Architecture] - In-memory state pattern
- [Source: architecture.md#Process Patterns] - Error handling patterns
- [Source: parser.js:91-106] - YAML parsing pattern reference
- [Source: epics.md#Story 3.2] - Original acceptance criteria
- [Source: project-context.md#Error Handling Pattern] - Async handler pattern

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A - No debug issues encountered during implementation.

### Completion Notes List

- Implemented `normalizeStatus()` function with STATUS_ALIASES map for case-insensitive comparison and alias mapping (complete→done, wip→in-progress, pending→backlog, etc.)
- Implemented `compareStatus()` async function that reads YAML status via `readYamlStatus()` from Story 3.1, normalizes both claimed and actual statuses, and returns structured comparison result with attemptCount tracking
- Implemented in-memory Map storage with `storeVerificationResult()`, `getVerificationResult()`, `clearVerificationResult()`, `getAllVerificationResults()`, and `clearAllVerificationResults()` functions
- Implemented chalk-styled logging: green for MATCH, red for MISMATCH with detailed output including claimed/actual/action fields
- Added 17 new unit tests covering:
  - Status normalization (lowercase, trimming, aliases, unknown values)
  - Status comparison (matching, mismatching, case-insensitive, aliases)
  - Missing story/file handling
  - Attempt count tracking
  - Verification result storage (store, retrieve, clear, get all, update)
- All 161 tests pass (17 new tests added to 144 existing)

### File List

- `src/services/verification.js` - Extended with comparison engine functions (normalizeStatus, compareStatus, storeVerificationResult, getVerificationResult, clearVerificationResult, getAllVerificationResults, clearAllVerificationResults)
- `src/services/verification.test.js` - Added 17 new tests for Story 3.2 functionality (total: 31 tests in file)

### Change Log

- 2026-01-16: Code review discovered Story 3.2 was never implemented - all tasks marked complete but zero code existed
- 2026-01-16: Fixed by implementing full Story 3.2 functionality during adversarial code review session
- 2026-01-16: Code review (adversarial) - Found 5 issues (0 CRITICAL, 0 HIGH, 3 MEDIUM, 2 LOW)
  - Fixed: Added JSDoc @typedef for VerificationResult type [verification.js:9-19]
  - Action items created: 2 MEDIUM issues for future resolution
  - All 31 verification tests pass
