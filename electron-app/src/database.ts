import Database from "better-sqlite3"
import { app } from "electron"
import path from "path"

let db: Database.Database

export function getDb(): Database.Database {
  return db
}

export function initDatabase() {
  const dbPath = path.join(app.getPath("userData"), "thirdscreen.db")
  db = new Database(dbPath)
  db.pragma("journal_mode = WAL")
  db.pragma("foreign_keys = ON")

  // Create all tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
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

    CREATE TABLE IF NOT EXISTS todos (
      id TEXT PRIMARY KEY,
      card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      scheduled_date TEXT,
      scheduled_time TEXT,
      duration INTEGER,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
      content TEXT NOT NULL DEFAULT '',
      pinned INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS links (
      id TEXT PRIMARY KEY,
      card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      title TEXT,
      pinned INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS medicines (
      id TEXT PRIMARY KEY,
      card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      dosage TEXT,
      times TEXT NOT NULL DEFAULT '[]',
      repeat_pattern TEXT NOT NULL DEFAULT 'daily',
      active_days TEXT NOT NULL DEFAULT '[0,1,2,3,4,5,6]',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS medicine_dose_logs (
      id TEXT PRIMARY KEY,
      medicine_id TEXT NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
      time_id TEXT NOT NULL,
      taken_at TEXT NOT NULL,
      date TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS food_items (
      id TEXT PRIMARY KEY,
      card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      calories REAL NOT NULL,
      date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS water_logs (
      id TEXT PRIMARY KEY,
      card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
      ml INTEGER NOT NULL,
      date TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS schedule_events (
      id TEXT PRIMARY KEY,
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

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS enabled_integrations (
      id TEXT PRIMARY KEY,
      integration_id TEXT NOT NULL UNIQUE,
      enabled INTEGER NOT NULL DEFAULT 1,
      config TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  // Seed default cards if none exist
  const cardCount = db
    .prepare("SELECT COUNT(*) as count FROM cards")
    .get() as { count: number }

  if (cardCount.count === 0) {
    const defaultCards = [
      { id: "clock-1", type: "clock", title: "Clock", x: 0, y: 0, w: 4, h: 3 },
      { id: "todo-1", type: "todo", title: "To-Do List", x: 4, y: 0, w: 4, h: 6 },
      { id: "notes-1", type: "notes", title: "Notes", x: 8, y: 0, w: 4, h: 6 },
      { id: "timer-1", type: "timer", title: "Timer", x: 0, y: 3, w: 4, h: 3 },
      { id: "schedule-1", type: "schedule", title: "Schedule", x: 0, y: 6, w: 4, h: 6 },
      { id: "calories-1", type: "calories", title: "Calories", x: 4, y: 6, w: 4, h: 6 },
      { id: "medicines-1", type: "medicines", title: "Medicines", x: 8, y: 6, w: 4, h: 6 },
    ]

    const insert = db.prepare(
      "INSERT INTO cards (id, type, title, x, y, w, h, visible, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))"
    )
    for (const card of defaultCards) {
      insert.run(card.id, card.type, card.title, card.x, card.y, card.w, card.h)
    }
  }

  // Seed default integrations if none exist
  const integrationCount = db
    .prepare("SELECT COUNT(*) as count FROM enabled_integrations")
    .get() as { count: number }

  if (integrationCount.count === 0) {
    const defaults = [
      "local-calendar", "local-calories", "local-water", "local-medicines",
      "local-todos", "local-notes", "local-clock", "local-timer",
    ]
    const insertInt = db.prepare(
      "INSERT INTO enabled_integrations (id, integration_id, enabled, created_at) VALUES (?, ?, 1, datetime('now'))"
    )
    for (const id of defaults) {
      insertInt.run(id, id)
    }
  }
}
