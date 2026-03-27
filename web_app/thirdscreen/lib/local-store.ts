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
  }
}
