/**
 * Data Layer Abstraction
 *
 * Unified API for all data operations. Three storage backends:
 *
 * 1. **Local** (default) -- localStorage in the browser. No server needed.
 *    Used for anonymous users on the hosted version (Excalidraw model).
 *
 * 2. **Server** -- Next.js API routes via fetch(). Used for self-hosted
 *    deployments or authenticated users on the hosted version (future).
 *
 * 3. **Electron** -- IPC to main process. Used in the desktop app.
 *
 * Detection order: Electron > Server > Local
 * Server mode is opt-in via NEXT_PUBLIC_STORAGE=server env var.
 */

import * as local from "./local-store"

declare global {
  interface Window {
    electronAPI?: {
      invoke: (channel: string, data?: unknown) => Promise<unknown>
      platform: string
    }
  }
}

export const isElectron =
  typeof window !== "undefined" && !!window.electronAPI

export const isServer =
  typeof window !== "undefined" &&
  process.env.NEXT_PUBLIC_STORAGE === "server"

export const isLocal = !isElectron && !isServer

export const storageMode: "local" | "server" | "electron" = isElectron
  ? "electron"
  : isServer
    ? "server"
    : "local"

// ── Transport helpers ─────────────────────────────────────────────────────

async function ipc<T>(channel: string, data?: unknown): Promise<T> {
  return window.electronAPI!.invoke(channel, data) as Promise<T>
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json() as Promise<T>
}

// ── Todos ─────────────────────────────────────────────────────────────────

export async function listTodos(cardId?: string) {
  if (isLocal) return local.localListTodos(cardId)
  if (isElectron) return ipc("db:todos:list", cardId ? { cardId } : undefined)
  const params = cardId ? `?cardId=${cardId}` : ""
  return api(`/api/todos${params}`)
}

