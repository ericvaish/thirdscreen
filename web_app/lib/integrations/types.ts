// ── Zone types ──────────────────────────────────────────────────────────────
// Fixed UI areas of the dashboard. Each zone aggregates data from its
// enabled integrations regardless of the data source.

export const ZONE_TYPES = [
  "timeline",
  "vitals",
  "tasks",
  "notes",
  "status",
  "smarthome",
] as const

export type ZoneType = (typeof ZONE_TYPES)[number]

// ── Integration definition ──────────────────────────────────────────────────
// Static metadata that lives in the registry. Describes what an integration
// is, which zone it feeds, and whether it ships built-in.

export interface IntegrationDef {
  id: string
  name: string
  description: string
  icon: string // lucide-react icon name
  zone: ZoneType
  category: string
  builtIn: boolean
  defaultEnabled: boolean
  /** Whether this integration is implemented. False = shows "Coming soon" badge. */
  implemented?: boolean
}

// ── Enabled integration (DB record) ─────────────────────────────────────────

export interface EnabledIntegration {
  id: string
  integrationId: string
  enabled: boolean
  config: Record<string, unknown> | null
  createdAt: string
}
