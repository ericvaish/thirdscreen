import { ipcMain } from "electron"
import { v4 as uuid } from "uuid"
import { getDb } from "./database"

// Helper: parse JSON fields from SQLite rows
function parseJsonFields<T extends Record<string, unknown>>(
  row: T,
  fields: string[]
): T {
  const result = { ...row }
  for (const field of fields) {
    if (typeof result[field] === "string") {
      try {
        ;(result as Record<string, unknown>)[field] = JSON.parse(result[field] as string)
      } catch {
        // leave as string
      }
    }
  }
  return result
}

// Helper: convert SQLite booleans (0/1) to JS booleans
function toBool<T extends Record<string, unknown>>(
  row: T,
  fields: string[]
): T {
  const result = { ...row }
  for (const field of fields) {
    ;(result as Record<string, unknown>)[field] = !!(result[field])
  }
  return result
}

// Helper: map snake_case DB rows to camelCase
function toCamel(row: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) {
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
    result[camelKey] = value
  }
  return result
}

function processCardRow(row: Record<string, unknown>) {
  const r = toCamel(row)
  r.visible = !!r.visible
  if (typeof r.settings === "string") {
    try { r.settings = JSON.parse(r.settings as string) } catch { r.settings = null }
  }
  return r
}

function processTodoRow(row: Record<string, unknown>) {
  const r = toCamel(row)
  r.completed = !!r.completed
  return r
}

function processNoteRow(row: Record<string, unknown>) {
  const r = toCamel(row)
  r.pinned = !!r.pinned
  return r
}

function processLinkRow(row: Record<string, unknown>) {
  const r = toCamel(row)
  r.pinned = !!r.pinned
  return r
}

function processMedicineRow(row: Record<string, unknown>) {
  const r = toCamel(row)
  r.active = !!r.active
  if (typeof r.times === "string") {
    try { r.times = JSON.parse(r.times as string) } catch { r.times = [] }
  }
  if (typeof r.activeDays === "string") {
    try { r.activeDays = JSON.parse(r.activeDays as string) } catch { r.activeDays = [] }
  }
  return r
}

function processEventRow(row: Record<string, unknown>) {
  const r = toCamel(row)
  r.allDay = !!r.allDay
  return r
}

