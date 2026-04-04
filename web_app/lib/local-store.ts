/**
 * Local Storage Data Store
 *
 * Complete offline data backend using localStorage.
 * Used for anonymous users on the hosted version (Excalidraw model).
 * All data lives in the browser -- no server calls.
 *
 * Storage keys are prefixed with "ts_" to avoid collisions.
 */

import type {
  TodoItem,
  NoteItem,
  MedicineItem,
  FoodItem,
  ScheduleEvent,
} from "./types"

// ── Helpers ─────────────────────────────────────────────────────────────────

function uid(): string {
  return crypto.randomUUID()
}

function now(): string {
  return new Date().toISOString()
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`ts_${key}`)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write<T>(key: string, value: T): void {
  localStorage.setItem(`ts_${key}`, JSON.stringify(value))
}

// ── Todos ───────────────────────────────────────────────────────────────────

export function localListTodos(cardId?: string): TodoItem[] {
  const all = read<TodoItem[]>("todos", [])
  return cardId ? all.filter((t) => t.cardId === cardId) : all
}

export function localCreateTodo(data: {
  cardId: string
  title: string
  scheduledDate?: string
  scheduledTime?: string
  duration?: number
  sortOrder?: number
}): TodoItem {
  const todos = read<TodoItem[]>("todos", [])
  const item: TodoItem = {
    id: uid(),
    cardId: data.cardId,
    title: data.title,
    completed: false,
    scheduledDate: data.scheduledDate ?? null,
    scheduledTime: data.scheduledTime ?? null,
    duration: data.duration ?? null,
    sortOrder: data.sortOrder ?? todos.length,
    createdAt: now(),
  }
  todos.push(item)
  write("todos", todos)
  return item
}

export function localUpdateTodo(data: {
  id: string
  [key: string]: unknown
}): TodoItem | null {
  const todos = read<TodoItem[]>("todos", [])
  const idx = todos.findIndex((t) => t.id === data.id)
  if (idx === -1) return null
  const { id, ...updates } = data
  todos[idx] = { ...todos[idx], ...updates } as TodoItem
  write("todos", todos)
  return todos[idx]
}

export function localDeleteTodo(id: string): void {
  const todos = read<TodoItem[]>("todos", [])
  write(
    "todos",
    todos.filter((t) => t.id !== id)
  )
}

// ── Notes ───────────────────────────────────────────────────────────────────

export function localListNotes(cardId?: string): NoteItem[] {
  const all = read<NoteItem[]>("notes", [])
  return cardId ? all.filter((n) => n.cardId === cardId) : all
}

export function localCreateNote(data: {
  cardId: string
  content?: string
  pinned?: boolean
  sortOrder?: number
}): NoteItem {
  const notes = read<NoteItem[]>("notes", [])
  const item: NoteItem = {
    id: uid(),
    cardId: data.cardId,
    content: data.content ?? "",
    pinned: data.pinned ?? false,
    sortOrder: data.sortOrder ?? notes.length,
    createdAt: now(),
    updatedAt: now(),
  }
  notes.push(item)
  write("notes", notes)
  return item
}

export function localUpdateNote(data: {
  id: string
  content?: string
  pinned?: boolean
}): NoteItem | null {
  const notes = read<NoteItem[]>("notes", [])
  const idx = notes.findIndex((n) => n.id === data.id)
  if (idx === -1) return null
  if (data.content !== undefined) notes[idx].content = data.content
  if (data.pinned !== undefined) notes[idx].pinned = data.pinned
  notes[idx].updatedAt = now()
  write("notes", notes)
  return notes[idx]
}

export function localDeleteNote(id: string): void {
  write(
    "notes",
    read<NoteItem[]>("notes", []).filter((n) => n.id !== id)
  )
}

// ── Links ───────────────────────────────────────────────────────────────────

interface LinkItem {
  id: string
  cardId: string
  url: string
  title: string
  pinned: boolean
  createdAt: string
}

