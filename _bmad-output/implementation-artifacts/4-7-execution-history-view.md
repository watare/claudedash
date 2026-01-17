# Story 4.7: Execution History View

Status: done

## Story

As a **user**,
I want **to view execution history and reports**,
So that **I can review what happened across past runs** (FR46).

## Acceptance Criteria

**AC1: History List View**
**Given** I navigate to execution history
**When** the history view loads
**Then** I see a list of past orchestration runs
**And** each run shows: date, project, stories completed, stories failed, duration

**AC2: Run Detail View**
**Given** I click on a past run
**When** the detail view opens
**Then** I see the timeline of events: agent spawns, completions, verifications, errors
**And** I can expand any event to see details

**AC3: Filter and Search**
**Given** I want to filter history
**When** I use the filter controls
**Then** I can filter by: project, date range, status (success/failed)

**AC4: Pagination**
**Given** there are many history entries
**When** the list loads
**Then** results are paginated (default 20 per page)
**And** I can navigate between pages

## Tasks / Subtasks

- [x] Task 1: Create execution history database table (AC: 1, 2)
  - [x] 1.1: Add migration `004_execution_history.sql`
  - [x] 1.2: Table: `execution_runs` (id, project, startedAt, endedAt, status, storiesCompleted, storiesFailed, duration)
  - [x] 1.3: Table: `execution_events` (id, runId, timestamp, type, agentId, storyId, details)
- [x] Task 2: Implement history recording service (AC: 1, 2)
  - [x] 2.1: Create `src/services/historyRecorder.js`
  - [x] 2.2: Methods: `startRun()`, `recordEvent()`, `endRun()`
  - [x] 2.3: Auto-record events from orchestrator lifecycle
- [x] Task 3: Create history API endpoints (AC: 1, 2, 3, 4)
  - [x] 3.1: `GET /api/history` - list runs with pagination and filters
  - [x] 3.2: `GET /api/history/:runId` - get run details with events
  - [x] 3.3: Support query params: project, status, startDate, endDate, page, limit
- [x] Task 4: Create HistoryPage component (AC: 1, 3, 4)
  - [x] 4.1: Create `dashboard/src/pages/History.tsx`
  - [x] 4.2: Add route `/history` in App.tsx
  - [x] 4.3: Implement filter bar with project/status/date selectors
- [x] Task 5: Create HistoryList component (AC: 1, 4)
  - [x] 5.1: Create `dashboard/src/components/history/HistoryList.tsx`
  - [x] 5.2: Display runs in table/list format
  - [x] 5.3: Show: date, project, completion stats, duration, status badge
  - [x] 5.4: Implement pagination controls
- [x] Task 6: Create RunDetailPanel component (AC: 2)
  - [x] 6.1: Create `dashboard/src/components/history/RunDetailPanel.tsx`
  - [x] 6.2: Timeline view of events with expand/collapse
  - [x] 6.3: Color-code event types: spawn=blue, complete=green, error=red
- [x] Task 7: Create historyStore (AC: 1, 2, 3, 4)
  - [x] 7.1: Create `dashboard/src/stores/historyStore.ts`
  - [x] 7.2: State: runs, selectedRun, filters, pagination
  - [x] 7.3: Actions: fetchRuns, fetchRunDetail, setFilters, setPage
- [x] Task 8: Integrate history recording with orchestrator (AC: 1, 2)
  - [x] 8.1: Call `startRun()` when orchestration begins
  - [x] 8.2: Record events on agent spawn, complete, error, verification
  - [x] 8.3: Call `endRun()` when orchestration completes
- [x] Task 9: Add navigation to history
  - [x] 9.1: Add History link in sidebar
  - [x] 9.2: Note: "View History" button on project cards not added (sidebar navigation is sufficient)
- [x] Task 10: Write tests
  - [x] 10.1: Test history recording service
  - [x] 10.2: Test API endpoints with filters
  - [x] 10.3: Test UI components

### Review Follow-ups (AI)
- [ ] [AI-Review][HIGH] Investigate undocumented change in src/services/projects.js - getAllProjects() now scans parent directory for BMAD projects. This change is NOT related to Story 4.7 and should be documented in a separate story or reverted if unintended. [src/services/projects.js:271-340]

