# BMAD Orchestrator - Data Models

**Generated**: 2026-01-19
**Database**: SQLite (better-sqlite3)
**Location**: `orchestrator.db` (in working directory)

## Schema Overview

```
┌─────────────────┐     ┌─────────────────────┐
│    sessions     │     │     audit_log       │
├─────────────────┤     ├─────────────────────┤
│ id (PK)         │     │ id (PK)             │
│ user_id         │     │ timestamp           │
│ github_token    │     │ user_id             │
│ refresh_token   │     │ action              │
│ expires_at      │     │ resource            │
│ created_at      │     │ details             │
└─────────────────┘     └─────────────────────┘

┌─────────────────────────┐
│ verification_audit_logs │
├─────────────────────────┤
│ id (PK)                 │
│ timestamp               │
│ project_id              │
│ story_id                │
│ verification_type       │
│ result                  │
│ details                 │
└─────────────────────────┘

┌─────────────────────┐     ┌─────────────────────┐
│   execution_runs    │◄────│  execution_events   │
├─────────────────────┤     ├─────────────────────┤
│ id (PK)             │     │ id (PK)             │
│ project             │     │ run_id (FK)         │
│ started_at          │     │ timestamp           │
│ ended_at            │     │ type                │
│ status              │     │ agent_id            │
│ stories_completed   │     │ story_id            │
│ stories_failed      │     │ epic_number         │
│ stories_total       │     │ details (JSON)      │
│ duration_ms         │     └─────────────────────┘
│ config (JSON)       │
│ created_at          │
└─────────────────────┘
```

---

## Table: sessions

Authentication session storage.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique session ID |
| `user_id` | TEXT | NOT NULL | User identifier (e.g., `github_12345`) |
| `github_token` | TEXT | - | GitHub access token (OAuth only) |
| `refresh_token` | TEXT | NOT NULL UNIQUE | JWT refresh token |
| `expires_at` | TEXT | NOT NULL | Session expiration ISO timestamp |
| `created_at` | TEXT | DEFAULT datetime('now') | Creation timestamp |

**Indexes**:
- `idx_sessions_user_id` on `user_id`
- `idx_sessions_refresh_token` on `refresh_token`

**Migration**: `001_sessions.sql`

---

## Table: audit_log

Security audit trail for user actions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique log ID |
| `timestamp` | TEXT | DEFAULT datetime('now') | Action timestamp |
| `user_id` | TEXT | NOT NULL | User who performed action |
| `action` | TEXT | NOT NULL | Action type (e.g., `project:start`) |
| `resource` | TEXT | - | Resource identifier (e.g., project ID) |
| `details` | TEXT | - | JSON-encoded additional details |

**Migration**: `002_audit_log.sql`

---

## Table: verification_audit_logs

Story verification records.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique record ID |
| `timestamp` | TEXT | DEFAULT datetime('now') | Verification timestamp |
| `project_id` | TEXT | NOT NULL | Project identifier |
| `story_id` | TEXT | NOT NULL | Story identifier (e.g., `2-3`) |
| `verification_type` | TEXT | NOT NULL | Type of verification |
| `result` | TEXT | NOT NULL | Verification result |
| `details` | TEXT | - | JSON-encoded verification details |

**Migration**: `003_verification_audit_logs.sql`

---

## Table: execution_runs

Orchestration run history.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique run ID |
| `project` | TEXT | NOT NULL | Project name |
| `started_at` | TEXT | DEFAULT datetime('now') | Run start timestamp |
| `ended_at` | TEXT | - | Run end timestamp |
| `status` | TEXT | DEFAULT 'running' | `running`, `completed`, `failed`, `stopped` |
| `stories_completed` | INTEGER | DEFAULT 0 | Count of completed stories |
| `stories_failed` | INTEGER | DEFAULT 0 | Count of failed stories |
| `stories_total` | INTEGER | DEFAULT 0 | Total stories in run |
| `duration_ms` | INTEGER | - | Run duration in milliseconds |
| `config` | TEXT | - | JSON-encoded config snapshot |
| `created_at` | TEXT | DEFAULT datetime('now') | Record creation timestamp |

**Indexes**:
- `idx_runs_project` on `project`
- `idx_runs_status` on `status`
- `idx_runs_started_at` on `started_at`

**Migration**: `004_execution_history.sql`

---

## Table: execution_events

Timeline events within orchestration runs.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique event ID |
| `run_id` | INTEGER | NOT NULL, FK → execution_runs | Parent run |
| `timestamp` | TEXT | DEFAULT datetime('now') | Event timestamp |
| `type` | TEXT | NOT NULL | Event type |
| `agent_id` | TEXT | - | Associated agent ID |
| `story_id` | TEXT | - | Associated story ID |
| `epic_number` | INTEGER | - | Associated epic number |
| `details` | TEXT | - | JSON-encoded event details |

**Event Types**:
- `agent:spawn` - Agent started
- `agent:complete` - Agent finished successfully
- `agent:error` - Agent encountered error
- `agent:stuck` - Agent detected as stuck
- `story:verified` - Story verification passed
- `story:mismatch` - Story verification failed

**Indexes**:
- `idx_events_run_id` on `run_id`
- `idx_events_type` on `type`
- `idx_events_timestamp` on `timestamp`

**Migration**: `004_execution_history.sql`

---

## In-Memory Data Structures

### Active Agents Map

Tracked in `src/claude-runner.js`:

```javascript
activeAgents = new Map<agentId, {
  id: string,           // Unique agent ID
  projectId: string,    // Project identifier
  storyId: string,      // Story being worked on
  storyTitle: string,   // Story title
  status: 'running' | 'completed' | 'failed' | 'killed',
  startedAt: string,    // ISO timestamp
  lastActivity: string, // ISO timestamp
  lastOutput: string,   // Recent output snippet
  outputHistory: string[], // Last 100 outputs
  completed: boolean,
  killed: boolean
}>
```

### Project States Map

Tracked in `src/orchestrator.js`:

```javascript
projectStates = new Map<projectId, {
  status: 'running' | 'paused',
  pausedAt?: string,    // ISO timestamp
  resumedAt?: string,   // ISO timestamp
  reason?: string,      // Pause reason
  pausedBy?: 'verification_system' | 'user'
}>
```

### Dashboard State Object

Tracked in `DashboardServer` class:

```javascript
state = {
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'stopped',
  activeProject: { id, path, name } | null,
  projectRoot: string,
  currentBatch: { number, total, epics } | null,
  epics: Array<{ id, number, title, status, storyCount, phase?, error? }>,
  stories: Array<{ id, slug, title, epicNumber, status, step, prUrl?, error? }>,
  progress: {
    totalEpics: number,
    completedEpics: number,
    totalStories: number,
    completedStories: number,
    failedStories: number,
    inProgressStories: number
  },
  startTime: string | null,
  endTime: string | null,
  duration: string | null
}
```

---

## Database Initialization

Database is initialized in `src/db/index.js`:

```javascript
import { initDb } from './db/index.js';

// Creates orchestrator.db and runs all migrations
initDb();
```

Migration files are executed in order from `src/db/migrations/`.