export function localListLinks(cardId?: string): LinkItem[] {
  const all = read<LinkItem[]>("links", [])
  return cardId ? all.filter((l) => l.cardId === cardId) : all
}

export function localCreateLink(data: {
  cardId: string
  url: string
  title?: string
  pinned?: boolean
}): LinkItem {
  const links = read<LinkItem[]>("links", [])
  const item: LinkItem = {
    id: uid(),
    cardId: data.cardId,
    url: data.url,
    title: data.title ?? data.url,
    pinned: data.pinned ?? false,
    createdAt: now(),
  }
  links.push(item)
  write("links", links)
  return item
}

export function localDeleteLink(id: string): void {
  write(
    "links",
    read<LinkItem[]>("links", []).filter((l) => l.id !== id)
  )
}

// ── Schedule Events ─────────────────────────────────────────────────────────

export function localListScheduleEvents(
  date: string,
  _cardId?: string
): ScheduleEvent[] {
  const all = read<ScheduleEvent[]>("schedule_events", [])
  return all.filter((e) => e.date === date)
}

export function localCreateScheduleEvent(data: {
  cardId: string
  title: string
  startTime: string
  endTime: string
  date: string
  allDay?: boolean
  color?: string
  location?: string
  description?: string
}): ScheduleEvent {
  const events = read<ScheduleEvent[]>("schedule_events", [])
  const item: ScheduleEvent = {
    id: uid(),
    cardId: data.cardId,
    title: data.title,
    startTime: data.startTime,
    endTime: data.endTime,
    allDay: data.allDay ?? false,
    color: data.color ?? "#3b82f6",
    location: data.location ?? null,
    description: data.description ?? null,
    date: data.date,
    createdAt: now(),
  }
  events.push(item)
  write("schedule_events", events)
  return item
}

export function localUpdateScheduleEvent(data: {
  id: string
  [key: string]: unknown
}): ScheduleEvent | null {
  const events = read<ScheduleEvent[]>("schedule_events", [])
  const idx = events.findIndex((e) => e.id === data.id)
  if (idx === -1) return null
  const { id, ...updates } = data
  events[idx] = { ...events[idx], ...updates } as ScheduleEvent
  write("schedule_events", events)
  return events[idx]
}

export function localDeleteScheduleEvent(id: string): void {
  write(
    "schedule_events",
    read<ScheduleEvent[]>("schedule_events", []).filter((e) => e.id !== id)
  )
}

// ── Food Items (Calories) ───────────────────────────────────────────────────

export function localListFoodItems(
  date: string,
  _cardId?: string
): FoodItem[] {
  const all = read<FoodItem[]>("food_items", [])
  return all.filter((f) => f.date === date)
}

export function localCreateFoodItem(data: {
  cardId: string
  name: string
  calories: number
  date: string
}): FoodItem {
  const items = read<FoodItem[]>("food_items", [])
  const item: FoodItem = {
    id: uid(),
    cardId: data.cardId,
    name: data.name,
    calories: data.calories,
    date: data.date,
    createdAt: now(),
  }
  items.push(item)
  write("food_items", items)
  return item
}

export function localDeleteFoodItem(id: string): void {
  write(
    "food_items",
    read<FoodItem[]>("food_items", []).filter((f) => f.id !== id)
  )
}

// ── Water ───────────────────────────────────────────────────────────────────

export function localGetWater(
  date: string,
  _cardId?: string
): { intake: number; goal: number } {
  const logs = read<Record<string, number>>("water_logs", {})
  return { intake: logs[date] ?? 0, goal: 2000 }
}

export function localUpsertWater(data: {
  cardId: string
  date: string
  intake: number
}): { intake: number; goal: number } {
  const logs = read<Record<string, number>>("water_logs", {})
  logs[data.date] = data.intake
  write("water_logs", logs)
  return { intake: data.intake, goal: 2000 }
}

// ── Medicines ───────────────────────────────────────────────────────────────

export function localListMedicines(cardId?: string): MedicineItem[] {
  const all = read<MedicineItem[]>("medicines", [])
  return cardId ? all.filter((m) => m.cardId === cardId) : all
}

