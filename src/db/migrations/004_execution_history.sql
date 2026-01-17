-- Execution runs table for tracking orchestration sessions
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

-- Execution events table for timeline of actions during a run
CREATE TABLE IF NOT EXISTS execution_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  type TEXT NOT NULL, -- agent:spawn, agent:complete, agent:error, agent:stuck, story:verified, story:mismatch
  agent_id TEXT,
  story_id TEXT,
  epic_number INTEGER,
  details TEXT, -- JSON: event-specific data
  FOREIGN KEY (run_id) REFERENCES execution_runs(id) ON DELETE CASCADE
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_runs_project ON execution_runs(project);
CREATE INDEX IF NOT EXISTS idx_runs_status ON execution_runs(status);
CREATE INDEX IF NOT EXISTS idx_runs_started_at ON execution_runs(started_at);
CREATE INDEX IF NOT EXISTS idx_events_run_id ON execution_events(run_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON execution_events(type);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON execution_events(timestamp);
