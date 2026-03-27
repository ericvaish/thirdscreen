import { sqliteTable, text, integer, real, primaryKey } from "drizzle-orm/sqlite-core"

// Dashboard layout - stores card positions and sizes
export const cards = sqliteTable("cards", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().default(""),
  type: text("type").notNull(),
  title: text("title"),
  x: integer("x").notNull().default(0),
  y: integer("y").notNull().default(0),
  w: integer("w").notNull().default(4),
  h: integer("h").notNull().default(4),
  visible: integer("visible", { mode: "boolean" }).notNull().default(true),
  settings: text("settings", { mode: "json" }).$type<Record<string, unknown>>(),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
})

// Todo items
export const todos = sqliteTable("todos", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().default(""),
  cardId: text("card_id")
    .notNull()
    .references(() => cards.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  completed: integer("completed", { mode: "boolean" })
    .notNull()
    .default(false),
  scheduledDate: text("scheduled_date"),
  scheduledTime: text("scheduled_time"),
  duration: integer("duration"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
})

// Notes
export const notes = sqliteTable("notes", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().default(""),
  cardId: text("card_id")
    .notNull()
    .references(() => cards.id, { onDelete: "cascade" }),
  content: text("content").notNull().default(""),
  pinned: integer("pinned", { mode: "boolean" }).notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
})

// Links (part of Notes)
export const links = sqliteTable("links", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().default(""),
  cardId: text("card_id")
    .notNull()
    .references(() => cards.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  title: text("title"),
  pinned: integer("pinned", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
})

// Medicine items
export const medicines = sqliteTable("medicines", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().default(""),
  cardId: text("card_id")
    .notNull()
    .references(() => cards.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  dosage: text("dosage"),
  times: text("times", { mode: "json" })
    .$type<{ hour: number; minute: number; id: string }[]>()
    .notNull()
    .default([]),
  repeatPattern: text("repeat_pattern").notNull().default("daily"),
  activeDays: text("active_days", { mode: "json" })
    .$type<number[]>()
    .notNull()
    .default([0, 1, 2, 3, 4, 5, 6]),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
})

// Medicine dose logs
export const medicineDoseLogs = sqliteTable("medicine_dose_logs", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().default(""),
  medicineId: text("medicine_id")
    .notNull()
    .references(() => medicines.id, { onDelete: "cascade" }),
  timeId: text("time_id").notNull(),
  takenAt: text("taken_at").notNull(),
  date: text("date").notNull(),
})

// Food items (calorie tracking)
export const foodItems = sqliteTable("food_items", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().default(""),
  cardId: text("card_id")
    .notNull()
    .references(() => cards.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  calories: real("calories").notNull(),
  date: text("date").notNull(),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
})

// Water logs
export const waterLogs = sqliteTable("water_logs", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().default(""),
  cardId: text("card_id")
    .notNull()
    .references(() => cards.id, { onDelete: "cascade" }),
  ml: integer("ml").notNull(),
  date: text("date").notNull(),
})

// Schedule events
export const scheduleEvents = sqliteTable("schedule_events", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().default(""),
  cardId: text("card_id")
    .notNull()
    .references(() => cards.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  allDay: integer("all_day", { mode: "boolean" }).notNull().default(false),
  color: text("color").default("#3b82f6"),
  location: text("location"),
  description: text("description"),
  date: text("date").notNull(),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
})

// App settings (composite primary key: key + user_id)
export const settings = sqliteTable("settings", {
  key: text("key").notNull(),
  userId: text("user_id").notNull().default(""),
  value: text("value", { mode: "json" }).$type<unknown>(),
}, (table) => [
  primaryKey({ columns: [table.key, table.userId] }),
])

// Lyrics cache (shared, no user_id)
export const lyricsCache = sqliteTable("lyrics_cache", {
  id: text("id").primaryKey(),
  track: text("track").notNull(),
  artist: text("artist").notNull(),
  album: text("album").notNull(),
  instrumental: integer("instrumental", { mode: "boolean" }).notNull().default(false),
  syncedLyrics: text("synced_lyrics"),
  plainLyrics: text("plain_lyrics"),
  fetchedAt: text("fetched_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
})

// Calendar accounts
export const calendarAccounts = sqliteTable("calendar_accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().default(""),
  provider: text("provider").notNull(),
  email: text("email").notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  tokenExpiry: integer("token_expiry").notNull(),
  calendarIds: text("calendar_ids", { mode: "json" })
    .$type<string[]>()
    .notNull()
    .default([]),
  color: text("color").default("#3b82f6"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
})

// Enabled integrations
export const enabledIntegrations = sqliteTable("enabled_integrations", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().default(""),
  integrationId: text("integration_id").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  config: text("config", { mode: "json" }).$type<Record<string, unknown>>(),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
})
