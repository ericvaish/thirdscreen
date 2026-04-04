-- Google service accounts for Gmail and Chat integrations
-- Separate from calendar_accounts to keep OAuth scopes independent

CREATE TABLE IF NOT EXISTS google_service_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT '',
  service TEXT NOT NULL,  -- 'gmail' or 'chat'
  email TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expiry INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_google_service_user ON google_service_accounts(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_google_service_unique ON google_service_accounts(user_id, service, email);
