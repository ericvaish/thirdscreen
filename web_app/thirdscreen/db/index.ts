/**
 * Database connection layer.
 *
 * Supports two backends controlled by the STORAGE env var:
 *
 * - STORAGE=d1    -- Cloudflare D1 (hosted production)
 * - STORAGE=sqlite (default) -- better-sqlite3 local file (self-hosted / dev)
 *
 * Both use the same Drizzle schema (sqlite-core). The exported `db` object
 * has the same type and API regardless of backend.
 */

import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3"
import * as schema from "./schema"

type DbInstance = BetterSQLite3Database<typeof schema>

// ── Types ───────────────────────────────────────────────────────────────────

// Cloudflare Workers bindings (available in D1 mode)
export interface CloudflareEnv {
  DB: D1Database
}

// Re-export for convenience
export type { D1Database }

// D1Database type for environments without @cloudflare/workers-types
interface D1Database {
  prepare: (query: string) => D1PreparedStatement
  batch: <T>(statements: D1PreparedStatement[]) => Promise<D1Result<T>[]>
  exec: (query: string) => Promise<D1ExecResult>
}

interface D1PreparedStatement {
  bind: (...values: unknown[]) => D1PreparedStatement
  first: <T = unknown>(colName?: string) => Promise<T | null>
  run: () => Promise<D1Result<unknown>>
  all: <T = unknown>() => Promise<D1Result<T>>
}

interface D1Result<T> {
  results: T[]
  success: boolean
  meta: Record<string, unknown>
}

interface D1ExecResult {
  count: number
  duration: number
}

// ── DB instance ─────────────────────────────────────────────────────────────

const isD1 = process.env.STORAGE === "d1"

// For SQLite mode: eagerly initialize
let _db: DbInstance | null = null

function getSqliteDb(): DbInstance {
  if (_db) return _db

  // Dynamic import to avoid bundling better-sqlite3 in D1 builds
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require("better-sqlite3")
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require("drizzle-orm/better-sqlite3")
  const path = require("path")

  const DB_PATH = path.join(process.cwd(), "thirdscreen.db")
  const sqlite = new Database(DB_PATH)
  sqlite.pragma("journal_mode = WAL")
  sqlite.pragma("foreign_keys = ON")

  _db = drizzle(sqlite, { schema })

  // Initialize tables
  sqlite.exec(INIT_SQL)

  // Seed defaults
  const cardCount = sqlite
    .prepare("SELECT COUNT(*) as count FROM cards")
    .get() as { count: number }
  if (cardCount.count === 0) {
    seedDefaults(sqlite)
  }

  return _db!
}

// For D1 mode: get db from the request context's D1 binding
export function getD1Db(d1: D1Database): DbInstance {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require("drizzle-orm/d1")
  return drizzle(d1, { schema }) as DbInstance
}

// Main export: for SQLite mode this works directly.
// For D1 mode, API routes must call getD1Db() with the binding instead.
// Lazy getter so the DB is only initialized on first use, not at import time.
// This avoids circular dependency issues during build.
// In D1 mode, API routes must use getD1Db(env.DB) instead.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _lazy: { db?: DbInstance } = {}
export const db = new Proxy({} as DbInstance, {
  get(_target, prop) {
    if (!_lazy.db) {
      if (isD1) {
        throw new Error(
          `Cannot use db.${String(prop)} in D1 mode. Use getD1Db(env.DB) instead.`
        )
      }
      _lazy.db = getSqliteDb()
    }
    return (_lazy.db as unknown as Record<string | symbol, unknown>)[prop]
  },
})

// ── Shared SQL ──────────────────────────────────────────────────────────────

export const INIT_SQL = `
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

  CREATE TABLE IF NOT EXISTS links (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT '',
    card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    title TEXT,
    pinned INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

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

  CREATE TABLE IF NOT EXISTS medicine_dose_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT '',
    medicine_id TEXT NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
    time_id TEXT NOT NULL,
    taken_at TEXT NOT NULL,
    date TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS food_items (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT '',
    card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    calories REAL NOT NULL,
    date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS water_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT '',
    card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    ml INTEGER NOT NULL,
    date TEXT NOT NULL
  );

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

  CREATE TABLE IF NOT EXISTS enabled_integrations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT '',
    integration_id TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    config TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, integration_id)
  );
`

// ── Seed data ───────────────────────────────────────────────────────────────

function seedDefaults(sqlite: { prepare: (sql: string) => { run: (...args: unknown[]) => void } }) {
  const defaultCards = [
    { id: "clock-1", type: "clock", title: "Clock", x: 0, y: 0, w: 4, h: 3 },
    { id: "todo-1", type: "todo", title: "To-Do List", x: 4, y: 0, w: 4, h: 6 },
    { id: "notes-1", type: "notes", title: "Notes", x: 8, y: 0, w: 4, h: 6 },
    { id: "timer-1", type: "timer", title: "Timer", x: 0, y: 3, w: 4, h: 3 },
    { id: "schedule-1", type: "schedule", title: "Schedule", x: 0, y: 6, w: 4, h: 6 },
    { id: "calories-1", type: "calories", title: "Calories", x: 4, y: 6, w: 4, h: 6 },
    { id: "medicines-1", type: "medicines", title: "Medicines", x: 8, y: 6, w: 4, h: 6 },
  ]

  const insert = sqlite.prepare(
    "INSERT INTO cards (id, type, title, x, y, w, h, visible, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))"
  )
  for (const card of defaultCards) {
    insert.run(card.id, card.type, card.title, card.x, card.y, card.w, card.h)
  }

  const defaultIntegrations = [
    "local-calendar", "local-calories", "local-water", "local-medicines",
    "local-todos", "local-notes", "local-clock", "local-timer",
  ]

  const insertIntegration = sqlite.prepare(
    "INSERT INTO enabled_integrations (id, integration_id, enabled, created_at) VALUES (?, ?, 1, datetime('now'))"
  )
  for (const integrationId of defaultIntegrations) {
    insertIntegration.run(integrationId, integrationId)
  }
}

export { INIT_SQL as initSQL }