export function localCreateMedicine(data: {
  cardId: string
  name: string
  dosage?: string
  times: { hour: number; minute: number; id: string }[]
  repeatPattern?: string
  activeDays?: number[]
}): MedicineItem {
  const meds = read<MedicineItem[]>("medicines", [])
  const item: MedicineItem = {
    id: uid(),
    cardId: data.cardId,
    name: data.name,
    dosage: data.dosage ?? null,
    times: data.times,
    repeatPattern: (data.repeatPattern ?? "daily") as MedicineItem["repeatPattern"],
    activeDays: data.activeDays ?? [0, 1, 2, 3, 4, 5, 6],
    active: true,
    createdAt: now(),
  }
  meds.push(item)
  write("medicines", meds)
  return item
}

export function localUpdateMedicine(data: {
  id: string
  [key: string]: unknown
}): MedicineItem | null {
  const meds = read<MedicineItem[]>("medicines", [])
  const idx = meds.findIndex((m) => m.id === data.id)
  if (idx === -1) return null
  const { id, ...updates } = data
  meds[idx] = { ...meds[idx], ...updates } as MedicineItem
  write("medicines", meds)
  return meds[idx]
}

export function localDeleteMedicine(id: string): void {
  write(
    "medicines",
    read<MedicineItem[]>("medicines", []).filter((m) => m.id !== id)
  )
}

// ── Medicine Doses ──────────────────────────────────────────────────────────

// Stored as { "medicineId-timeId-date": true }
export function localListDoses(
  medicineId: string,
  date: string
): { medicineId: string; timeId: string; taken: boolean }[] {
  const doses = read<Record<string, boolean>>("medicine_doses", {})
  const prefix = `${medicineId}-`
  const suffix = `-${date}`
  const results: { medicineId: string; timeId: string; taken: boolean }[] = []

  for (const key of Object.keys(doses)) {
    if (key.startsWith(prefix) && key.endsWith(suffix) && doses[key]) {
      const timeId = key.slice(prefix.length, key.length - suffix.length)
      results.push({ medicineId, timeId, taken: true })
    }
  }
  return results
}

export function localToggleDose(data: {
  medicineId: string
  timeId: string
  date: string
}): { taken: boolean } {
  const doses = read<Record<string, boolean>>("medicine_doses", {})
  const key = `${data.medicineId}-${data.timeId}-${data.date}`
  const newVal = !doses[key]
  if (newVal) {
    doses[key] = true
  } else {
    delete doses[key]
  }
  write("medicine_doses", doses)
  return { taken: newVal }
}

// ── Settings ────────────────────────────────────────────────────────────────

export function localGetSettings(): Record<string, unknown> {
  return read<Record<string, unknown>>("settings", {})
}

export function localSetSetting(
  key: string,
  value: unknown
): { success: boolean } {
  const s = read<Record<string, unknown>>("settings", {})
  s[key] = value
  write("settings", s)
  return { success: true }
}

// ── Integrations ────────────────────────────────────────────────────────────

interface LocalEnabledIntegration {
  id: string
  integrationId: string
  enabled: boolean
  config: Record<string, unknown> | null
  createdAt: string
}

export function localListIntegrations(): LocalEnabledIntegration[] {
  return read<LocalEnabledIntegration[]>("integrations", [])
}

export function localToggleIntegration(
  integrationId: string,
  enabled: boolean
): { success: boolean } {
  const list = read<LocalEnabledIntegration[]>("integrations", [])
  const idx = list.findIndex((i) => i.integrationId === integrationId)
  if (idx !== -1) {
    list[idx].enabled = enabled
  } else {
    list.push({
      id: uid(),
      integrationId,
      enabled,
      config: null,
      createdAt: now(),
    })
  }
  write("integrations", list)
  return { success: true }
}

// ── Habits ────────────────────────────────────────────────────────────────────

interface LocalHabit {
  id: string
  name: string
  color: string | null
  icon: string | null
  sortOrder: number
  archived: boolean
  createdAt: string
}

