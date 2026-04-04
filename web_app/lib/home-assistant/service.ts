import { getDb } from "@/lib/get-db"
import { settings } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { SETTINGS_KEYS, HA_API, SUPPORTED_DOMAINS } from "./constants"
import type { SupportedDomain } from "./constants"

// ── DB helpers ──────────────────────────────────────────────────────────────

async function getSetting(key: string, userId: string): Promise<unknown> {
  const [row] = await getDb()
    .select()
    .from(settings)
    .where(and(eq(settings.key, key), eq(settings.userId, userId)))
  return row?.value ?? null
}

async function setSetting(key: string, value: unknown, userId: string): Promise<void> {
  const existing = await getDb()
    .select()
    .from(settings)
    .where(and(eq(settings.key, key), eq(settings.userId, userId)))
  if (existing.length > 0) {
    await getDb()
      .update(settings)
      .set({ value })
      .where(and(eq(settings.key, key), eq(settings.userId, userId)))
  } else {
    await getDb().insert(settings).values({ key, userId, value })
  }
}

// ── Config management ───────────────────────────────────────────────────────

export async function getConfig(userId: string = ""): Promise<{
  baseUrl: string | null
  accessToken: string | null
  selectedEntities: string[]
}> {
  const [baseUrl, accessToken, selectedEntities] = await Promise.all([
    getSetting(SETTINGS_KEYS.baseUrl, userId) as Promise<string | null>,
    getSetting(SETTINGS_KEYS.accessToken, userId) as Promise<string | null>,
    getSetting(SETTINGS_KEYS.selectedEntities, userId) as Promise<string[] | null>,
  ])
  return {
    baseUrl: baseUrl ? baseUrl.replace(/\/+$/, "") : null,
    accessToken,
    selectedEntities: selectedEntities ?? [],
  }
}

export async function saveConfig(
  data: { baseUrl?: string; accessToken?: string; selectedEntities?: string[] },
  userId: string = "",
): Promise<void> {
  const ops: Promise<void>[] = []
  if (data.baseUrl !== undefined) ops.push(setSetting(SETTINGS_KEYS.baseUrl, data.baseUrl, userId))
  if (data.accessToken !== undefined) ops.push(setSetting(SETTINGS_KEYS.accessToken, data.accessToken, userId))
  if (data.selectedEntities !== undefined) ops.push(setSetting(SETTINGS_KEYS.selectedEntities, data.selectedEntities, userId))
  await Promise.all(ops)
}

export async function clearConfig(userId: string = ""): Promise<void> {
  await Promise.all([
    setSetting(SETTINGS_KEYS.baseUrl, null, userId),
    setSetting(SETTINGS_KEYS.accessToken, null, userId),
    setSetting(SETTINGS_KEYS.selectedEntities, null, userId),
  ])
}

// ── HA REST API calls ───────────────────────────────────────────────────────

async function haFetch(
  baseUrl: string,
  accessToken: string,
  path: string,
  options?: RequestInit,
): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  })
}

// ── Entity types ────────────────────────────────────────────────────────────

export interface HAEntity {
  entity_id: string
  state: string
  attributes: {
    friendly_name?: string
    brightness?: number        // 0-255 for lights
    color_temp?: number        // mireds
    color_temp_kelvin?: number
    min_color_temp_kelvin?: number
    max_color_temp_kelvin?: number
    min_mireds?: number
    max_mireds?: number
    rgb_color?: [number, number, number]
    hs_color?: [number, number]
    xy_color?: [number, number]
    supported_color_modes?: string[]
    color_mode?: string
    icon?: string
    [key: string]: unknown
  }
  last_changed: string
  last_updated: string
}

/** Test the HA connection -- returns config info or throws */
export async function testConnection(
  baseUrl: string,
  accessToken: string,
): Promise<{ locationName: string; version: string }> {
  const res = await haFetch(baseUrl, accessToken, HA_API.config)
  if (!res.ok) {
    if (res.status === 401) throw new Error("Invalid access token")
    throw new Error(`Connection failed (${res.status})`)
  }
  const data = await res.json() as { location_name: string; version: string }
  return { locationName: data.location_name, version: data.version }
}

