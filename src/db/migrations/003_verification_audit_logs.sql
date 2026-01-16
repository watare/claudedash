-- Verification audit log table for tracking status verification attempts
-- Story 3.5: Verification Logging & Audit

CREATE TABLE IF NOT EXISTS verification_audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  story_id TEXT NOT NULL,
  project_id TEXT,
  claimed_status TEXT NOT NULL,
  actual_status TEXT NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('match', 'mismatch', 'error')),
  action_taken TEXT,
  duration_ms INTEGER,
  attempt_count INTEGER DEFAULT 1,
  details TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_verification_audit_logs_story ON verification_audit_logs(story_id);
CREATE INDEX IF NOT EXISTS idx_verification_audit_logs_project ON verification_audit_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_verification_audit_logs_timestamp ON verification_audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_verification_audit_logs_result ON verification_audit_logs(result);
