---
title: 'Fix Stuck Agent, Multi-Project, and Log Panel Bugs'
slug: 'fix-multi-project-logs-stuck-agent'
created: '2026-01-18'
status: 'pr1-completed-reviewed'
stepsCompleted: [1, 2, 3, 4]
tech_stack: [Node.js 18+, Express 4.18, ES Modules, WebSocket (ws), React 19, Zustand 5]
files_to_modify:
  - src/claude-runner.js
  - src/server.js
  - src/services/websocket.js
code_patterns:
  - ES Modules only (no CommonJS)
  - Include .js extension in local imports
  - API response format: { data, meta } or { error, code, details }
  - WebSocket message format: { type: 'entity:action', data, timestamp }
  - Class-based server architecture
test_patterns:
  - Co-located tests (file.test.js next to file.js)
  - No separate __tests__ folders
---

# Tech-Spec: Fix Stuck Agent, Multi-Project, and Log Panel Bugs

**Created:** 2026-01-18

## Overview

### Problem Statement

Three bugs are affecting orchestration, **prioritized by severity:**

1. **🔴 P0 CRITICAL - Stuck Agent:** The `waitingForAI` flag in claude-runner.js blocks indefinitely when Supervisor AI calls hang, causing agents to appear stuck with no recovery. **This is a blocking bug that stops production.**

2. **🟡 P1 - Multi-Project Blocking:** The backend incorrectly blocks launching multiple projects simultaneously due to a singleton `isRunning` boolean flag.

3. **🟡 P1 - Empty Log Panel:** Agent output is broadcast via WebSocket but never persisted to `server.logs[]`.

### Solution

**Two-PR Strategy (recommended by team review):**

- **PR 1 (Critical - ship immediately):** Fix stuck agent deadlock (Tasks 1-5)
- **PR 2 (Improvement - ship when ready):** Multi-project + log panel (Tasks 6-22)

### Scope

**In Scope:**
- Supervisor AI timeout (configurable, default 30s)
- waitingForAI deadlock fix with try/finally
- Automated test for timeout behavior
- Multi-project concurrent execution (Map-based state)
- Log persistence for agent output

**Out of Scope:**
- UI changes (already supports multiple runners)
- Max concurrent project limit
- Complete stuck agent auto-recovery (mark only, future phase)

---

## Context for Development

### Codebase Patterns

**CRITICAL - ES Modules:**
- Project uses `"type": "module"` - NEVER use CommonJS
- Always include `.js` extension in local imports

### Files to Reference

| File | Lines | Purpose |
| ---- | ----- | ------- |
| src/claude-runner.js | 286-340 | `waitingForAI` deadlock location **(P0)** |
| src/server.js | 57-58, 64-66 | Singleton state (multi-project bug) |
| src/server.js | 844-857 | `addLog()` method |
| src/services/websocket.js | 89 | `emitAgentOutput()` |

---

## Implementation Plan

## 🔴 PR 1: CRITICAL FIX - Observability + Stuck Agent (Tasks 1-8)

> **Ship this immediately. Adds visibility AND fixes deadlock.**

### Part A: Observability (Tasks 1-3) - DEBUG FIRST

- [x] **Task 1: Add Comprehensive Logging to PTY Lifecycle**
  - File: `src/claude-runner.js`
  - Lines: Throughout runClaude() function
  - Action: Add logging at every critical point:
    ```javascript
    // After line 240 (before PTY spawn)
    console.log(`[AGENT-${agentId}] STARTING: story=${storyId}, cwd=${cwd}`);

    // Line 252 already has a log, enhance it:
    console.log(`[AGENT-${agentId}] PTY SPAWNED: PID=${ptyProcess.pid}, command=${command} ${args.join(' ')}`);

    // Inside onData handler (line 289), add at start:
    console.log(`[AGENT-${agentId}] DATA: ${data.length} bytes`);

    // After updateAgentOutput call (line 300):
    console.log(`[AGENT-${agentId}] BROADCAST: emitAgentOutput called`);

    // Before onExit handler (line 370):
    console.log(`[AGENT-${agentId}] WAITING for exit...`);

    // Inside onExit (line 371):
    console.log(`[AGENT-${agentId}] EXIT: code=${code}`);
    ```
  - Notes: This lets us see EXACTLY where the flow breaks

