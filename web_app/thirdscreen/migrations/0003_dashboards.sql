CREATE TABLE IF NOT EXISTS dashboards (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT 'Main',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_default INTEGER NOT NULL DEFAULT 0,
  layout_landscape TEXT,
  layout_portrait TEXT,
  hidden_zones TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
