// ── Grid layout: Apple-widget-style fixed-size system ───────────────────────
//
// The dashboard is a fixed-column grid (default 8 cols) of square cells.
// Each zone picks one of a small set of fixed sizes (S/M/L/XL).
// Positions are computed by a bin-packer — the user never drags into free space.
// Reordering is done by drag-and-drop into another zone's slot; everything
// reflows automatically.

// Fixed pixel size for one grid unit. Cards stay the same physical size
// regardless of screen width — the number of columns that fit adapts instead.
export const CELL_SIZE_PX = 110

// Minimum columns the grid will render at (prevents collapse on tiny windows).
export const MIN_GRID_COLS = 4

// Reference column count used by widget definitions (e.g. BANNER spans this).
// Actual rendered columns = floor(containerWidth / CELL_SIZE_PX), clamped to
// at least MIN_GRID_COLS. Widgets wider than the rendered grid get clamped.
export const GRID_COLS = 16

// Bump this whenever the layout shape changes — older saved layouts get
// migrated back to defaults.
export const GRID_VERSION = 2

export const ZONE_IDS = [
  "timeline",
  "clock",
  "tasks",
  "notes",
  "vitals",
  "media",
  "habits",
  "smarthome",
  "weather",
  "news",
] as const

export type ZoneId = (typeof ZONE_IDS)[number]

// ── Widget sizes ────────────────────────────────────────────────────────────

export type WidgetSize = "S" | "M" | "L" | "XL" | "BANNER" | "TOWER"

export interface WidgetDimensions {
  w: number // width in grid cells
  h: number // height in grid cells
}

export const WIDGET_SIZES: Record<WidgetSize, WidgetDimensions> = {
  S:      { w: 2,  h: 2 }, // small square
  M:      { w: 4,  h: 2 }, // medium / wide
  L:      { w: 4,  h: 4 }, // large square
  XL:     { w: 8,  h: 4 }, // extra-wide
  BANNER: { w: 16, h: 2 }, // full-width banner
  TOWER:  { w: 2,  h: 8 }, // tall tower
}

export const WIDGET_SIZE_ORDER: WidgetSize[] = ["S", "M", "L", "XL", "BANNER", "TOWER"]

export const WIDGET_SIZE_LABELS: Record<WidgetSize, string> = {
  S:      "Small",
  M:      "Medium",
  L:      "Large",
  XL:     "Extra Large",
  BANNER: "Banner",
  TOWER:  "Tower",
}

// Per-zone allowed sizes. Keeps the picker tidy (e.g. timeline only makes
// sense as a wide banner). All zones support at least M and L by default.
// BANNER (16x2) and TOWER (2x8) are reserved for the schedule/timeline zone —
// the only one whose content meaningfully benefits from those extreme aspect
// ratios. Other zones get the standard S/M/L/XL set.
export const ZONE_ALLOWED_SIZES: Record<ZoneId, WidgetSize[]> = {
  timeline:  ["S", "M", "L", "XL", "BANNER", "TOWER"],
  clock:     ["S", "M", "L", "XL"],
  tasks:     ["S", "M", "L", "XL"],
  notes:     ["S", "M", "L", "XL"],
  vitals:    ["M"],
  media:     ["S", "M", "L", "XL"],
  habits:    ["S", "M", "L", "XL"],
  smarthome: ["S", "M", "L", "XL"],
  weather:   ["S", "M", "L", "XL"],
  news:      ["S", "M", "L", "XL"],
}

export interface ZoneEntry {
  id: ZoneId
  size: WidgetSize
}

// Packed position — derived from layout, not stored.
export interface ZonePosition {
  x: number // cell column (0-indexed)
  y: number // cell row (0-indexed)
  w: number // width in cells
  h: number // height in cells
}

// The layout is an *ordered* list of zones. Order determines packing priority.
export interface DashboardLayout {
  version: number
  zones: ZoneEntry[]
}

// ── Defaults ────────────────────────────────────────────────────────────────

export function getDefaultLayout(): DashboardLayout {
  return {
    version: GRID_VERSION,
    zones: [
      { id: "timeline",  size: "XL" },
      { id: "tasks",     size: "L"  },
      { id: "vitals",    size: "M"  },
      { id: "clock",     size: "S"  },
      { id: "notes",     size: "M"  },
      { id: "media",     size: "L"  },
      { id: "weather",   size: "M"  },
      { id: "smarthome", size: "M"  },
      { id: "habits",    size: "M"  },
      { id: "news",      size: "M"  },
    ],
  }
}

export const DEFAULT_DASHBOARD_LAYOUT: DashboardLayout = getDefaultLayout()

// ── Bin packing ─────────────────────────────────────────────────────────────
//
// Greedy top-left packer. For each zone (in order) find the topmost row, then
// leftmost column, where the widget fits without overlap.