interface LocalHabitLog {
  id: string
  habitId: string
  date: string
  completed: boolean
  createdAt: string
}

export function localListHabits(startDate: string, endDate: string) {
  const allHabits = read<LocalHabit[]>("habits", []).filter((h) => !h.archived)
  const allLogs = read<LocalHabitLog[]>("habit_logs", [])
  const logs = allLogs.filter((l) => l.date >= startDate && l.date <= endDate)
  return { habits: allHabits, logs }
}

export function localCreateHabit(data: { name: string; color?: string; icon?: string }) {
  const list = read<LocalHabit[]>("habits", [])
  const habit: LocalHabit = {
    id: uid(),
    name: data.name,
    color: data.color ?? null,
    icon: data.icon ?? null,
    sortOrder: list.length,
    archived: false,
    createdAt: now(),
  }
  list.push(habit)
  write("habits", list)
  return habit
}

export function localDeleteHabit(id: string) {
  const habits = read<LocalHabit[]>("habits", []).filter((h) => h.id !== id)
  write("habits", habits)
  const logs = read<LocalHabitLog[]>("habit_logs", []).filter((l) => l.habitId !== id)
  write("habit_logs", logs)
  return { success: true }
}

export function localToggleHabitLog(habitId: string, date: string) {
  const logs = read<LocalHabitLog[]>("habit_logs", [])
  const idx = logs.findIndex((l) => l.habitId === habitId && l.date === date)
  if (idx >= 0) {
    logs.splice(idx, 1)
    write("habit_logs", logs)
    return { completed: false }
  } else {
    logs.push({ id: uid(), habitId, date, completed: true, createdAt: now() })
    write("habit_logs", logs)
    return { completed: true }
  }
}

// ── Dashboards (multi-dashboard) ────────────────────────────────────────────

import type { DashboardConfig, ZoneId } from "./grid-layout"
import { createDefaultDashboardConfig, getDefaultLayout } from "./grid-layout"

export function localListDashboards(): DashboardConfig[] {
  const dashboards = read<DashboardConfig[]>("dashboards", [])
  if (dashboards.length === 0) {
    // Auto-create "Main" dashboard, migrating existing layout if present
    const id = uid()
    const config = createDefaultDashboardConfig(id)
    // Migrate existing layout settings if they exist
    const settings = read<Record<string, unknown>>("settings", {})
    if (settings.dashboardLayoutLandscape) {
      config.layoutLandscape = settings.dashboardLayoutLandscape as DashboardConfig["layoutLandscape"]
    }
    if (settings.dashboardLayoutPortrait) {
      config.layoutPortrait = settings.dashboardLayoutPortrait as DashboardConfig["layoutPortrait"]
    }
    write("dashboards", [config])
    return [config]
  }
  return dashboards
}

export function localCreateDashboard(name: string): DashboardConfig {
  const dashboards = localListDashboards()
  const config: DashboardConfig = {
    id: uid(),
    name,
    layoutLandscape: getDefaultLayout(),
    layoutPortrait: getDefaultLayout(),
    hiddenZones: [],
    isDefault: false,
    sortOrder: dashboards.length,
  }
  write("dashboards", [...dashboards, config])
  return config
}

export function localUpdateDashboard(
  id: string,
  data: Partial<Pick<DashboardConfig, "name" | "layoutLandscape" | "layoutPortrait" | "hiddenZones" | "sortOrder">>
): DashboardConfig | null {
  const dashboards = localListDashboards()
  const idx = dashboards.findIndex((d) => d.id === id)
  if (idx === -1) return null
  dashboards[idx] = { ...dashboards[idx], ...data }
  write("dashboards", dashboards)
  return dashboards[idx]
}

export function localDeleteDashboard(id: string): void {
  const dashboards = localListDashboards().filter((d) => d.id !== id)
  write("dashboards", dashboards)
}

export function localGetActiveDashboardId(): string | null {
  return read<string | null>("active_dashboard_id", null)
}

export function localSetActiveDashboardId(id: string): void {
  write("active_dashboard_id", id)
}