export function registerIpcHandlers() {
  const db = getDb()

  // ── Layout ──────────────────────────────────────────────────────────────

  ipcMain.handle("db:layout:get", () => {
    const rows = db.prepare("SELECT * FROM cards ORDER BY y, x").all()
    return rows.map((r) => processCardRow(r as Record<string, unknown>))
  })

  ipcMain.handle("db:layout:update", (_event, positions: { id: string; x: number; y: number; w: number; h: number }[]) => {
    const stmt = db.prepare("UPDATE cards SET x = ?, y = ?, w = ?, h = ? WHERE id = ?")
    const tx = db.transaction(() => {
      for (const p of positions) {
        stmt.run(p.x, p.y, p.w, p.h, p.id)
      }
    })
    tx()
    const rows = db.prepare("SELECT * FROM cards ORDER BY y, x").all()
    return rows.map((r) => processCardRow(r as Record<string, unknown>))
  })

  // ── Cards ───────────────────────────────────────────────────────────────

  ipcMain.handle("db:cards:create", (_event, data: { type: string; title?: string; w?: number; h?: number }) => {
    const id = uuid()
    const maxY = (db.prepare("SELECT MAX(y + h) as maxY FROM cards").get() as { maxY: number | null })?.maxY ?? 0
    db.prepare(
      "INSERT INTO cards (id, type, title, x, y, w, h, visible, created_at) VALUES (?, ?, ?, 0, ?, ?, ?, 1, datetime('now'))"
    ).run(id, data.type, data.title ?? null, maxY, data.w ?? 4, data.h ?? 4)
    const row = db.prepare("SELECT * FROM cards WHERE id = ?").get(id) as Record<string, unknown>
    return processCardRow(row)
  })

  ipcMain.handle("db:cards:delete", (_event, data: { id: string }) => {
    db.prepare("DELETE FROM cards WHERE id = ?").run(data.id)
    return { success: true }
  })

  // ── Todos ───────────────────────────────────────────────────────────────

  ipcMain.handle("db:todos:list", (_event, data?: { cardId?: string }) => {
    let rows
    if (data?.cardId) {
      rows = db.prepare("SELECT * FROM todos WHERE card_id = ? ORDER BY sort_order").all(data.cardId)
    } else {
      rows = db.prepare("SELECT * FROM todos ORDER BY sort_order").all()
    }
    return rows.map((r) => processTodoRow(r as Record<string, unknown>))
  })

  ipcMain.handle("db:todos:create", (_event, data: { cardId: string; title: string; scheduledDate?: string; scheduledTime?: string; duration?: number; sortOrder?: number }) => {
    const id = uuid()
    db.prepare(
      "INSERT INTO todos (id, card_id, title, completed, scheduled_date, scheduled_time, duration, sort_order, created_at) VALUES (?, ?, ?, 0, ?, ?, ?, ?, datetime('now'))"
    ).run(id, data.cardId, data.title, data.scheduledDate ?? null, data.scheduledTime ?? null, data.duration ?? null, data.sortOrder ?? 0)
    const row = db.prepare("SELECT * FROM todos WHERE id = ?").get(id) as Record<string, unknown>
    return processTodoRow(row)
  })

  ipcMain.handle("db:todos:update", (_event, data: { id: string; [key: string]: unknown }) => {
    const { id, ...updates } = data
    const sets: string[] = []
    const values: unknown[] = []

    const fieldMap: Record<string, string> = {
      title: "title", completed: "completed", scheduledDate: "scheduled_date",
      scheduledTime: "scheduled_time", duration: "duration", sortOrder: "sort_order",
    }

    for (const [key, col] of Object.entries(fieldMap)) {
      if (key in updates) {
        sets.push(`${col} = ?`)
        values.push(updates[key])
      }
    }

    if (sets.length > 0) {
      values.push(id)
      db.prepare(`UPDATE todos SET ${sets.join(", ")} WHERE id = ?`).run(...values)
    }

    const row = db.prepare("SELECT * FROM todos WHERE id = ?").get(id) as Record<string, unknown>
    return processTodoRow(row)
  })

  ipcMain.handle("db:todos:delete", (_event, data: { id: string }) => {
    db.prepare("DELETE FROM todos WHERE id = ?").run(data.id)
    return { success: true }
  })

  // ── Notes ───────────────────────────────────────────────────────────────

  ipcMain.handle("db:notes:list", (_event, data?: { cardId?: string }) => {
    let rows
    if (data?.cardId) {
      rows = db.prepare("SELECT * FROM notes WHERE card_id = ? ORDER BY sort_order").all(data.cardId)
    } else {
      rows = db.prepare("SELECT * FROM notes ORDER BY sort_order").all()
    }
    return rows.map((r) => processNoteRow(r as Record<string, unknown>))
  })

  ipcMain.handle("db:notes:create", (_event, data: { cardId: string; content?: string; pinned?: boolean; sortOrder?: number }) => {
    const id = uuid()
    const now = new Date().toISOString()
    db.prepare(
      "INSERT INTO notes (id, card_id, content, pinned, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(id, data.cardId, data.content ?? "", data.pinned ? 1 : 0, data.sortOrder ?? 0, now, now)
    const row = db.prepare("SELECT * FROM notes WHERE id = ?").get(id) as Record<string, unknown>
    return processNoteRow(row)
  })

  ipcMain.handle("db:notes:update", (_event, data: { id: string; content?: string; pinned?: boolean }) => {
    const { id, ...updates } = data
    const sets: string[] = ["updated_at = datetime('now')"]
    const values: unknown[] = []

    if ("content" in updates) { sets.push("content = ?"); values.push(updates.content) }
    if ("pinned" in updates) { sets.push("pinned = ?"); values.push(updates.pinned ? 1 : 0) }

    values.push(id)
    db.prepare(`UPDATE notes SET ${sets.join(", ")} WHERE id = ?`).run(...values)

    const row = db.prepare("SELECT * FROM notes WHERE id = ?").get(id) as Record<string, unknown>
    return processNoteRow(row)
  })

  ipcMain.handle("db:notes:delete", (_event, data: { id: string }) => {
    db.prepare("DELETE FROM notes WHERE id = ?").run(data.id)
    return { success: true }
  })

  // ── Links ───────────────────────────────────────────────────────────────

  ipcMain.handle("db:links:list", (_event, data?: { cardId?: string }) => {
    let rows
    if (data?.cardId) {
      rows = db.prepare("SELECT * FROM links WHERE card_id = ? ORDER BY created_at DESC").all(data.cardId)
    } else {
      rows = db.prepare("SELECT * FROM links ORDER BY created_at DESC").all()
    }
    return rows.map((r) => processLinkRow(r as Record<string, unknown>))
  })

  ipcMain.handle("db:links:create", (_event, data: { cardId: string; url: string; title?: string; pinned?: boolean }) => {
    const id = uuid()
    db.prepare(
      "INSERT INTO links (id, card_id, url, title, pinned, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))"
    ).run(id, data.cardId, data.url, data.title ?? null, data.pinned ? 1 : 0)
    const row = db.prepare("SELECT * FROM links WHERE id = ?").get(id) as Record<string, unknown>
    return processLinkRow(row)
  })

  ipcMain.handle("db:links:delete", (_event, data: { id: string }) => {
    db.prepare("DELETE FROM links WHERE id = ?").run(data.id)
    return { success: true }
  })

  // ── Schedule ────────────────────────────────────────────────────────────

  ipcMain.handle("db:schedule:list", (_event, data: { date: string; cardId?: string }) => {
    let rows
    if (data.cardId) {
      rows = db.prepare("SELECT * FROM schedule_events WHERE date = ? AND card_id = ? ORDER BY start_time").all(data.date, data.cardId)
    } else {
      rows = db.prepare("SELECT * FROM schedule_events WHERE date = ? ORDER BY start_time").all(data.date)
    }
    return rows.map((r) => processEventRow(r as Record<string, unknown>))
  })

  ipcMain.handle("db:schedule:create", (_event, data: { cardId: string; title: string; startTime: string; endTime: string; date: string; allDay?: boolean; color?: string; location?: string; description?: string }) => {
    const id = uuid()
    db.prepare(
      "INSERT INTO schedule_events (id, card_id, title, start_time, end_time, all_day, color, location, description, date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))"
    ).run(id, data.cardId, data.title, data.startTime, data.endTime, data.allDay ? 1 : 0, data.color ?? "#3b82f6", data.location ?? null, data.description ?? null, data.date)
    const row = db.prepare("SELECT * FROM schedule_events WHERE id = ?").get(id) as Record<string, unknown>
    return processEventRow(row)
  })

  ipcMain.handle("db:schedule:update", (_event, data: { id: string; [key: string]: unknown }) => {
    const { id, ...updates } = data
    const sets: string[] = []
    const values: unknown[] = []

    const fieldMap: Record<string, string> = {
      title: "title", startTime: "start_time", endTime: "end_time",
      allDay: "all_day", color: "color", location: "location",
      description: "description", date: "date",
    }

    for (const [key, col] of Object.entries(fieldMap)) {
      if (key in updates) {
        sets.push(`${col} = ?`)
        const val = updates[key]
        values.push(key === "allDay" ? (val ? 1 : 0) : val)
      }
    }

    if (sets.length > 0) {
      values.push(id)
      db.prepare(`UPDATE schedule_events SET ${sets.join(", ")} WHERE id = ?`).run(...values)
    }

    const row = db.prepare("SELECT * FROM schedule_events WHERE id = ?").get(id) as Record<string, unknown>
    return processEventRow(row)
  })

  ipcMain.handle("db:schedule:delete", (_event, data: { id: string }) => {
    db.prepare("DELETE FROM schedule_events WHERE id = ?").run(data.id)
    return { success: true }
  })

  // ── Calories (Food Items) ──────────────────────────────────────────────

  ipcMain.handle("db:calories:list", (_event, data: { date: string; cardId?: string }) => {
    let rows
    if (data.cardId) {
      rows = db.prepare("SELECT * FROM food_items WHERE date = ? AND card_id = ? ORDER BY created_at").all(data.date, data.cardId)
    } else {
      rows = db.prepare("SELECT * FROM food_items WHERE date = ? ORDER BY created_at").all(data.date)
    }
    return rows.map((r) => toCamel(r as Record<string, unknown>))
  })

  ipcMain.handle("db:calories:create", (_event, data: { cardId: string; name: string; calories: number; date: string }) => {
    const id = uuid()
    db.prepare(
      "INSERT INTO food_items (id, card_id, name, calories, date, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))"
    ).run(id, data.cardId, data.name, data.calories, data.date)
    const row = db.prepare("SELECT * FROM food_items WHERE id = ?").get(id) as Record<string, unknown>
    return toCamel(row)
  })

  ipcMain.handle("db:calories:delete", (_event, data: { id: string }) => {
    db.prepare("DELETE FROM food_items WHERE id = ?").run(data.id)
    return { success: true }
  })

  // ── Water ──────────────────────────────────────────────────────────────

  ipcMain.handle("db:water:get", (_event, data: { date: string; cardId?: string }) => {
    let row
    if (data.cardId) {
      row = db.prepare("SELECT * FROM water_logs WHERE date = ? AND card_id = ?").get(data.date, data.cardId) as Record<string, unknown> | undefined
    } else {
      row = db.prepare("SELECT * FROM water_logs WHERE date = ?").get(data.date) as Record<string, unknown> | undefined
    }
    if (!row) return { intake: 0, goal: 2000 }
    return { intake: row.ml, goal: 2000 }
  })

  ipcMain.handle("db:water:upsert", (_event, data: { cardId: string; date: string; intake: number }) => {
    const existing = db.prepare("SELECT id FROM water_logs WHERE date = ? AND card_id = ?").get(data.date, data.cardId) as { id: string } | undefined
    if (existing) {
      db.prepare("UPDATE water_logs SET ml = ? WHERE id = ?").run(data.intake, existing.id)
    } else {
      const id = uuid()
      db.prepare("INSERT INTO water_logs (id, card_id, ml, date) VALUES (?, ?, ?, ?)").run(id, data.cardId, data.intake, data.date)
    }
    return { intake: data.intake, goal: 2000 }
  })

  // ── Medicines ──────────────────────────────────────────────────────────

  ipcMain.handle("db:medicines:list", (_event, data?: { cardId?: string }) => {
    let rows
    if (data?.cardId) {
      rows = db.prepare("SELECT * FROM medicines WHERE card_id = ? ORDER BY created_at").all(data.cardId)
    } else {
      rows = db.prepare("SELECT * FROM medicines ORDER BY created_at").all()
    }
    return rows.map((r) => processMedicineRow(r as Record<string, unknown>))
  })

  ipcMain.handle("db:medicines:create", (_event, data: { cardId: string; name: string; dosage?: string; times: unknown[]; repeatPattern?: string; activeDays?: number[] }) => {
    const id = uuid()
    db.prepare(
      "INSERT INTO medicines (id, card_id, name, dosage, times, repeat_pattern, active_days, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))"
    ).run(id, data.cardId, data.name, data.dosage ?? null, JSON.stringify(data.times), data.repeatPattern ?? "daily", JSON.stringify(data.activeDays ?? [0,1,2,3,4,5,6]))
    const row = db.prepare("SELECT * FROM medicines WHERE id = ?").get(id) as Record<string, unknown>
    return processMedicineRow(row)
  })

  ipcMain.handle("db:medicines:update", (_event, data: { id: string; [key: string]: unknown }) => {
    const { id, ...updates } = data
    const sets: string[] = []
    const values: unknown[] = []

    if ("name" in updates) { sets.push("name = ?"); values.push(updates.name) }
    if ("dosage" in updates) { sets.push("dosage = ?"); values.push(updates.dosage) }
    if ("times" in updates) { sets.push("times = ?"); values.push(JSON.stringify(updates.times)) }
    if ("repeatPattern" in updates) { sets.push("repeat_pattern = ?"); values.push(updates.repeatPattern) }
    if ("activeDays" in updates) { sets.push("active_days = ?"); values.push(JSON.stringify(updates.activeDays)) }
    if ("active" in updates) { sets.push("active = ?"); values.push(updates.active ? 1 : 0) }

    if (sets.length > 0) {
      values.push(id)
      db.prepare(`UPDATE medicines SET ${sets.join(", ")} WHERE id = ?`).run(...values)
    }

    const row = db.prepare("SELECT * FROM medicines WHERE id = ?").get(id) as Record<string, unknown>
    return processMedicineRow(row)
  })

  ipcMain.handle("db:medicines:delete", (_event, data: { id: string }) => {
    db.prepare("DELETE FROM medicines WHERE id = ?").run(data.id)
    return { success: true }
  })

  // ── Medicine Doses ─────────────────────────────────────────────────────

  ipcMain.handle("db:doses:list", (_event, data: { medicineId: string; date: string }) => {
    const rows = db.prepare(
      "SELECT medicine_id, time_id, taken_at, date FROM medicine_dose_logs WHERE medicine_id = ? AND date = ?"
    ).all(data.medicineId, data.date) as Record<string, unknown>[]

    return rows.map((r) => ({
      medicineId: r.medicine_id,
      timeId: r.time_id,
      taken: true,
    }))
  })

  ipcMain.handle("db:doses:toggle", (_event, data: { medicineId: string; timeId: string; date: string }) => {
    const existing = db.prepare(
      "SELECT id FROM medicine_dose_logs WHERE medicine_id = ? AND time_id = ? AND date = ?"
    ).get(data.medicineId, data.timeId, data.date) as { id: string } | undefined

    if (existing) {
      db.prepare("DELETE FROM medicine_dose_logs WHERE id = ?").run(existing.id)
      return { taken: false }
    } else {
      const id = uuid()
      db.prepare(
        "INSERT INTO medicine_dose_logs (id, medicine_id, time_id, taken_at, date) VALUES (?, ?, ?, datetime('now'), ?)"
      ).run(id, data.medicineId, data.timeId, data.date)
      return { taken: true }
    }
  })

  // ── Settings ───────────────────────────────────────────────────────────

  ipcMain.handle("db:settings:get", () => {
    const rows = db.prepare("SELECT key, value FROM settings").all() as { key: string; value: string | null }[]
    const result: Record<string, unknown> = {}
    for (const row of rows) {
      try { result[row.key] = row.value ? JSON.parse(row.value) : null } catch { result[row.key] = row.value }
    }
    return result
  })

  ipcMain.handle("db:settings:set", (_event, data: { key: string; value: unknown }) => {
    const valueStr = JSON.stringify(data.value)
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(data.key, valueStr)
    return { success: true }
  })

  // ── Integrations ───────────────────────────────────────────────────────

  ipcMain.handle("db:integrations:list", () => {
    const rows = db.prepare("SELECT * FROM enabled_integrations ORDER BY created_at").all()
    return rows.map((r) => {
      const row = toCamel(r as Record<string, unknown>)
      row.enabled = !!row.enabled
      if (typeof row.config === "string") {
        try { row.config = JSON.parse(row.config as string) } catch { row.config = null }
      }
      return row
    })
  })

  ipcMain.handle("db:integrations:toggle", (_event, data: { integrationId: string; enabled: boolean }) => {
    const existing = db.prepare("SELECT id FROM enabled_integrations WHERE integration_id = ?").get(data.integrationId) as { id: string } | undefined
    if (existing) {
      db.prepare("UPDATE enabled_integrations SET enabled = ? WHERE id = ?").run(data.enabled ? 1 : 0, existing.id)
    } else {
      const id = uuid()
      db.prepare(
        "INSERT INTO enabled_integrations (id, integration_id, enabled, created_at) VALUES (?, ?, ?, datetime('now'))"
      ).run(id, data.integrationId, data.enabled ? 1 : 0)
    }
    return { success: true }
  })
}