export function packLayout(
  layout: DashboardLayout,
  cols: number = GRID_COLS,
  hiddenZones: ZoneId[] = [],
): Record<ZoneId, ZonePosition> {
  const occupied: boolean[][] = []
  const result = {} as Record<ZoneId, ZonePosition>

  const fits = (x: number, y: number, w: number, h: number): boolean => {
    if (x + w > cols) return false
    for (let row = y; row < y + h; row++) {
      for (let col = x; col < x + w; col++) {
        if (occupied[row]?.[col]) return false
      }
    }
    return true
  }

  const mark = (x: number, y: number, w: number, h: number) => {
    for (let row = y; row < y + h; row++) {
      if (!occupied[row]) occupied[row] = new Array(cols).fill(false)
      for (let col = x; col < x + w; col++) {
        occupied[row][col] = true
      }
    }
  }

  for (const entry of layout.zones) {
    if (hiddenZones.includes(entry.id)) continue
    const dims = WIDGET_SIZES[entry.size]
    // Clamp width to available columns so wide widgets (BANNER=16) still
    // render on narrow screens. Height is preserved.
    const w = Math.min(dims.w, cols)
    const h = dims.h
    let placed = false
    let y = 0
    while (!placed) {
      for (let x = 0; x <= cols - w; x++) {
        if (fits(x, y, w, h)) {
          mark(x, y, w, h)
          result[entry.id] = { x, y, w, h }
          placed = true
          break
        }
      }
      if (!placed) y++
      if (y > 500) break // safety
    }
  }

  return result
}

// Total rows used by a packed layout (for sizing the grid container).
export function getPackedRows(positions: Record<string, ZonePosition>): number {
  let max = 0
  for (const id in positions) {
    const p = positions[id]
    if (p.y + p.h > max) max = p.y + p.h
  }
  return max
}

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

export const DASHBOARD_LIMITS = { max: 10 } as const

// ── Validation & migration ──────────────────────────────────────────────────

export function isValidLayout(value: unknown): value is DashboardLayout {
  if (!value || typeof value !== "object") return false
  const obj = value as Record<string, unknown>
  if (obj.version !== GRID_VERSION) return false
  if (!Array.isArray(obj.zones)) return false
  return obj.zones.every((z) => {
    if (!z || typeof z !== "object") return false
    const e = z as Record<string, unknown>
    return (
      typeof e.id === "string" &&
      ZONE_IDS.includes(e.id as ZoneId) &&
      typeof e.size === "string" &&
      e.size in WIDGET_SIZES
    )
  })
}

// Backfills any newly added zones into a layout (e.g. when ZONE_IDS grows),
// and coerces any zone whose stored size is no longer in its allowed set
// (e.g. BANNER/TOWER on non-timeline zones) down to its largest allowed size.
export function ensureAllZones(layout: DashboardLayout): DashboardLayout {
  const present = new Set(layout.zones.map((z) => z.id))
  const missing: ZoneEntry[] = []
  for (const id of ZONE_IDS) {
    if (!present.has(id)) {
      const allowed = ZONE_ALLOWED_SIZES[id]
      const fallback: WidgetSize = allowed.includes("M") ? "M" : allowed[0]
      missing.push({ id, size: fallback })
    }
  }
  const coerced = layout.zones.map((z) => {
    const allowed = ZONE_ALLOWED_SIZES[z.id]
    if (!allowed || allowed.includes(z.size)) return z
    const fallback: WidgetSize = allowed.includes("XL")
      ? "XL"
      : allowed.includes("L")
        ? "L"
        : allowed.includes("M")
          ? "M"
          : allowed[0]
    return { ...z, size: fallback }
  })
  if (missing.length === 0 && coerced.every((z, i) => z === layout.zones[i])) {
    return layout
  }
  return { ...layout, zones: [...coerced, ...missing] }
}

// Anything that isn't the new shape gets reset to defaults. This is a
// destructive migration — old percentage-based layouts cannot be sensibly
// translated to the fixed-size grid, so we start fresh.
export function migrateLayout(stored: unknown): DashboardLayout {
  if (isValidLayout(stored)) return ensureAllZones(stored)
  return getDefaultLayout()
}

// ── Reorder helpers ─────────────────────────────────────────────────────────

export function moveZoneToIndex(
  layout: DashboardLayout,
  zoneId: ZoneId,
  targetIndex: number,
): DashboardLayout {
  const fromIndex = layout.zones.findIndex((z) => z.id === zoneId)
  if (fromIndex === -1 || fromIndex === targetIndex) return layout
  const next = [...layout.zones]
  const [item] = next.splice(fromIndex, 1)
  const insertAt = Math.max(0, Math.min(next.length, targetIndex))
  next.splice(insertAt, 0, item)
  return { ...layout, zones: next }
}

export function setZoneSize(
  layout: DashboardLayout,
  zoneId: ZoneId,
  size: WidgetSize,
): DashboardLayout {
  return {
    ...layout,
    zones: layout.zones.map((z) => (z.id === zoneId ? { ...z, size } : z)),
  }
}