// ── Notifications ─────────────────────────────────────────────────────────────

interface LocalNotification {
  id: string
  type: string
  title: string
  body: string | null
  read: boolean
  meta: Record<string, unknown> | null
  createdAt: string
}

const MAX_LOCAL_NOTIFICATIONS = 200

export function localListNotifications(opts?: { unreadOnly?: boolean; limit?: number }): LocalNotification[] {
  let items = read<LocalNotification[]>("notifications", [])
  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  if (opts?.unreadOnly) items = items.filter((n) => !n.read)
  if (opts?.limit) items = items.slice(0, opts.limit)
  return items
}

export function localCreateNotification(data: {
  id?: string
  type: string
  title: string
  body?: string
  meta?: Record<string, unknown>
}): LocalNotification {
  const items = read<LocalNotification[]>("notifications", [])
  const item: LocalNotification = {
    id: data.id || uid(),
    type: data.type,
    title: data.title,
    body: data.body || null,
    read: false,
    meta: data.meta || null,
    createdAt: now(),
  }
  items.unshift(item)
  // Cap storage
  if (items.length > MAX_LOCAL_NOTIFICATIONS) {
    items.splice(MAX_LOCAL_NOTIFICATIONS)
  }
  write("notifications", items)
  return item
}

export function localUpdateNotification(data: { id: string; read?: boolean }): LocalNotification | null {
  const items = read<LocalNotification[]>("notifications", [])
  const idx = items.findIndex((n) => n.id === data.id)
  if (idx === -1) return null
  if (data.read !== undefined) items[idx].read = data.read
  write("notifications", items)
  return items[idx]
}

export function localMarkAllRead(): void {
  const items = read<LocalNotification[]>("notifications", [])
  for (const item of items) item.read = true
  write("notifications", items)
}

// ── Custom Mascot Characters ────────────────────────────────────────────────

import type { MascotState } from "./mascot"

export interface LocalCustomCharacter {
  id: string
  name: string
  emoji: string
  palette: Record<string, string | null>
  frames: Record<MascotState, string[][][]>
  createdAt: string
  updatedAt: string
}

export function localListCustomCharacters(): LocalCustomCharacter[] {
  return read<LocalCustomCharacter[]>("custom_characters", [])
}

export function localSaveCustomCharacter(data: {
  id?: string
  name: string
  emoji: string
  palette: Record<string, string | null>
  frames: Record<MascotState, string[][][]>
}): LocalCustomCharacter {
  const list = read<LocalCustomCharacter[]>("custom_characters", [])
  const existing = data.id ? list.findIndex((c) => c.id === data.id) : -1

  if (existing >= 0) {
    list[existing] = {
      ...list[existing],
      name: data.name,
      emoji: data.emoji,
      palette: data.palette,
      frames: data.frames,
      updatedAt: now(),
    }
    write("custom_characters", list)
    return list[existing]
  }

  const character: LocalCustomCharacter = {
    id: data.id ?? `custom_${uid()}`,
    name: data.name,
    emoji: data.emoji,
    palette: data.palette,
    frames: data.frames,
    createdAt: now(),
    updatedAt: now(),
  }
  list.push(character)
  write("custom_characters", list)
  return character
}

export function localDeleteCustomCharacter(id: string) {
  const list = read<LocalCustomCharacter[]>("custom_characters", []).filter(
    (c) => c.id !== id
  )
  write("custom_characters", list)
  return { success: true }
}

// ── Export all local data (for future migration to server) ──────────────────

export function exportAllLocalData(): Record<string, unknown> {
  return {
    todos: read("todos", []),
    notes: read("notes", []),
    links: read("links", []),
    schedule_events: read("schedule_events", []),
    food_items: read("food_items", []),
    water_logs: read("water_logs", {}),
    medicines: read("medicines", []),
    medicine_doses: read("medicine_doses", {}),
    settings: read("settings", {}),
    integrations: read("integrations", []),
    custom_characters: read("custom_characters", []),
  }
}
