# Story 4.1: Kill Agent API & Backend

Status: done

## Story

As a **system**,
I want **an API endpoint to forcibly terminate a Claude instance**,
So that **stuck agents can be stopped without SSH access** (FR44).

## Acceptance Criteria

**AC1: Basic Kill Endpoint**
**Given** an agent is running
**When** `POST /api/agents/:id/kill` is called
**Then** the Claude subprocess is terminated via SIGTERM
**And** if not terminated within 5 seconds, SIGKILL is sent
**And** the agent status is updated to "killed"
**And** the action is logged in audit_log

**AC2: Agent Not Found**
**Given** the agent ID doesn't exist
**When** the kill endpoint is called
**Then** a 404 error is returned with message "Agent not found"

**AC3: WebSocket Broadcast**
**Given** an agent is killed
**When** the kill succeeds
**Then** a WebSocket event broadcasts `{ type: "agent:kill", data: { agentId, status: "killed" } }`
**And** all connected dashboard clients receive the update

## Tasks / Subtasks

- [x] Task 1: Implement agent tracking registry (AC: 1, 2)
  - [x] 1.1: Create `src/services/agentRegistry.js` with Map-based agent tracking
  - [x] 1.2: Export methods: `registerAgent(id, process)`, `getAgent(id)`, `removeAgent(id)`, `getAllAgents()`
  - [x] 1.3: Store agent metadata: id, pid, storyId, projectId, startedAt, lastActivity, status
- [x] Task 2: Implement kill agent service (AC: 1)
  - [x] 2.1: Create `src/services/agentKiller.js` with graceful termination logic
  - [x] 2.2: Implement SIGTERM with 5-second timeout, fallback to SIGKILL
  - [x] 2.3: Return kill result object: { success, agentId, method: 'SIGTERM'|'SIGKILL', timestamp }
- [x] Task 3: Create REST API endpoint (AC: 1, 2)
  - [x] 3.1: Add `POST /api/agents/:id/kill` route in `src/api/agents.js`
  - [x] 3.2: Validate agent exists, return 404 if not found
  - [x] 3.3: Call agentKiller service, return result
  - [x] 3.4: Use asyncHandler pattern for error handling
- [x] Task 4: Implement audit logging (AC: 1)
  - [x] 4.1: Insert record in audit_log table on kill action
  - [x] 4.2: Log fields: timestamp, user, action='agent:kill', project, details={agentId, method, reason}
- [x] Task 5: Add WebSocket broadcast (AC: 3)
  - [x] 5.1: After successful kill, broadcast via existing WebSocket server
  - [x] 5.2: Message format: `{ type: "agent:kill", data: { agentId, status: "killed", timestamp } }`
- [x] Task 6: Integrate with claude-runner.js (AC: 1)
  - [x] 6.1: Modify `runClaude()` to register spawned process with agentRegistry
  - [x] 6.2: On process exit, auto-remove from registry
- [x] Task 7: Write unit tests
  - [x] 7.1: Test agentRegistry CRUD operations
  - [x] 7.2: Test kill service with mock processes
  - [x] 7.3: Test API endpoint responses (200, 404 cases)

### Review Follow-ups (AI)

- [ ] [AI-Review][LOW] Inconsistent WebSocket event names: `agent:kill` vs `agent:killed` - standardize on one convention (recommend past tense: `agent:killed`) [src/services/websocket.js, src/services/agents.js]
- [ ] [AI-Review][LOW] Missing JSDoc return type on `formatAgentData` function [src/services/agents.js:59-74]

## Dev Notes

### Architecture Compliance

**File Structure (from Architecture doc):**
```
src/
├── api/
│   └── agents.js          # NEW: REST routes for agent operations
├── services/
│   ├── agentRegistry.js   # NEW: Agent process tracking
│   └── agentKiller.js     # NEW: Kill logic with graceful termination
└── claude-runner.js       # MODIFY: Register spawned processes
```

**API Response Format (MUST USE):**
```javascript
// Success
res.json({ data: { agentId, status: 'killed', method: 'SIGTERM' }, meta: { timestamp } });

// Error
res.status(404).json({ error: 'Agent not found', code: 'AGENT_NOT_FOUND' });
```

### Existing Code Patterns

**From `src/server.js` (lines 139-246):**
- Routes defined in `setupRoutes()` method
- Uses `express.json()` middleware
- WebSocket broadcast via `this.broadcast({ type, data })`
- State tracked in `this.state` object

