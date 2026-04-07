import { NextResponse } from "next/server"
import { getDb } from "@/lib/get-db"
import {
  todos,
  notes,
  links,
  medicines,
  medicineDoseLogs,
  foodItems,
  waterLogs,
  scheduleEvents,
  habits,
  habitLogs,
  rssFeeds,
  rssArticles,
  settings,
} from "@/db/schema"
import { eq } from "drizzle-orm"
import { v4 as uuidv4 } from "uuid"
import { requireAuth } from "@/lib/auth"

/**
 * POST /api/sync/merge
 *
 * Receives a dump of the user's localStorage data and merges it with
 * their existing server-side data. Strategy per resource:
 *
 * - Arrays (todos, notes, links, medicines, food_items, schedule_events,
 *   habits, rss_feeds): append + deduplicate by content signature.
 * - Settings: local wins for keys not already set on server.
 * - Water logs: keep the higher value per date.
 * - Medicine doses: union (add missing dose logs).
 *
 * Returns a summary of what was merged plus any conflicts for the client
 * to present to the user.
 */
export async function POST(request: Request) {
  const [userId, authError] = await requireAuth()
  if (authError) return authError

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const localData: Record<string, any> = await request.json()
    const db = getDb()
    const summary: Record<string, number> = {}
    const conflicts: { type: string; message: string; localItem: unknown; serverItem: unknown }[] = []

    // ── Todos: dedupe by title (case-insensitive) ──────────────────────
    if (Array.isArray(localData.todos) && localData.todos.length > 0) {
      const serverTodos = await db.select().from(todos).where(eq(todos.userId, userId))
      const serverTitles = new Set(serverTodos.map((t) => t.title.toLowerCase().trim()))
      let added = 0
      for (const t of localData.todos) {
        if (!t.title || serverTitles.has(t.title.toLowerCase().trim())) continue
        await db.insert(todos).values({
          id: uuidv4(),
          userId,
          cardId: t.cardId || "todo-1",
          title: t.title,
          completed: t.completed ?? false,
          scheduledDate: t.scheduledDate ?? null,
          scheduledTime: t.scheduledTime ?? null,
          duration: t.duration ?? null,
          sortOrder: t.sortOrder ?? serverTodos.length + added,
        })
        serverTitles.add(t.title.toLowerCase().trim())
        added++
      }
      summary.todos = added
    }

    // ── Notes: dedupe by content (trimmed) ─────────────────────────────
    if (Array.isArray(localData.notes) && localData.notes.length > 0) {
      const serverNotes = await db.select().from(notes).where(eq(notes.userId, userId))
      const serverContents = new Set(serverNotes.map((n) => n.content.trim()))
      let added = 0
      for (const n of localData.notes) {
        const content = (n.content ?? "").trim()
        if (!content || serverContents.has(content)) continue
        await db.insert(notes).values({
          id: uuidv4(),
          userId,
          cardId: n.cardId || "notes-1",
          content,
          pinned: n.pinned ?? false,
          sortOrder: n.sortOrder ?? serverNotes.length + added,
        })
        serverContents.add(content)
        added++
      }
      summary.notes = added
    }

    // ── Links: dedupe by URL ───────────────────────────────────────────
    if (Array.isArray(localData.links) && localData.links.length > 0) {
      const serverLinks = await db.select().from(links).where(eq(links.userId, userId))
      const serverUrls = new Set(serverLinks.map((l) => l.url))
      let added = 0
      for (const l of localData.links) {
        if (!l.url || serverUrls.has(l.url)) continue
        await db.insert(links).values({
          id: uuidv4(),
          userId,
          cardId: l.cardId || "notes-1",
          url: l.url,
          title: l.title ?? null,
          pinned: l.pinned ?? false,
        })
        serverUrls.add(l.url)
        added++
      }
      summary.links = added
    }

    // ── Schedule events: dedupe by title + date + startTime ────────────
    if (Array.isArray(localData.schedule_events) && localData.schedule_events.length > 0) {
      const serverEvents = await db.select().from(scheduleEvents).where(eq(scheduleEvents.userId, userId))
      const serverKeys = new Set(
        serverEvents.map((e) => `${e.title.toLowerCase()}|${e.date}|${e.startTime}`),
      )
      let added = 0
      for (const e of localData.schedule_events) {
        const key = `${(e.title ?? "").toLowerCase()}|${e.date}|${e.startTime}`
        if (!e.title || serverKeys.has(key)) continue
        await db.insert(scheduleEvents).values({
          id: uuidv4(),
          userId,
          cardId: e.cardId || "schedule-1",
          title: e.title,
          startTime: e.startTime,
          endTime: e.endTime,
          allDay: e.allDay ?? false,
          color: e.color ?? "#3b82f6",
          location: e.location ?? null,
          description: e.description ?? null,
          date: e.date,
        })
        serverKeys.add(key)
        added++
      }
      summary.schedule_events = added
    }

    // ── Medicines: dedupe by name (case-insensitive) ───────────────────
    if (Array.isArray(localData.medicines) && localData.medicines.length > 0) {
      const serverMeds = await db.select().from(medicines).where(eq(medicines.userId, userId))
      const serverNames = new Set(serverMeds.map((m) => m.name.toLowerCase().trim()))
      let added = 0
      for (const m of localData.medicines) {
        if (!m.name || serverNames.has(m.name.toLowerCase().trim())) continue
        await db.insert(medicines).values({
          id: uuidv4(),
          userId,
          cardId: m.cardId || "medicines-1",
          name: m.name,
          dosage: m.dosage ?? null,
          times: m.times ?? [],
          repeatPattern: m.repeatPattern ?? "daily",
          activeDays: m.activeDays ?? [0, 1, 2, 3, 4, 5, 6],
          active: m.active ?? true,
        })
        serverNames.add(m.name.toLowerCase().trim())
        added++
      }
      summary.medicines = added
    }

    // ── Food items: dedupe by name + date ──────────────────────────────
    if (Array.isArray(localData.food_items) && localData.food_items.length > 0) {
      const serverFood = await db.select().from(foodItems).where(eq(foodItems.userId, userId))
      const serverKeys = new Set(
        serverFood.map((f) => `${f.name.toLowerCase()}|${f.date}|${f.calories}`),
      )
      let added = 0
      for (const f of localData.food_items) {
        const key = `${(f.name ?? "").toLowerCase()}|${f.date}|${f.calories}`
        if (!f.name || serverKeys.has(key)) continue
        await db.insert(foodItems).values({
          id: uuidv4(),
          userId,
          cardId: f.cardId || "calories-1",
          name: f.name,
          calories: f.calories,
          date: f.date,
        })
        serverKeys.add(key)
        added++
      }
      summary.food_items = added
    }

    // ── Water logs: take max per date ──────────────────────────────────
    if (localData.water_logs && typeof localData.water_logs === "object") {
      const serverWater = await db.select().from(waterLogs).where(eq(waterLogs.userId, userId))
      const serverByDate = new Map(serverWater.map((w) => [w.date, w]))
      let updated = 0
      for (const [date, ml] of Object.entries(localData.water_logs as Record<string, number>)) {
        const existing = serverByDate.get(date)
        if (!existing) {
          await db.insert(waterLogs).values({
            id: uuidv4(),
            userId,
            cardId: "calories-1",
            ml: ml as number,
            date,
          })
          updated++
        } else if ((ml as number) > existing.ml) {
          await db.update(waterLogs).set({ ml: ml as number }).where(eq(waterLogs.id, existing.id))
          updated++
        }
      }
      summary.water_logs = updated
    }

    // ── Habits: dedupe by name ─────────────────────────────────────────
    if (Array.isArray(localData.habits?.habits) && localData.habits.habits.length > 0) {
      const serverHabits = await db.select().from(habits).where(eq(habits.userId, userId))
      const serverNames = new Set(serverHabits.map((h) => h.name.toLowerCase().trim()))
      // Build a mapping from local habit ID to server habit ID (for logs)
      const habitIdMap = new Map<string, string>()
      let added = 0
      for (const h of localData.habits.habits) {
        if (!h.name) continue
        const nameKey = h.name.toLowerCase().trim()
        const existing = serverHabits.find((sh) => sh.name.toLowerCase().trim() === nameKey)
        if (existing) {
          habitIdMap.set(h.id, existing.id)
          continue
        }
        const newId = uuidv4()
        await db.insert(habits).values({
          id: newId,
          userId,
          name: h.name,
          color: h.color ?? null,
          icon: h.icon ?? null,
          sortOrder: h.sortOrder ?? serverHabits.length + added,
        })
        habitIdMap.set(h.id, newId)
        serverNames.add(nameKey)
        added++
      }
      summary.habits = added

      // Merge habit logs
      if (Array.isArray(localData.habits?.logs)) {
        const serverLogs = await db.select().from(habitLogs).where(eq(habitLogs.userId, userId))
        const serverLogKeys = new Set(serverLogs.map((l) => `${l.habitId}|${l.date}`))
        let logsAdded = 0
        for (const log of localData.habits.logs) {
          const serverHabitId = habitIdMap.get(log.habitId)
          if (!serverHabitId) continue
          const key = `${serverHabitId}|${log.date}`
          if (serverLogKeys.has(key)) continue
          await db.insert(habitLogs).values({
            id: uuidv4(),
            userId,
            habitId: serverHabitId,
            date: log.date,
            completed: log.completed ?? true,
          })
          serverLogKeys.add(key)
          logsAdded++
        }
        summary.habit_logs = logsAdded
      }
    }

    // ── RSS feeds: dedupe by URL ───────────────────────────────────────
    if (Array.isArray(localData.rss_feeds) && localData.rss_feeds.length > 0) {
      const serverFeeds = await db.select().from(rssFeeds).where(eq(rssFeeds.userId, userId))
      const serverUrls = new Set(serverFeeds.map((f) => f.url))
      let added = 0
      for (const f of localData.rss_feeds) {
        if (!f.url || serverUrls.has(f.url)) continue
        await db.insert(rssFeeds).values({
          id: uuidv4(),
          userId,
          url: f.url,
          title: f.title ?? null,
          siteUrl: f.siteUrl ?? null,
        })
        serverUrls.add(f.url)
        added++
      }
      summary.rss_feeds = added
    }

    // ── Settings: local fills gaps, server wins on conflicts ───────────
    if (localData.settings && typeof localData.settings === "object") {
      const serverSettings = await db.select().from(settings).where(eq(settings.userId, userId))
      const serverKeys = new Set(serverSettings.map((s) => s.key))
      let added = 0
      const settingConflicts: string[] = []
      for (const [key, value] of Object.entries(localData.settings as Record<string, unknown>)) {
        if (serverKeys.has(key)) {
          // Server already has this key -- check if values differ
          const serverVal = serverSettings.find((s) => s.key === key)?.value
          if (JSON.stringify(serverVal) !== JSON.stringify(value)) {
            settingConflicts.push(key)
          }
          continue // Server wins by default
        }
        await db.insert(settings).values({ key, userId, value })
        added++
      }
      summary.settings = added
      if (settingConflicts.length > 0) {
        conflicts.push({
          type: "settings",
          message: `${settingConflicts.length} settings differ between local and cloud. Cloud values were kept.`,
          localItem: settingConflicts,
          serverItem: null,
        })
      }
    }

    return NextResponse.json({ success: true, summary, conflicts })
  } catch (error) {
    console.error("Merge failed:", error)
    return NextResponse.json({ error: "Merge failed" }, { status: 500 })
  }
}
