-- Audit log table for tracking user actions
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
