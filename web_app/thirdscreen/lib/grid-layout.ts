// ── Grid layout types and utilities ──────────────────────────────────────────

export const GRID_COLS = 12
export const GRID_ROWS = 12

export const ZONE_IDS = [
  "timeline",
  "tasks",
  "notes",
  "vitals",
  "media",
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

export const ZONE_MIN_SIZES: Record<ZoneId, { minW: number; minH: number }> = {
  timeline: { minW: 2, minH: 1 },
  tasks: { minW: 2, minH: 2 },
  notes: { minW: 2, minH: 2 },
  vitals: { minW: 2, minH: 2 },
  media: { minW: 2, minH: 2 },
}

// ── Default layout ──────────────────────────────────────────────────────────

export const DEFAULT_DASHBOARD_LAYOUT: DashboardLayout = {
  timeline: { x: 0, y: 0, w: 12, h: 2 },
  tasks: { x: 0, y: 2, w: 5, h: 4 },
  media: { x: 0, y: 6, w: 5, h: 6 },
  notes: { x: 5, y: 6, w: 3, h: 6 },
  vitals: { x: 8, y: 2, w: 4, h: 10 },
}

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

export function migrateLayout(stored: unknown): DashboardLayout {
  if (isValidLayout(stored)) {
    // If layout was saved with a larger grid (24/48), scale down to 12x12
    const maxX = Math.max(...ZONE_IDS.map((id) => stored[id].x + stored[id].w))
    const maxY = Math.max(...ZONE_IDS.map((id) => stored[id].y + stored[id].h))
    if (maxX > GRID_COLS || maxY > GRID_ROWS) {
      const scaleX = GRID_COLS / maxX
      const scaleY = GRID_ROWS / maxY
      const scaled: DashboardLayout = { ...DEFAULT_DASHBOARD_LAYOUT }
      for (const id of ZONE_IDS) {
        scaled[id] = {
          x: Math.round(stored[id].x * scaleX),
          y: Math.round(stored[id].y * scaleY),
          w: Math.max(1, Math.round(stored[id].w * scaleX)),
          h: Math.max(1, Math.round(stored[id].h * scaleY)),
        }
      }
      return scaled
    }
    return stored
  }
  if (isOldLayout(stored)) {
    const { timelineEnd, sidebarStart, taskEnd, mediaEnd } = stored
    const sideW = 12 - sidebarStart + 1
    const mainW = sidebarStart - 1
    return {
      timeline: { x: 0, y: 0, w: 12, h: timelineEnd },
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
