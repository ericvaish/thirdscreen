-- Initial schema for Third Screen D1 database
-- All user-facing tables have a user_id column for multi-tenancy

CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL,
  title TEXT,
  x INTEGER NOT NULL DEFAULT 0,
  y INTEGER NOT NULL DEFAULT 0,
  w INTEGER NOT NULL DEFAULT 4,
  h INTEGER NOT NULL DEFAULT 4,
  visible INTEGER NOT NULL DEFAULT 1,
  settings TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cards_user ON cards(user_id);

CREATE TABLE IF NOT EXISTS todos (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT '',
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  scheduled_date TEXT,
  scheduled_time TEXT,
  duration INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_todos_user ON todos(user_id);

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT '',
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  pinned INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_id);

CREATE TABLE IF NOT EXISTS links (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT '',
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT,
  pinned INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_links_user ON links(user_id);

CREATE TABLE IF NOT EXISTS medicines (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT '',
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  dosage TEXT,
  times TEXT NOT NULL DEFAULT '[]',
  repeat_pattern TEXT NOT NULL DEFAULT 'daily',
  active_days TEXT NOT NULL DEFAULT '[0,1,2,3,4,5,6]',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_medicines_user ON medicines(user_id);

CREATE TABLE IF NOT EXISTS medicine_dose_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT '',
  medicine_id TEXT NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
  time_id TEXT NOT NULL,
  taken_at TEXT NOT NULL,
  date TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_dose_logs_user ON medicine_dose_logs(user_id);

CREATE TABLE IF NOT EXISTS food_items (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT '',
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  calories REAL NOT NULL,
  date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_food_user ON food_items(user_id);

CREATE TABLE IF NOT EXISTS water_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT '',
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  ml INTEGER NOT NULL,
  date TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_water_user ON water_logs(user_id);

CREATE TABLE IF NOT EXISTS schedule_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT '',
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  all_day INTEGER NOT NULL DEFAULT 0,
  color TEXT DEFAULT '#3b82f6',
  location TEXT,
  description TEXT,
  date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_schedule_user ON schedule_events(user_id);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT NOT NULL,
  user_id TEXT NOT NULL DEFAULT '',
  value TEXT,
  PRIMARY KEY (key, user_id)
);

CREATE TABLE IF NOT EXISTS lyrics_cache (
  id TEXT PRIMARY KEY,
  track TEXT NOT NULL,
  artist TEXT NOT NULL,
  album TEXT NOT NULL,
  instrumental INTEGER NOT NULL DEFAULT 0,
  synced_lyrics TEXT,
  plain_lyrics TEXT,
  fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS calendar_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT '',
  provider TEXT NOT NULL,
  email TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expiry INTEGER NOT NULL,
  calendar_ids TEXT NOT NULL DEFAULT '[]',
  color TEXT DEFAULT '#3b82f6',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_calendar_user ON calendar_accounts(user_id);

CREATE TABLE IF NOT EXISTS enabled_integrations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT '',
  integration_id TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  config TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, integration_id)
);
CREATE INDEX IF NOT EXISTS idx_integrations_user ON enabled_integrations(user_id);
