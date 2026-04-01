// ── Grid layout types and utilities ──────────────────────────────────────────

// Layout uses percentage values (0-100) for x, y, w, h.
// Rendered as percentages of container width/height.
export const GRID_COLS = 100
export const GRID_ROWS = 100

export const ZONE_IDS = [
  "timeline",
  "clock",
  "tasks",
  "notes",
  "vitals",
  "media",
  "habits",
] as const

export type ZoneId = (typeof ZONE_IDS)[number]

export interface ZonePosition {
  x: number // column start (0-indexed, 0-11)
  y: number // row start (0-indexed)
  w: number // width in columns
  h: number // height in rows
}

export type DashboardLayout = Record<ZoneId, ZonePosition>

// ── Minimum sizes per zone ──────────────────────────────────────────────────

// Min sizes as percentage of container (multiples of 5% grid)
export const ZONE_MIN_SIZES: Record<ZoneId, { minW: number; minH: number }> = {
  timeline: { minW: 10, minH: 10 },
  clock:    { minW: 10, minH: 10 },
  tasks:    { minW: 10, minH: 10 },
  notes:    { minW: 10, minH: 10 },
  vitals:   { minW: 10, minH: 10 },
  media:    { minW: 10, minH: 10 },
  habits:   { minW: 15, minH: 10 },
}

// Default layout as percentages (0-100)
// All values are multiples of LCM(2,3,5)=30 or simple fractions to align with any snap grid
export function getDefaultLayout(): DashboardLayout {
  return {
    timeline: { x: 0,  y: 0,  w: 100, h: 15 },
    tasks:    { x: 0,  y: 15, w: 36,  h: 40 },
    clock:    { x: 36, y: 15, w: 18,  h: 20 },
    notes:    { x: 36, y: 35, w: 18,  h: 30 },
    media:    { x: 0,  y: 55, w: 36,  h: 45 },
    vitals:   { x: 54, y: 15, w: 22,  h: 50 },
    habits:   { x: 76, y: 15, w: 24,  h: 50 },
  }
}

// Snap a layout to a given grid step
export function snapLayout(layout: DashboardLayout, snapW: number, snapH: number): DashboardLayout {
  const snap = (v: number, step: number) => Math.round(v / step) * step
  const result = {} as Record<string, ZonePosition>
  for (const id of ZONE_IDS) {
    const pos = layout[id]
    if (pos) {
      result[id] = {
        x: snap(pos.x, snapW),
        y: snap(pos.y, snapH),
        w: snap(pos.w, snapW),
        h: snap(pos.h, snapH),
      }
    }
  }
  return result as DashboardLayout
}

export const DEFAULT_DASHBOARD_LAYOUT: DashboardLayout = getDefaultLayout()

// ── Multi-dashboard types ──────────────────────────────────────────────────

export interface DashboardConfig {
  id: string
  name: string
  layoutLandscape: DashboardLayout
  layoutPortrait: DashboardLayout
  hiddenZones: ZoneId[]
  isDefault: boolean
  sortOrder: number
}

export function createDefaultDashboardConfig(id: string): DashboardConfig {
  return {
    id,
    name: "Main",
    layoutLandscape: getDefaultLayout(),
    layoutPortrait: getDefaultLayout(),
    hiddenZones: [],
    isDefault: true,
    sortOrder: 0,
  }
}

export const DASHBOARD_LIMITS = { free: 1, pro: 10 } as const

// ── RGL conversion ──────────────────────────────────────────────────────────

export interface RGLLayoutItem {
  i: string
  x: number
  y: number
  w: number
  h: number
  minW?: number
  minH?: number
  resizeHandles?: string[]
}

const ALL_HANDLES = ["sw", "nw", "se", "ne"]

export function dashboardLayoutToRGL(
  layout: DashboardLayout,
): RGLLayoutItem[] {
  return ZONE_IDS.map((id) => {
    const pos = layout[id]
    const mins = ZONE_MIN_SIZES[id]
    return {
      i: id,
      x: pos.x,
      y: pos.y,
      w: pos.w,
      h: pos.h,
      minW: mins.minW,
      minH: mins.minH,
      resizeHandles: ALL_HANDLES,
    }
  })
}