/** Fetch all entity states, optionally filtered to supported domains */
export async function getStates(
  baseUrl: string,
  accessToken: string,
  domainsFilter?: SupportedDomain[],
): Promise<HAEntity[]> {
  const res = await haFetch(baseUrl, accessToken, HA_API.states)
  if (!res.ok) throw new Error(`Failed to fetch states (${res.status})`)

  const all = await res.json() as HAEntity[]
  const domains = domainsFilter ?? [...SUPPORTED_DOMAINS]

  return all.filter((e) => {
    const domain = e.entity_id.split(".")[0]
    return domains.includes(domain as SupportedDomain)
  })
}

/** Fetch a single entity state */
export async function getEntityState(
  baseUrl: string,
  accessToken: string,
  entityId: string,
): Promise<HAEntity> {
  const res = await haFetch(baseUrl, accessToken, `${HA_API.states}/${entityId}`)
  if (!res.ok) throw new Error(`Failed to fetch entity ${entityId} (${res.status})`)
  return res.json() as Promise<HAEntity>
}

/** Call a Home Assistant service (e.g., turn on/off a light) */
export async function callService(
  baseUrl: string,
  accessToken: string,
  domain: string,
  service: string,
  data?: Record<string, unknown>,
): Promise<boolean> {
  const res = await haFetch(
    baseUrl,
    accessToken,
    `${HA_API.services}/${domain}/${service}`,
    {
      method: "POST",
      body: JSON.stringify(data ?? {}),
    },
  )
  return res.ok
}

// ── Convenience wrappers ────────────────────────────────────────────────────

export async function toggleEntity(
  baseUrl: string,
  accessToken: string,
  entityId: string,
): Promise<boolean> {
  const domain = entityId.split(".")[0]
  return callService(baseUrl, accessToken, domain, "toggle", {
    entity_id: entityId,
  })
}

export async function turnOn(
  baseUrl: string,
  accessToken: string,
  entityId: string,
  serviceData?: Record<string, unknown>,
): Promise<boolean> {
  const domain = entityId.split(".")[0]
  return callService(baseUrl, accessToken, domain, "turn_on", {
    entity_id: entityId,
    ...serviceData,
  })
}

export async function turnOff(
  baseUrl: string,
  accessToken: string,
  entityId: string,
): Promise<boolean> {
  const domain = entityId.split(".")[0]
  return callService(baseUrl, accessToken, domain, "turn_off", {
    entity_id: entityId,
  })
}

export async function setLightBrightness(
  baseUrl: string,
  accessToken: string,
  entityId: string,
  /** Brightness percentage 0-100 */
  brightness: number,
): Promise<boolean> {
  // HA expects 0-255
  const haBrightness = Math.round((brightness / 100) * 255)
  return turnOn(baseUrl, accessToken, entityId, { brightness: haBrightness })
}

export async function setLightColor(
  baseUrl: string,
  accessToken: string,
  entityId: string,
  rgb: [number, number, number],
): Promise<boolean> {
  return turnOn(baseUrl, accessToken, entityId, { rgb_color: rgb })
}

export async function setLightColorTemp(
  baseUrl: string,
  accessToken: string,
  entityId: string,
  /** Color temperature in Kelvin */
  kelvin: number,
): Promise<boolean> {
  return turnOn(baseUrl, accessToken, entityId, { color_temp_kelvin: kelvin })
}

// ── Server-side orchestrator (used by API route) ────────────────────────────

/** Fetch states for user's selected entities (or all supported if none selected) */
export async function getSelectedStates(userId: string = ""): Promise<{
  entities: HAEntity[]
  connected: boolean
}> {
  const { baseUrl, accessToken, selectedEntities } = await getConfig(userId)
  if (!baseUrl || !accessToken) return { entities: [], connected: false }

  try {
    const all = await getStates(baseUrl, accessToken)
    const entities = selectedEntities.length > 0
      ? all.filter((e) => selectedEntities.includes(e.entity_id))
      : all
    return { entities, connected: true }
  } catch {
    return { entities: [], connected: false }
  }
}
