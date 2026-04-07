CREATE TABLE IF NOT EXISTS jira_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  display_name TEXT,
  cloud_id TEXT NOT NULL,
  site_url TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expiry INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_jira_user ON jira_accounts(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_jira_unique ON jira_accounts(user_id, cloud_id, email);