**From `src/claude-runner.js` (lines 9-88):**
- Uses `execa` for subprocess management
- Processes have `exitCode`, `all` (combined stdout/stderr)
- Timeout handled via execa options

**WebSocket Message Format (from project-context.md):**
```javascript
{ type: 'agent:kill', data: { agentId: '1-3', status: 'killed' }, timestamp: '2026-01-15T12:00:00Z' }
```

### Critical Implementation Details

**ES Modules Required:**
```javascript
// CORRECT
import { execa } from 'execa';
export function killAgent() {}

// WRONG - DO NOT USE
const execa = require('execa');
module.exports = killAgent;
```

**Graceful Kill Logic:**
```javascript
async function killAgent(pid) {
  process.kill(pid, 'SIGTERM');

  // Wait 5 seconds for graceful termination
  const terminated = await waitForExit(pid, 5000);

  if (!terminated) {
    process.kill(pid, 'SIGKILL');
    return { method: 'SIGKILL' };
  }
  return { method: 'SIGTERM' };
}
```

**Async Route Handler Pattern:**
```javascript
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

app.post('/api/agents/:id/kill', asyncHandler(async (req, res) => {
  // Implementation here
}));
```

### Database Schema (audit_log)

From Architecture doc - `src/db/migrations/002_audit_log.sql`:
```sql
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  user TEXT,
  action TEXT NOT NULL,
  project TEXT,
  details TEXT -- JSON string
);
```

### Anti-Patterns to Avoid

1. **DO NOT** use CommonJS require/exports
2. **DO NOT** use synchronous process.kill without timeout handling
3. **DO NOT** store agents in global variables - use proper service module
4. **DO NOT** forget file extension in imports: `import { x } from './service.js'`
5. **DO NOT** return inconsistent API response formats

### Testing Guidance

**Test File Location:** `src/services/__tests__/agentKiller.test.js` (co-located)

**Mock Process for Testing:**
```javascript
import { jest } from '@jest/globals';

const mockProcess = {
  pid: 12345,
  kill: jest.fn(),
  on: jest.fn((event, cb) => { if (event === 'exit') setTimeout(cb, 100); }),
};
```

### References

- [Source: architecture.md#API-Patterns] - REST endpoint structure
- [Source: architecture.md#Implementation-Patterns] - Naming conventions
- [Source: project-context.md#WebSocket-Message-Format] - Event format
- [Source: src/server.js:139-246] - Existing route setup pattern
- [Source: src/claude-runner.js:9-88] - Subprocess management

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5

### Debug Log References

N/A

### Completion Notes List

- Created `src/services/agentRegistry.js` with Map-based agent process tracking including PID storage
- Created `src/services/agentKiller.js` with graceful termination (SIGTERM -> 5s wait -> SIGKILL)
- Added `POST /api/agents/:id/kill` endpoint to `src/api/agents.js` with proper 404 handling
- Created `src/db/agentLogs.js` for audit log insertion of agent kill actions
- Added `killAgentById` function to `src/services/agents.js` with audit logging and WebSocket broadcast
- Modified `src/claude-runner.js` to register subprocess with agentRegistry on spawn and cleanup on exit
- Created comprehensive unit tests: 18 tests for agentRegistry, 5 tests for agentKiller, 10 tests for kill API endpoint
- All 299 tests pass with no regressions

### File List

- src/services/agentRegistry.js (NEW)
- src/services/agentKiller.js (NEW)
- src/services/agentKiller.integration.test.js (NEW - added by review)
- src/db/agentLogs.js (NEW)
- src/services/agentRegistry.test.js (NEW)
- src/services/agentKiller.test.js (NEW)
- src/api/agents.js (MODIFIED - added kill endpoint)
- src/api/agents.test.js (MODIFIED - added kill endpoint tests)
- src/services/agents.js (MODIFIED - added killAgentById function)
- src/claude-runner.js (MODIFIED - subprocess registration, removed duplicate WebSocket broadcast)

## Change Log

- 2026-01-16: Story 4.1 implementation complete - Kill Agent API & Backend with all acceptance criteria met
- 2026-01-16: Code review fixes applied:
  - Fixed duplicate WebSocket broadcast (removed emitAgentKilled from claude-runner.js, kept AC3-compliant broadcast in agents.js)
  - Removed unnecessary async declarations from agentLogs.js (better-sqlite3 is synchronous)
  - Added integration tests for real subprocess termination (agentKiller.integration.test.js)
  - All 340 tests pass