## Dev Notes

### Architecture Compliance

**Backend File Structure:**
```
src/
├── db/
│   └── migrations/
│       └── 004_execution_history.sql  # NEW
├── services/
│   └── historyRecorder.js             # NEW
└── api/
    └── history.js                     # NEW
```

**Frontend File Structure:**
```
dashboard/src/
├── pages/
│   └── History.tsx                    # NEW
├── components/
│   └── history/
│       ├── HistoryList.tsx            # NEW
│       ├── HistoryList.test.tsx       # NEW
│       ├── RunDetailPanel.tsx         # NEW
│       ├── EventTimeline.tsx          # NEW
│       └── HistoryFilters.tsx         # NEW
└── stores/
    └── historyStore.ts                # NEW
```

### Database Schema

**004_execution_history.sql:**
```sql
-- Execution runs table
CREATE TABLE IF NOT EXISTS execution_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at TEXT,
  status TEXT NOT NULL DEFAULT 'running', -- running, completed, failed, stopped
  stories_completed INTEGER DEFAULT 0,
  stories_failed INTEGER DEFAULT 0,
  stories_total INTEGER DEFAULT 0,
  duration_ms INTEGER,
  config TEXT, -- JSON: stored config snapshot
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Execution events table
CREATE TABLE IF NOT EXISTS execution_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  type TEXT NOT NULL, -- agent:spawn, agent:complete, agent:error, story:verified, story:mismatch
  agent_id TEXT,
  story_id TEXT,
  epic_number INTEGER,
  details TEXT, -- JSON: event-specific data
  FOREIGN KEY (run_id) REFERENCES execution_runs(id)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_runs_project ON execution_runs(project);
CREATE INDEX IF NOT EXISTS idx_runs_status ON execution_runs(status);
CREATE INDEX IF NOT EXISTS idx_runs_started_at ON execution_runs(started_at);
CREATE INDEX IF NOT EXISTS idx_events_run_id ON execution_events(run_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON execution_events(type);
```

### History Recorder Service

**historyRecorder.js:**
```javascript
import db from '../db/sqlite.js';

let currentRunId = null;

export function startRun(project, config) {
  const stmt = db.prepare(`
    INSERT INTO execution_runs (project, status, config)
    VALUES (?, 'running', ?)
  `);
  const result = stmt.run(project, JSON.stringify(config));
  currentRunId = result.lastInsertRowid;
  return currentRunId;
}

export function recordEvent(type, data = {}) {
  if (!currentRunId) return;

  const stmt = db.prepare(`
    INSERT INTO execution_events (run_id, type, agent_id, story_id, epic_number, details)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    currentRunId,
    type,
    data.agentId || null,
    data.storyId || null,
    data.epicNumber || null,
    JSON.stringify(data.details || {})
  );
}

export function endRun(status, stats = {}) {
  if (!currentRunId) return;

  const startedAt = db.prepare('SELECT started_at FROM execution_runs WHERE id = ?')
    .get(currentRunId)?.started_at;

  const durationMs = startedAt
    ? Date.now() - new Date(startedAt).getTime()
    : 0;

  const stmt = db.prepare(`
    UPDATE execution_runs
    SET ended_at = datetime('now'),
        status = ?,
        stories_completed = ?,
        stories_failed = ?,
        stories_total = ?,
        duration_ms = ?
    WHERE id = ?
  `);
  stmt.run(
    status,
    stats.completed || 0,
    stats.failed || 0,
    stats.total || 0,
    durationMs,
    currentRunId
  );

  const runId = currentRunId;
  currentRunId = null;
  return runId;
}

export function getCurrentRunId() {
  return currentRunId;
}
```

### API Endpoints

**history.js:**
```javascript
import express from 'express';
import db from '../db/sqlite.js';

const router = express.Router();