export function rglToDashboardLayout(
  rglLayout: RGLLayoutItem[],
): DashboardLayout {
  const result = { ...DEFAULT_DASHBOARD_LAYOUT }
  for (const item of rglLayout) {
    const id = item.i as ZoneId
    if (ZONE_IDS.includes(id)) {
      result[id] = { x: item.x, y: item.y, w: item.w, h: item.h }
    }
  }
  return result
}

// ── Validation ──────────────────────────────────────────────────────────────

export function isValidLayout(value: unknown): value is DashboardLayout {
  if (!value || typeof value !== "object") return false
  const obj = value as Record<string, unknown>
  return ZONE_IDS.every((id) => {
    const pos = obj[id]
    if (!pos || typeof pos !== "object") return false
    const p = pos as Record<string, unknown>
    return (
      typeof p.x === "number" &&
      typeof p.y === "number" &&
      typeof p.w === "number" &&
      typeof p.h === "number"
    )
  })
}

// ── Migration from old GridLayout format ────────────────────────────────────

interface OldGridLayout {
  timelineEnd: number
  sidebarStart: number
  taskEnd: number
  mediaEnd: number
}

function isOldLayout(value: unknown): value is OldGridLayout {
  if (!value || typeof value !== "object") return false
  const obj = value as Record<string, unknown>
  return (
    typeof obj.timelineEnd === "number" &&
    typeof obj.sidebarStart === "number" &&
    typeof obj.taskEnd === "number" &&
    typeof obj.mediaEnd === "number"
  )
}

function isPartialLayout(value: unknown): value is Partial<DashboardLayout> {
  if (!value || typeof value !== "object") return false
  const obj = value as Record<string, unknown>
  // At least one valid zone position exists
  return ZONE_IDS.some((id) => {
    const pos = obj[id]
    if (!pos || typeof pos !== "object") return false
    const p = pos as Record<string, unknown>
    return typeof p.x === "number" && typeof p.y === "number" && typeof p.w === "number" && typeof p.h === "number"
  })
}

export function migrateLayout(stored: unknown): DashboardLayout {
  // Check grid version first -- if outdated, always return fresh defaults
  if (stored && typeof stored === "object") {
    const obj = stored as Record<string, unknown>
    const savedVersion = typeof obj._gridVersion === "number" ? obj._gridVersion : 0
    if (savedVersion < GRID_VERSION) {
      return DEFAULT_DASHBOARD_LAYOUT
    }
  }

  // Handle saved layouts that are missing newly added zones (e.g., "clock")
  if (!isValidLayout(stored) && isPartialLayout(stored)) {
    const merged = { ...DEFAULT_DASHBOARD_LAYOUT }
    for (const id of ZONE_IDS) {
      const pos = (stored as Record<string, unknown>)[id] as Record<string, unknown> | undefined
      if (pos && typeof pos.x === "number" && typeof pos.y === "number" && typeof pos.w === "number" && typeof pos.h === "number") {
        merged[id] = { x: pos.x, y: pos.y, w: pos.w, h: pos.h }
      }
    }
    return merged
  }

  if (isValidLayout(stored)) {
    return stored
  }
  if (isOldLayout(stored)) {
    const { timelineEnd, sidebarStart, taskEnd, mediaEnd } = stored
    const sideW = 12 - sidebarStart + 1
    const mainW = sidebarStart - 1
    return {
      timeline: { x: 0, y: 0, w: 12, h: timelineEnd },
      clock: { x: 0, y: 0, w: 3, h: 3 }, // fallback position for migrated layouts
      tasks: {
        x: 0,
        y: timelineEnd,
        w: mainW,
        h: taskEnd - timelineEnd,
      },
      media: {
        x: 0,
        y: taskEnd,
        w: mainW,
        h: mediaEnd - taskEnd,
      },
      notes: {
        x: 0,
        y: mediaEnd,
        w: mainW,
        h: GRID_ROWS - mediaEnd,
      },
      vitals: {
        x: sidebarStart - 1,
        y: timelineEnd,
        w: sideW,
        h: GRID_ROWS - timelineEnd,
      },
    }
  }
  return DEFAULT_DASHBOARD_LAYOUT
}