- [x] **Task 2: Add Logging to WebSocket Emit Functions**
  - File: `src/services/websocket.js`
  - Lines: In emitAgentSpawn, emitAgentOutput, emitAgentComplete
  - Action: Add logging:
    ```javascript
    export function emitAgentSpawn(agent) {
      console.log(`[WS] emitAgentSpawn: ${agent.id}`);
      // ... existing code
    }

    export function emitAgentOutput(agentId, output, storyId = null) {
      console.log(`[WS] emitAgentOutput: ${agentId}, ${output.length} bytes`);
      // ... existing code
    }

    export function emitAgentComplete(agent, status) {
      console.log(`[WS] emitAgentComplete: ${agent.id}, status=${status}`);
      // ... existing code
    }
    ```

- [x] **Task 3: Add Error Boundary Around PTY Operations**
  - File: `src/claude-runner.js`
  - Lines: Around PTY spawn and handlers
  - Action: Wrap critical sections with try/catch logging:
    ```javascript
    try {
      const ptyProcess = pty.spawn(command, args, {...});
      console.log(`[AGENT-${agentId}] PTY SPAWNED: PID=${ptyProcess.pid}`);
    } catch (spawnError) {
      console.error(`[AGENT-${agentId}] PTY SPAWN FAILED: ${spawnError.message}`);
      throw spawnError;
    }

    ptyProcess.onData((data) => {
      try {
        // ... existing handler code
      } catch (dataError) {
        console.error(`[AGENT-${agentId}] onData ERROR: ${dataError.message}`);
      }
    });
    ```

---

### Part B: Stuck Agent Fix (Tasks 4-8)

- [x] **Task 4: Add Configurable Timeout Constant**
  - File: `src/claude-runner.js`
  - Lines: Near top imports (~line 15)
  - Action: Add configurable timeout:
    ```javascript
    // Supervisor AI timeout - configurable via config, fallback to 30s
    const SUPERVISOR_TIMEOUT_MS = parseInt(process.env.SUPERVISOR_TIMEOUT_MS) || 30000;
    ```
  - Notes: Allows override without code change if 30s proves too short/long

- [x] **Task 5: Add Timeout Wrapper Helper**
  - File: `src/claude-runner.js`
  - Lines: Before the question handling section (~line 280)
  - Action: Add timeout helper:
    ```javascript
    function withTimeout(promise, ms, errorMsg) {
      return Promise.race([
        promise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(errorMsg)), ms)
        )
      ]);
    }
    ```

- [x] **Task 6: Fix waitingForAI Deadlock with try/finally**
  - File: `src/claude-runner.js`
  - Lines: 305-340 (the waitingForAI block)
  - Action: Wrap in try/finally to guarantee flag reset:
    ```javascript
    if (isSupervisorAvailable() && isComplexQuestion(outputBuffer)) {
      console.log(`[${agentId}] waitingForAI: true - calling Supervisor AI`);
      waitingForAI = true;

      try {
        const result = await withTimeout(
          answerAgentQuestion(outputBuffer, { agentId, storyId, projectRoot }),
          SUPERVISOR_TIMEOUT_MS,
          'Supervisor AI timeout'
        );

        if (result.answer) {
          ptyProcess.write(result.answer + '\n');
        }
      } catch (err) {
        console.error(`[${agentId}] Supervisor AI error: ${err.message}`);
        // Fallback to default answer on timeout/error
        ptyProcess.write('yes\n');
      } finally {
        waitingForAI = false;  // ALWAYS reset, even on error
        outputBuffer = '';
        console.log(`[${agentId}] waitingForAI: false - Supervisor AI completed`);
      }
      return;
    }
    ```
  - Notes: The `finally` block guarantees `waitingForAI` resets even if promise hangs/errors

- [x] **Task 7: Add Error Handler for PTY Spawn**
  - File: `src/claude-runner.js`
  - Lines: After pty.spawn() (~line 250)
  - Action: Add error handler:
    ```javascript
    ptyProcess.on('error', (err) => {
      console.error(`[${agentId}] PTY spawn error: ${err.message}`);
      updateAgentStatus(agentId, 'failed');
      reject(new Error(`PTY spawn failed: ${err.message}`));
    });
    ```