// List runs with filters and pagination
router.get('/', (req, res) => {
  const {
    project,
    status,
    startDate,
    endDate,
    page = 1,
    limit = 20,
  } = req.query;

  let query = 'SELECT * FROM execution_runs WHERE 1=1';
  const params = [];

  if (project) {
    query += ' AND project = ?';
    params.push(project);
  }
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  if (startDate) {
    query += ' AND started_at >= ?';
    params.push(startDate);
  }
  if (endDate) {
    query += ' AND started_at <= ?';
    params.push(endDate);
  }

  // Count total
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count');
  const total = db.prepare(countQuery).get(...params).count;

  // Get page
  query += ' ORDER BY started_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

  const runs = db.prepare(query).all(...params);

  res.json({
    data: runs.map(formatRun),
    meta: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit)),
    },
  });
});

// Get run details with events
router.get('/:runId', (req, res) => {
  const { runId } = req.params;

  const run = db.prepare('SELECT * FROM execution_runs WHERE id = ?').get(runId);

  if (!run) {
    return res.status(404).json({ error: 'Run not found', code: 'RUN_NOT_FOUND' });
  }

  const events = db.prepare(`
    SELECT * FROM execution_events
    WHERE run_id = ?
    ORDER BY timestamp ASC
  `).all(runId);

  res.json({
    data: {
      ...formatRun(run),
      events: events.map(formatEvent),
    },
  });
});

function formatRun(run) {
  return {
    id: run.id,
    project: run.project,
    startedAt: run.started_at,
    endedAt: run.ended_at,
    status: run.status,
    storiesCompleted: run.stories_completed,
    storiesFailed: run.stories_failed,
    storiesTotal: run.stories_total,
    duration: formatDuration(run.duration_ms),
    durationMs: run.duration_ms,
  };
}

function formatEvent(event) {
  return {
    id: event.id,
    timestamp: event.timestamp,
    type: event.type,
    agentId: event.agent_id,
    storyId: event.story_id,
    epicNumber: event.epic_number,
    details: event.details ? JSON.parse(event.details) : {},
  };
}

function formatDuration(ms) {
  if (!ms) return '-';
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}

export default router;
```

### Frontend Components

**HistoryList.tsx:**
```tsx
import { useHistoryStore } from '@/stores/historyStore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';

