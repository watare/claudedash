# Story 1.2: SQLite Database Setup

Status: done

## Story

As a **system**,
I want **a SQLite database initialized with sessions and audit_log tables**,
So that **authentication state and user actions can be persisted securely**.

## Acceptance Criteria

1. **Given** the orchestrator server starts
   **When** the database module initializes
   **Then** a SQLite database file is created at `data/orchestrator.db`

2. **Given** the database initializes
   **When** I inspect the schema
   **Then** the `sessions` table exists with columns: id, user_id, github_token, refresh_token, expires_at, created_at

3. **Given** the database initializes
   **When** I inspect the schema
   **Then** the `audit_log` table exists with columns: id, timestamp, user, action, project, details

4. **Given** the database module
   **When** I inspect the implementation
   **Then** the database connection uses better-sqlite3 synchronous API

5. **Given** the schema has changed
   **When** the server starts
   **Then** migrations run automatically on startup if schema changes

## Tasks / Subtasks

- [x] Task 1: Install better-sqlite3 (AC: #4)
  - [x] Run `npm install better-sqlite3`
  - [x] Verify installation works (better-sqlite3 requires native bindings)

- [x] Task 2: Create database directory and module structure (AC: #1)
  - [x] Create `data/` directory with `.gitkeep`
  - [x] Add `data/orchestrator.db` to `.gitignore`
  - [x] Create `src/db/` directory
  - [x] Create `src/db/index.js` (exports)
  - [x] Create `src/db/sqlite.js` (connection)

- [x] Task 3: Create sessions table schema (AC: #2)
  - [x] Create `src/db/migrations/001_sessions.sql`:
    ```sql
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      github_token TEXT,
      refresh_token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_refresh_token ON sessions(refresh_token);
    ```

- [x] Task 4: Create audit_log table schema (AC: #3)
  - [x] Create `src/db/migrations/002_audit_log.sql`:
    ```sql
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      user TEXT,
      action TEXT NOT NULL,
      project TEXT,
      details TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp);
    CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user);
    CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
    ```

- [x] Task 5: Implement database connection module (AC: #4)
  - [x] Create `src/db/sqlite.js` with better-sqlite3 connection
  - [x] Use synchronous API (better-sqlite3 design)
  - [x] Implement `getDb()` function for connection access
  - [x] Implement graceful shutdown on process exit

- [x] Task 6: Implement migration runner (AC: #5)
  - [x] Create `src/db/migrate.js` with migration logic
  - [x] Create `migrations` table to track applied migrations
  - [x] Load and execute `.sql` files from `migrations/` directory
  - [x] Run migrations in order (sort by filename)
  - [x] Skip already-applied migrations
  - [x] Log migration execution

- [x] Task 7: Integrate database initialization into server startup
  - [x] Import database module in `src/server.js`
  - [x] Call database initialization before starting Express
  - [x] Handle initialization errors gracefully

## Dev Notes

### Critical Implementation Rules

1. **ES Modules** - Use ES Module syntax (`import`/`export`), NOT CommonJS.
2. **File Extensions** - Include `.js` extension in all local imports.
3. **Synchronous API** - better-sqlite3 is synchronous by design; don't wrap in async.

### Database Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Tables | snake_case, plural | `sessions`, `audit_log` |
| Columns | snake_case | `user_id`, `created_at`, `github_token` |
| Primary keys | `id` (integer autoincrement) | `id INTEGER PRIMARY KEY` |
| Foreign keys | `{table_singular}_id` | `user_id`, `project_id` |
| Timestamps | ISO 8601 strings | `datetime('now')` |

### better-sqlite3 Usage Pattern

```javascript
// ✅ CORRECT - ES Modules, synchronous API
import Database from 'better-sqlite3';

const db = new Database('data/orchestrator.db');

// Prepared statements (recommended)
const stmt = db.prepare('SELECT * FROM sessions WHERE user_id = ?');
const session = stmt.get(userId);

// Transactions
const insert = db.prepare('INSERT INTO audit_log (user, action) VALUES (?, ?)');
db.transaction(() => {
  insert.run('user1', 'login');
  insert.run('user1', 'view_project');
})();
```

```javascript
// ❌ WRONG - CommonJS
const Database = require('better-sqlite3'); // Don't use require()
```

### Data Directory Structure

```
bmad-orchestrator/
├── data/
│   ├── .gitkeep           # Keep directory in git
│   └── orchestrator.db    # Database file (gitignored)
└── src/
    └── db/
        ├── index.js       # Exports: { getDb, initDb }
        ├── sqlite.js      # Database connection
        ├── migrate.js     # Migration runner
        └── migrations/
            ├── 001_sessions.sql
            └── 002_audit_log.sql
```

### Migration Table Schema

The migration runner should create a tracking table:

```sql
CREATE TABLE IF NOT EXISTS migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Sessions Table Purpose

| Column | Purpose |
|--------|---------|
| `id` | Primary key |
| `user_id` | GitHub username or email for password auth |
| `github_token` | GitHub OAuth access token (encrypted at rest, future) |
| `refresh_token` | JWT refresh token for session continuity |
| `expires_at` | Refresh token expiration (7 days default) |
| `created_at` | Session creation timestamp |

### Audit Log Purpose

| Column | Purpose |
|--------|---------|
| `id` | Primary key |
| `timestamp` | When action occurred |
| `user` | Who performed action (username) |
| `action` | What action (login, kill_agent, approve, etc.) |
| `project` | Which project (optional) |
| `details` | JSON string with additional context |

### References

- [Source: architecture.md#Data Architecture]
- [Source: architecture.md#SQLite Schema (sessions + audit)]
- [Source: architecture.md#Database Naming Conventions]
- [Source: project-context.md#Database (New - To Be Added)]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Server startup test: Verified database initializes on server start with migrations running
- Schema verification: Confirmed all tables (sessions, audit_log, migrations) created with correct columns
- Idempotency test: Verified migrations skip when already applied

### Completion Notes List

- Installed better-sqlite3 with native bindings (36 packages added)
- Created data/ directory with .gitkeep, added orchestrator.db to .gitignore
- Implemented src/db/ module structure with index.js, sqlite.js, migrate.js
- Created 001_sessions.sql and 002_audit_log.sql migration files
- sqlite.js uses synchronous API with WAL mode and foreign keys enabled
- Migration runner tracks applied migrations and runs in order by filename
- Integrated database initialization in DashboardServer constructor before Express setup
- All acceptance criteria verified through server startup and schema inspection

### File List

- package.json (modified - added better-sqlite3 dependency)
- package-lock.json (modified - updated lock file for better-sqlite3 native bindings)
- .gitignore (modified - added data/orchestrator.db)
- data/.gitkeep (new)
- src/db/index.js (new)
- src/db/sqlite.js (new)
- src/db/migrate.js (new)
- src/db/migrations/001_sessions.sql (new)
- src/db/migrations/002_audit_log.sql (new)
- src/server.js (modified - added database initialization)

## Review Follow-ups (AI)

- [ ] [AI-Review][MEDIUM] Consider making DB_PATH configurable instead of hardcoded relative path [src/db/sqlite.js:11]
- [ ] [AI-Review][LOW] Add JSDoc documentation to runMigrations function describing transactional behavior [src/db/migrate.js:54]
- [ ] [AI-Review][LOW] Consider structured logging utility for future log level control [src/db/sqlite.js:44, migrate.js:74]

## Senior Developer Review (AI)

**Review Date:** 2026-01-15
**Reviewer:** Claude Opus 4.5 (Adversarial Code Review)
**Outcome:** ✅ APPROVED

### Summary

All 5 Acceptance Criteria verified against actual implementation. All 7 tasks confirmed complete with evidence. Database schema matches specification exactly, migrations run correctly, and server integration works as expected.

### Verification Results

| Check | Result |
|-------|--------|
| AC #1: Database file location | ✅ PASS - `data/orchestrator.db` exists (49KB) |
| AC #2: Sessions table schema | ✅ PASS - All columns present with correct types |
| AC #3: Audit log table schema | ✅ PASS - All columns present with correct types |
| AC #4: better-sqlite3 sync API | ✅ PASS - Synchronous usage throughout |
| AC #5: Auto migrations | ✅ PASS - Both migrations applied on startup |

### Issues Found

- **0 HIGH** - No blocking issues
- **3 MEDIUM** - Documentation gaps (fixed), hardcoded path (action item)
- **2 LOW** - JSDoc, logging patterns (action items)

### Notes

- File List was missing `package-lock.json` - FIXED
- `src/config.js` shows modifications from Story 1.3 in git diff (uncommitted cross-story work) - noted but not blocking
- Code quality is good, follows ES Module patterns correctly
- WAL mode and foreign keys enabled - good database hygiene

## Change Log

- 2026-01-15: Implemented SQLite database setup with better-sqlite3, sessions and audit_log tables, migration runner, and server integration
- 2026-01-15: [Review] Added package-lock.json to File List, created 3 follow-up action items, marked APPROVED