- [x] **Task 8: Add Automated Test for Timeout Behavior**
  - File: `src/claude-runner.test.js` (create if doesn't exist)
  - Action: Add test that verifies timeout works:
    ```javascript
    import { describe, it, expect, vi } from 'vitest';

    describe('Supervisor AI Timeout', () => {
      it('should timeout and reset waitingForAI after SUPERVISOR_TIMEOUT_MS', async () => {
        // Mock answerAgentQuestion to hang forever
        const hangingPromise = new Promise(() => {}); // Never resolves

        const result = await withTimeout(hangingPromise, 100, 'Test timeout');
        // Should reject with timeout error, not hang
      });

      it('should reset waitingForAI flag even on error', async () => {
        // Verify try/finally behavior
      });
    });
    ```
  - Notes: Prevents regression - this bug WILL return without automated test

---

## 🟡 PR 2: IMPROVEMENTS - Multi-Project + Log Panel (Tasks 9-25)

> **Ship after PR 1 is verified. Bigger refactor, needs more testing.**

### Part A: Multi-Project Concurrent Execution (Tasks 9-22)

- [ ] **Task 9: Add runningProjects Map to Constructor**
  - File: `src/server.js`
  - Lines: 50-70
  - Action: Add `this.runningProjects = new Map();`

- [ ] **Task 10: Add Helper Methods for Running State**
  - File: `src/server.js`
  - Lines: After constructor (~line 95)
  - Action: Add `isProjectRunning()`, `getRunningProjectIds()`, getter `isRunning`

- [ ] **Task 11: Update Project Start Endpoint Blocking Check**
  - File: `src/server.js`
  - Lines: 419-431
  - Action: Change `if (this.isRunning)` to `if (this.runningProjects.has(id))`

- [ ] **Task 12: Update Project Start to Store in Map**
  - File: `src/server.js`
  - Lines: 445-456
  - Action: Store project state in `runningProjects` Map instead of singleton vars

- [ ] **Task 13: Refactor startOrchestration() Signature**
  - File: `src/server.js`
  - Lines: 551
  - Action: Change to `async startOrchestration(projectId, options = {})`

- [ ] **Task 14: Update startOrchestration() to Use Map**
  - File: `src/server.js`
  - Lines: 551-580
  - Action: Get project data from Map, update `projectData.state` instead of `this.state`

- [ ] **Task 15: Update Orchestrator Creation in startOrchestration()**
  - File: `src/server.js`
  - Lines: 617-622
  - Action: Store orchestrator in `projectData.orchestrator`

- [ ] **Task 16: Update State Cleanup After Orchestration**
  - File: `src/server.js`
  - Lines: 659-665
  - Action: `this.runningProjects.delete(projectId)` instead of clearing singleton vars

- [ ] **Task 17: Update Project Stop Endpoint**
  - File: `src/server.js`
  - Lines: 489-543
  - Action: Use Map lookups instead of singleton checks

- [ ] **Task 18: Update Legacy /api/start Endpoint**
  - File: `src/server.js`
  - Lines: 331-351
  - Action: Generate projectId from projectRoot, use Map

- [ ] **Task 19: Update /api/stop Legacy Endpoint**
  - File: `src/server.js`
  - Lines: 354-374
  - Action: Use Map for legacy stop

- [ ] **Task 20: Update Broadcast Calls to Include Project Context**
  - File: `src/server.js`
  - Lines: Multiple
  - Action: Include projectId in all broadcast data

- [ ] **Task 21: Update updateStateFromLog() for Multi-Project**
  - File: `src/server.js`
  - Lines: 678-836
  - Action: Add projectId parameter, update correct project's state

- [ ] **Task 22: Remove Deprecated Singleton Variables**
  - File: `src/server.js`
  - Lines: 57-58, 64-66
  - Action: Remove `this.orchestrator`, `this.activeProjectPath`, `this.activeProjectConfig`

---

### Part B: Log Panel Fix (Tasks 23-25)

- [ ] **Task 23: Export addLog Function from Server**
  - File: `src/server.js`
  - Lines: Near exports
  - Action: Pass callback during websocket initialization:
    ```javascript
    // In server.js setupServer()
    setAuthenticatedClients(this.authenticatedClients, this.addLog.bind(this));
    ```

- [ ] **Task 24: Update setAuthenticatedClients to Accept addLog**
  - File: `src/services/websocket.js`
  - Lines: Near top
  - Action: Modify to accept and store addLog callback:
    ```javascript
    let authenticatedClients = null;
    let addLogCallback = null;

    export function setAuthenticatedClients(clients, addLog = null) {
      authenticatedClients = clients;
      addLogCallback = addLog;
    }
    ```

- [ ] **Task 25: Persist Agent Output to Server Logs**
  - File: `src/services/websocket.js`
  - Lines: In `emitAgentOutput()` function (~line 89)
  - Action: Call addLog when emitting agent output:
    ```javascript
    export function emitAgentOutput(agentId, output, storyId = null) {
      // Persist to server logs for REST API access
      if (addLogCallback) {
        addLogCallback(output, 'info', agentId);
      }

      // Existing broadcast logic
      broadcast({
        type: 'agent:output',
        data: { agentId, output, storyId },
        timestamp: new Date().toISOString(),
      });
    }
    ```

---

## Acceptance Criteria

### 🔴 PR 1: Observability + Stuck Agent (AC 1-7)

**Observability (AC 1-3):**
- [x] **AC 1:** Given an agent starts, when it spawns PTY, then I see `[AGENT-X] PTY SPAWNED` in server terminal.
- [x] **AC 2:** Given an agent receives data, when onData fires, then I see `[AGENT-X] DATA: N bytes` in server terminal.
- [x] **AC 3:** Given an agent completes, when it exits, then I see `[AGENT-X] EXIT: code=N` in server terminal.

**Stuck Agent Fix (AC 4-7):**
- [x] **AC 4:** Given Supervisor AI hangs (>30s), when agent asks a question, then it times out and falls back to default answer.
- [x] **AC 5:** Given any error in Supervisor AI call, when the error occurs, then `waitingForAI` is reset to false (no deadlock).
- [x] **AC 6:** Given PTY spawn fails, when the error occurs, then agent is marked as failed with clear error message.
- [x] **AC 7:** Given the timeout test exists, when running `npm test`, then it passes and verifies timeout behavior.

### 🟡 PR 2: Multi-Project (AC 8-15)

- [ ] **AC 8:** Given project A is running, when I start project B, then both run concurrently.
- [ ] **AC 9:** Given project A is running, when I start project A again, then error `PROJECT_ALREADY_RUNNING`.
- [ ] **AC 10:** Given A and B running, when I stop A, then B continues unaffected.
- [ ] **AC 11:** Given A and B running, when A completes, then B continues unaffected.
- [ ] **AC 12:** Legacy `/api/start` still works (backward compat).
- [ ] **AC 13:** `/api/status` shows all running projects.
- [ ] **AC 14:** WebSocket broadcasts include projectId.
- [ ] **AC 15:** Tasks within a project remain sequential.

### 🟡 PR 2: Log Panel (AC 16-17)

- [ ] **AC 16:** Given an agent is running, when I call `/api/logs?agentId=agent-17`, then I receive the agent's output logs.
- [ ] **AC 17:** Given an agent is producing output, when I view the log panel, then I see real-time log entries.

---

## Additional Context

### Dependencies

None - no new packages required.

### Testing Strategy

**PR 1 - Observability + Stuck Agent:**

*Part A - Observability (test FIRST):*
1. Start the server in foreground: `node src/server.js`
2. Launch any project from the UI
3. Watch server terminal - you MUST see:
   - `[AGENT-X] STARTING: story=...`
   - `[AGENT-X] PTY SPAWNED: PID=...`
   - `[AGENT-X] DATA: N bytes` (multiple times)
   - `[AGENT-X] EXIT: code=0`
4. If you don't see DATA logs, the issue is Claude CLI not producing output

*Part B - Stuck Agent Fix:*
1. Run `npm test` - verify timeout test passes
2. Set `SUPERVISOR_TIMEOUT_MS=5000` (5s for faster testing)
3. Trigger a complex question from Claude
4. Verify 5-second timeout triggers
5. Verify agent continues with fallback answer
6. Check logs show `waitingForAI: false`

**PR 2 - Multi-Project (Manual):**
1. Start project A, then start project B
2. Verify both run concurrently
3. Stop A, verify B continues
4. Start A again while B runs

**PR 2 - Log Panel (Manual):**
1. Start any project with agents
2. Call `/api/logs?agentId=agent-1`
3. Verify logs are returned (not empty)

### Notes

- **Timeout is configurable:** Set `SUPERVISOR_TIMEOUT_MS` env var to override default 30s
- **Fallback answer:** Using "yes" as default when Supervisor times out. May want to make this smarter in future.
- **Log persistence:** Logs will be stored twice (WebSocket + server.logs). Consider deduplication if memory becomes an issue.
- **Team Review:** Winston, Amelia, Murat, Barry all agreed: ship PR 1 immediately, PR 2 can follow.

---

## Review Notes

### PR 1 Implementation Review (2026-01-18)

- **Adversarial review completed**: 13 findings identified
- **Resolution approach**: Auto-fix (5 real issues fixed)

**Findings Fixed:**
- F1 (High): Memory leak in `withTimeout` - timer now cleared via `.finally()`
- F2 (Medium): `parseInt` without radix - added explicit radix 10
- F7 (Low): Unused `reject` parameter removed from Promise
- F8 (Medium): Added PTY spawn failure test coverage (4 new tests)
- F9 (High): Race condition fixed - check `!resolved` before `ptyProcess.write()`

**Findings Skipped (noise/out-of-scope):**
- F3, F4, F5, F10, F11, F12, F13

**Test Results:** 12/12 tests passing in `claude-runner.test.js`