export async function createTodo(data: {
  cardId: string
  title: string
  scheduledDate?: string
  scheduledTime?: string
  duration?: number
  sortOrder?: number
}) {
  if (isLocal) return local.localCreateTodo(data)
  if (isElectron) return ipc("db:todos:create", data)
  return api("/api/todos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
}

export async function updateTodo(data: { id: string; [key: string]: unknown }) {
  if (isLocal) return local.localUpdateTodo(data)
  if (isElectron) return ipc("db:todos:update", data)
  return api("/api/todos", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
}

export async function deleteTodo(id: string) {
  if (isLocal) return local.localDeleteTodo(id)
  if (isElectron) return ipc("db:todos:delete", { id })
  return api(`/api/todos?id=${id}`, { method: "DELETE" })
}

// ── Notes ─────────────────────────────────────────────────────────────────

export async function listNotes(cardId?: string) {
  if (isLocal) return local.localListNotes(cardId)
  if (isElectron) return ipc("db:notes:list", cardId ? { cardId } : undefined)
  const params = cardId ? `?cardId=${cardId}` : ""
  return api(`/api/notes${params}`)
}

export async function createNote(data: {
  cardId: string
  content?: string
  pinned?: boolean
  sortOrder?: number
}) {
  if (isLocal) return local.localCreateNote(data)
  if (isElectron) return ipc("db:notes:create", data)
  return api("/api/notes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
}

export async function updateNote(data: {
  id: string
  content?: string
  pinned?: boolean
}) {
  if (isLocal) return local.localUpdateNote(data)
  if (isElectron) return ipc("db:notes:update", data)
  return api("/api/notes", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
}

export async function deleteNote(id: string) {
  if (isLocal) return local.localDeleteNote(id)
  if (isElectron) return ipc("db:notes:delete", { id })
  return api(`/api/notes?id=${id}`, { method: "DELETE" })
}

// ── Links ─────────────────────────────────────────────────────────────────

export async function listLinks(cardId?: string) {
  if (isLocal) return local.localListLinks(cardId)
  if (isElectron) return ipc("db:links:list", cardId ? { cardId } : undefined)
  const params = cardId ? `?cardId=${cardId}` : ""
  return api(`/api/notes/links${params}`)
}

export async function createLink(data: {
  cardId: string
  url: string
  title?: string
  pinned?: boolean
}) {
  if (isLocal) return local.localCreateLink(data)
  if (isElectron) return ipc("db:links:create", data)
  return api("/api/notes/links", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
}

export async function deleteLink(id: string) {
  if (isLocal) return local.localDeleteLink(id)
  if (isElectron) return ipc("db:links:delete", { id })
  return api(`/api/notes/links?id=${id}`, { method: "DELETE" })
}

// ── Schedule ──────────────────────────────────────────────────────────────

export async function listScheduleEvents(date: string, cardId?: string) {
  if (isLocal) return local.localListScheduleEvents(date, cardId)
  if (isElectron) return ipc("db:schedule:list", { date, cardId })
  const params = new URLSearchParams({ date })
  if (cardId) params.set("cardId", cardId)
  return api(`/api/schedule?${params}`)
}

export async function createScheduleEvent(data: {
  cardId: string
  title: string
  startTime: string
  endTime: string
  date: string
  allDay?: boolean
  color?: string
  location?: string
  description?: string
}) {
  if (isLocal) return local.localCreateScheduleEvent(data)
  if (isElectron) return ipc("db:schedule:create", data)
  return api("/api/schedule", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
}

export async function updateScheduleEvent(data: {
  id: string
  [key: string]: unknown
}) {
  if (isLocal) return local.localUpdateScheduleEvent(data)
  if (isElectron) return ipc("db:schedule:update", data)
  return api("/api/schedule", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
}

export async function deleteScheduleEvent(id: string) {
  if (isLocal) return local.localDeleteScheduleEvent(id)
  if (isElectron) return ipc("db:schedule:delete", { id })
  return api(`/api/schedule?id=${id}`, { method: "DELETE" })
}

// ── Calories (Food Items) ─────────────────────────────────────────────────

export async function listFoodItems(date: string, cardId?: string) {
  if (isLocal) return local.localListFoodItems(date, cardId)
  if (isElectron) return ipc("db:calories:list", { date, cardId })
  const params = new URLSearchParams({ date })
  if (cardId) params.set("cardId", cardId)
  return api(`/api/calories?${params}`)
}

export async function createFoodItem(data: {
  cardId: string
  name: string
  calories: number
  date: string
}) {
  if (isLocal) return local.localCreateFoodItem(data)
  if (isElectron) return ipc("db:calories:create", data)
  return api("/api/calories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
}

export async function deleteFoodItem(id: string) {
  if (isLocal) return local.localDeleteFoodItem(id)
  if (isElectron) return ipc("db:calories:delete", { id })
  return api(`/api/calories?id=${id}`, { method: "DELETE" })
}

// ── Water ─────────────────────────────────────────────────────────────────

export async function getWater(date: string, cardId?: string) {
  if (isLocal) return local.localGetWater(date, cardId)
  if (isElectron) return ipc("db:water:get", { date, cardId })
  const params = new URLSearchParams({ date })
  if (cardId) params.set("cardId", cardId)
  return api(`/api/calories/water?${params}`)
}

export async function upsertWater(data: {
  cardId: string
  date: string
  intake: number
}) {
  if (isLocal) return local.localUpsertWater(data)
  if (isElectron) return ipc("db:water:upsert", data)
  return api("/api/calories/water", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cardId: data.cardId, date: data.date, ml: data.intake }),
  })
}

// ── Medicines ─────────────────────────────────────────────────────────────

export async function listMedicines(cardId?: string) {
  if (isLocal) return local.localListMedicines(cardId)
  if (isElectron)
    return ipc("db:medicines:list", cardId ? { cardId } : undefined)
  const params = cardId ? `?cardId=${cardId}` : ""
  return api(`/api/medicines${params}`)
}

export async function createMedicine(data: {
  cardId: string
  name: string
  dosage?: string
  times: unknown[]
  repeatPattern?: string
  activeDays?: number[]
}) {
  if (isLocal) return local.localCreateMedicine(data as Parameters<typeof local.localCreateMedicine>[0])
  if (isElectron) return ipc("db:medicines:create", data)
  return api("/api/medicines", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
}

export async function updateMedicine(data: {
  id: string
  [key: string]: unknown
}) {
  if (isLocal) return local.localUpdateMedicine(data)
  if (isElectron) return ipc("db:medicines:update", data)
  return api("/api/medicines", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
}

export async function deleteMedicine(id: string) {
  if (isLocal) return local.localDeleteMedicine(id)
  if (isElectron) return ipc("db:medicines:delete", { id })
  return api(`/api/medicines?id=${id}`, { method: "DELETE" })
}

// ── Medicine Doses ────────────────────────────────────────────────────────

export async function listDoses(medicineId: string, date: string) {
  if (isLocal) return local.localListDoses(medicineId, date)
  if (isElectron) return ipc("db:doses:list", { medicineId, date })
  return api(`/api/medicines/doses?medicineId=${medicineId}&date=${date}`)
}

export async function toggleDose(data: {
  medicineId: string
  timeId: string
  date: string
}) {
  if (isLocal) return local.localToggleDose(data)
  if (isElectron) return ipc("db:doses:toggle", data)
  return api("/api/medicines/doses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
}

// ── Settings ──────────────────────────────────────────────────────────────

export async function getSettings() {
  if (isLocal) return local.localGetSettings()
  if (isElectron) return ipc("db:settings:get")
  return api("/api/settings")
}

export async function setSetting(key: string, value: unknown) {
  if (isLocal) return local.localSetSetting(key, value)
  if (isElectron) return ipc("db:settings:set", { key, value })
  return api("/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, value }),
  })
}

// ── Integrations ──────────────────────────────────────────────────────────

export async function listIntegrations() {
  if (isLocal) return local.localListIntegrations()
  if (isElectron) return ipc("db:integrations:list")
  return api("/api/integrations")
}

export async function toggleIntegration(
  integrationId: string,
  enabled: boolean
) {
  if (isLocal) return local.localToggleIntegration(integrationId, enabled)
  if (isElectron)
    return ipc("db:integrations:toggle", { integrationId, enabled })
  return api("/api/integrations", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ integrationId, enabled }),
  })
}

// ── Data export (for migration to server when user signs in) ──────────────

export function exportLocalData() {
  return local.exportAllLocalData()
}