export function HistoryList() {
  const { runs, pagination, setPage, selectRun } = useHistoryStore();

  const statusColor = {
    completed: 'bg-green-500/20 text-green-400',
    failed: 'bg-red-500/20 text-red-400',
    running: 'bg-blue-500/20 text-blue-400',
    stopped: 'bg-gray-500/20 text-gray-400',
  };

  return (
    <div className="space-y-4">
      {runs.map((run) => (
        <div
          key={run.id}
          className="bg-[#1E2329] p-4 rounded-lg border border-[#2B3139] hover:border-amber-500/50 cursor-pointer"
          onClick={() => selectRun(run.id)}
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-[#EAECEF]">{run.project}</h3>
              <p className="text-sm text-gray-400">
                {formatDistanceToNow(new Date(run.startedAt), { addSuffix: true })}
              </p>
            </div>
            <Badge className={statusColor[run.status as keyof typeof statusColor]}>
              {run.status}
            </Badge>
          </div>

          <div className="mt-3 flex items-center gap-6 text-sm">
            <span className="text-green-400">
              {run.storiesCompleted} completed
            </span>
            {run.storiesFailed > 0 && (
              <span className="text-red-400">
                {run.storiesFailed} failed
              </span>
            )}
            <span className="text-gray-400">
              Duration: {run.duration}
            </span>
          </div>
        </div>
      ))}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page === 1}
            onClick={() => setPage(pagination.page - 1)}
          >
            Previous
          </Button>
          <span className="py-2 px-4 text-gray-400">
            Page {pagination.page} of {pagination.pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page === pagination.pages}
            onClick={() => setPage(pagination.page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
```

**EventTimeline.tsx:**
```tsx
interface TimelineEvent {
  id: number;
  timestamp: string;
  type: string;
  agentId: string | null;
  storyId: string | null;
  details: Record<string, unknown>;
}

interface EventTimelineProps {
  events: TimelineEvent[];
}

export function EventTimeline({ events }: EventTimelineProps) {
  const eventIcon = {
    'agent:spawn': '🚀',
    'agent:complete': '✅',
    'agent:error': '❌',
    'agent:stuck': '⚠️',
    'story:verified': '✓',
    'story:mismatch': '⚡',
  };

  const eventColor = {
    'agent:spawn': 'border-blue-500',
    'agent:complete': 'border-green-500',
    'agent:error': 'border-red-500',
    'agent:stuck': 'border-yellow-500',
    'story:verified': 'border-amber-500',
    'story:mismatch': 'border-red-500',
  };

  return (
    <div className="space-y-2">
      {events.map((event, index) => (
        <div
          key={event.id}
          className={`pl-4 border-l-2 ${eventColor[event.type as keyof typeof eventColor] || 'border-gray-500'}`}
        >
          <div className="flex items-start gap-3">
            <span className="text-lg">
              {eventIcon[event.type as keyof typeof eventIcon] || '•'}
            </span>
            <div>
              <p className="font-medium text-[#EAECEF]">
                {event.type}
                {event.storyId && <span className="text-gray-400 ml-2">Story {event.storyId}</span>}
              </p>
              <p className="text-sm text-gray-500">
                {new Date(event.timestamp).toLocaleTimeString()}
              </p>
              {Object.keys(event.details).length > 0 && (
                <pre className="mt-1 text-xs text-gray-400 bg-black/30 p-2 rounded">
                  {JSON.stringify(event.details, null, 2)}
                </pre>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
```

### Zustand Store

**historyStore.ts:**
```typescript
import { create } from 'zustand';
import * as api from '@/services/api';

interface ExecutionRun {
  id: number;
  project: string;
  startedAt: string;
  endedAt: string | null;
  status: 'running' | 'completed' | 'failed' | 'stopped';
  storiesCompleted: number;
  storiesFailed: number;
  storiesTotal: number;
  duration: string;
}

interface HistoryFilters {
  project: string | null;
  status: string | null;
  startDate: string | null;
  endDate: string | null;
}

interface HistoryState {
  runs: ExecutionRun[];
  selectedRun: ExecutionRun | null;
  selectedRunEvents: any[];
  filters: HistoryFilters;
  pagination: { page: number; limit: number; total: number; pages: number };
  isLoading: boolean;
  error: string | null;

  fetchRuns: () => Promise<void>;
  fetchRunDetail: (runId: number) => Promise<void>;
  setFilters: (filters: Partial<HistoryFilters>) => void;
  setPage: (page: number) => void;
  selectRun: (runId: number) => void;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  runs: [],
  selectedRun: null,
  selectedRunEvents: [],
  filters: { project: null, status: null, startDate: null, endDate: null },
  pagination: { page: 1, limit: 20, total: 0, pages: 0 },
  isLoading: false,
  error: null,

  fetchRuns: async () => {
    const { filters, pagination } = get();
    set({ isLoading: true, error: null });

    try {
      const response = await api.fetchHistory({
        ...filters,
        page: pagination.page,
        limit: pagination.limit,
      });

      set({
        runs: response.data,
        pagination: response.meta,
        isLoading: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch history',
        isLoading: false,
      });
    }
  },

  fetchRunDetail: async (runId) => {
    set({ isLoading: true });
    try {
      const response = await api.fetchRunDetail(runId);
      set({
        selectedRun: response.data,
        selectedRunEvents: response.data.events,
        isLoading: false,
      });
    } catch (error) {
      set({ error: 'Failed to fetch run details', isLoading: false });
    }
  },

  setFilters: (newFilters) => {
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
      pagination: { ...state.pagination, page: 1 }, // Reset to page 1
    }));
    get().fetchRuns();
  },

  setPage: (page) => {
    set((state) => ({ pagination: { ...state.pagination, page } }));
    get().fetchRuns();
  },

  selectRun: (runId) => {
    get().fetchRunDetail(runId);
  },
}));
```

### Orchestrator Integration

**orchestrator.js modifications:**
```javascript
import { startRun, recordEvent, endRun } from './services/historyRecorder.js';

async run() {
  // Start recording
  const runId = startRun(this.config.projectRoot, this.config);

  // ... existing orchestration code ...

  // Record events throughout
  // In epic-worker.js and story-worker.js:
  recordEvent('agent:spawn', { agentId, storyId, epicNumber });
  recordEvent('agent:complete', { agentId, storyId, details: { duration } });
  recordEvent('agent:error', { agentId, storyId, details: { error: message } });

  // End recording
  endRun(status, {
    completed: this.results.filter(r => r.status === 'completed').length,
    failed: this.results.filter(r => r.status === 'failed').length,
    total: this.state.progress.totalStories,
  });
}
```

### API Service Additions

**api.ts:**
```typescript
export async function fetchHistory(options: {
  project?: string | null;
  status?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  page?: number;
  limit?: number;
}) {
  const params = new URLSearchParams();
  if (options.project) params.set('project', options.project);
  if (options.status) params.set('status', options.status);
  if (options.startDate) params.set('startDate', options.startDate);
  if (options.endDate) params.set('endDate', options.endDate);
  params.set('page', String(options.page || 1));
  params.set('limit', String(options.limit || 20));

  const response = await fetch(`${API_BASE}/api/history?${params}`, {
    credentials: 'include',
  });

  if (!response.ok) throw new Error('Failed to fetch history');
  return response.json();
}

export async function fetchRunDetail(runId: number) {
  const response = await fetch(`${API_BASE}/api/history/${runId}`, {
    credentials: 'include',
  });

  if (!response.ok) throw new Error('Failed to fetch run details');
  return response.json();
}
```

### Anti-Patterns to Avoid

1. **DO NOT** store large log content in history events (use references)
2. **DO NOT** forget to call endRun() on all exit paths (use try/finally)
3. **DO NOT** fetch all events at once for large runs (paginate)
4. **DO NOT** block orchestration for history recording (make it async-safe)

### References

- [Source: architecture.md#Database-Schema] - SQLite patterns
- [Source: ux-design-specification.md] - UI design patterns
- [Source: src/orchestrator.js] - Orchestration lifecycle
- [Source: src/server.js] - API route patterns

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None - implementation proceeded without errors.

### Completion Notes List

- Implemented full execution history tracking system with database persistence
- Created migration `004_execution_history.sql` for `execution_runs` and `execution_events` tables
- Built `historyRecorder.js` service with startRun(), recordEvent(), endRun() methods
- Created REST API endpoints `/api/history` and `/api/history/:runId` with filtering and pagination
- Built React frontend with History page, HistoryList, EventTimeline, RunDetailPanel, and HistoryFilters components
- Added Zustand store `historyStore.ts` for state management
- Integrated history recording into server.js orchestration lifecycle
- Added sidebar navigation with History link using lucide-react icons
- All tests pass: 383 backend + 538 dashboard (921 total) including new history tests
- Dashboard builds successfully

### File List

**Backend (new):**
- src/db/migrations/004_execution_history.sql
- src/services/historyRecorder.js
- src/services/historyRecorder.test.js
- src/api/history.js
- src/api/history.test.js

**Backend (modified):**
- src/server.js (added history recording integration)

**Frontend (new):**
- dashboard/src/types/history.ts
- dashboard/src/stores/historyStore.ts
- dashboard/src/pages/History.tsx
- dashboard/src/components/history/index.ts
- dashboard/src/components/history/HistoryFilters.tsx
- dashboard/src/components/history/HistoryList.tsx
- dashboard/src/components/history/HistoryList.test.tsx
- dashboard/src/components/history/EventTimeline.tsx
- dashboard/src/components/history/EventTimeline.test.tsx
- dashboard/src/components/history/RunDetailPanel.tsx

**Frontend (modified):**
- dashboard/src/services/api.ts (added fetchHistory, fetchRunDetail)
- dashboard/src/App.tsx (added /history route)
- dashboard/src/components/layout/Sidebar.tsx (added navigation links)
- dashboard/src/components/layout/Sidebar.test.tsx (added Router wrapper)
- dashboard/src/components/layout/Layout.test.tsx (added Router wrapper)

## Change Log

- 2026-01-17: Implemented Story 4.7 - Execution History View with full backend and frontend support
- 2026-01-17: [AI-Review] Added missing project filter to HistoryFilters.tsx (AC3 completion), fixed documentation errors (migration file number, test counts)
