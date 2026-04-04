import { Check, X, Clock } from "lucide-react"

// ── Constants ────────────────────────────────────────────────────────────────

export const WINDOW_HOURS = 24 // total span: -12h to +12h
export const WINDOW_MINUTES = WINDOW_HOURS * 60

// Muted, desaturated calendar colors inspired by Apple Calendar.
// Low chroma so they look good on dark backgrounds without being garish.
// 10 colors so events rarely repeat in a typical day.
export const EVENT_COLORS = [
  "oklch(0.62 0.08 250)",  // slate blue
  "oklch(0.65 0.09 160)",  // sage green
  "oklch(0.60 0.09 310)",  // soft lavender
  "oklch(0.68 0.08 75)",   // warm sand
  "oklch(0.60 0.10 20)",   // dusty rose
  "oklch(0.64 0.08 200)",  // muted teal
  "oklch(0.62 0.09 280)",  // soft purple
  "oklch(0.66 0.08 110)",  // olive
  "oklch(0.60 0.08 350)",  // mauve
  "oklch(0.65 0.08 55)",   // amber mist
]

export const SUNRISE_MIN = 6 * 60 + 30
export const SUNSET_MIN = 19 * 60

export const NEXT_SUNRISE_MIN = 24 * 60 + SUNRISE_MIN
export const PREV_SUNSET_MIN = SUNSET_MIN - 24 * 60
export const PREV_PREV_SUNSET_MIN = SUNSET_MIN - 2 * 24 * 60
export const PREV_SUNRISE_MIN = SUNRISE_MIN - 24 * 60

export const WEEK_HOURS = [6, 8, 10, 12, 14, 16, 18, 20, 22] // hour markers in week columns

export const RESPONSE_ICONS: Record<string, { icon: typeof Check; color: string }> = {
  accepted: { icon: Check, color: "text-emerald-400" },
  declined: { icon: X, color: "text-red-400" },
  tentative: { icon: Clock, color: "text-amber-400" },
  needsAction: { icon: Clock, color: "text-muted-foreground/50" },
}

// ── Meeting link extraction ─────────────────────────────────────────────────

const MEETING_LINK_PATTERNS = [
  // Microsoft Teams
  /https?:\/\/teams\.microsoft\.com\/l\/meetup-join\/[^\s<>)]+/i,
  /https?:\/\/teams\.microsoft\.com\/meet\/[^\s<>)]+/i,
  // Zoom
  /https?:\/\/[\w.-]*zoom\.us\/j\/[^\s<>)]+/i,
  // Webex
  /https?:\/\/[\w.-]*webex\.com\/[\w.-]*\/j\.php[^\s<>)]+/i,
  /https?:\/\/[\w.-]*webex\.com\/meet\/[^\s<>)]+/i,
]

export function extractMeetingLink(description: string | null): string | null {
  if (!description) return null
  for (const pattern of MEETING_LINK_PATTERNS) {
    const match = description.match(pattern)
    if (match) return match[0]
  }
  return null
}

// ── Types ───────────────────────────────────────────────────────────────────

export type ViewMode = "day" | "week" | "month"

export interface MedDose {
  medName: string
  dosage: string | null
  hour: number
  minute: number
  taken: boolean
}

export interface TimelineEvent {
  id: string
  title: string
  startTime: string
  endTime: string
  allDay: boolean
  color: string | null
  location: string | null
  description: string | null
  source: "local" | "google"
  meetingLink: string | null
  htmlLink: string | null
  organizer: string | null
  attendees: { email: string; name: string | null; status: string }[] | null
  accountEmail: string | null
}

// ── Day-view utility functions ──────────────────────────────────��───────────

// Stable color from event ID (doesn't shift when events are added/removed)
export function eventColor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0
  }
  return EVENT_COLORS[Math.abs(hash) % EVENT_COLORS.length]
}

export function timeToPercent(time: string, startMin: number): number {
  const [h, m] = time.split(":").map(Number)
  const minutes = h * 60 + m
  return ((minutes - startMin) / WINDOW_MINUTES) * 100
}

export function minutesToPercent(minutes: number, startMin: number): number {
  return ((minutes - startMin) / WINDOW_MINUTES) * 100
}

export function percentToMinutes(pct: number, startMin: number): number {
  return (pct / 100) * WINDOW_MINUTES + startMin
}

export function snapTo15(minutes: number): number {
  return Math.round(minutes / 15) * 15
}

export function minutesToTimeStr(minutes: number): string {
  const h = ((Math.floor(minutes / 60) % 24) + 24) % 24
  const m = ((minutes % 60) + 60) % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

export function formatTime12(minutes: number): string {
  const h = ((Math.floor(minutes / 60) % 24) + 24) % 24
  const m = ((minutes % 60) + 60) % 60
  const ampm = h >= 12 ? "PM" : "AM"
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`
}

// ── Overlap lane assignment for events ───────────────────────────────────��──

export interface LaneAssignment {
  lane: number
  totalLanes: number
}

function timeToMinutesRaw(time: string): number {
  const [h, m] = time.split(":").map(Number)
  return h * 60 + m
}

/**
 * Assign each event a lane so overlapping events stack vertically
 * instead of rendering on top of each other.
 */
export function computeEventLanes(
  events: { id: string; startTime: string; endTime: string }[]
): Map<string, LaneAssignment> {
  const result = new Map<string, LaneAssignment>()
  if (events.length === 0) return result

  // Sort by start time, then by duration (longer first)
  const sorted = [...events].sort((a, b) => {
    const aStart = timeToMinutesRaw(a.startTime)
    const bStart = timeToMinutesRaw(b.startTime)
    if (aStart !== bStart) return aStart - bStart
    const aDur = timeToMinutesRaw(a.endTime) - aStart
    const bDur = timeToMinutesRaw(b.endTime) - bStart
    return bDur - aDur // longer events first
  })

  // Assign lanes greedily
  const lanes: number[] = [] // each entry is the end-time (in minutes) of the event occupying that lane

  const assignments: { id: string; lane: number }[] = []

  for (const ev of sorted) {
    const evStart = timeToMinutesRaw(ev.startTime)
    const evEnd = timeToMinutesRaw(ev.endTime)

    // Find the first lane where the event fits (no overlap)
    let assigned = -1
    for (let i = 0; i < lanes.length; i++) {
      if (lanes[i] <= evStart) {
        assigned = i
        lanes[i] = evEnd
        break
      }
    }

    if (assigned === -1) {
      assigned = lanes.length
      lanes.push(evEnd)
    }

    assignments.push({ id: ev.id, lane: assigned })
  }

  // Now determine totalLanes for each overlap group
  // Build overlap groups: events that share time with at least one other in the group
  const groups: number[][] = [] // indices into assignments

  for (let i = 0; i < sorted.length; i++) {
    const evStart = timeToMinutesRaw(sorted[i].startTime)
    const evEnd = timeToMinutesRaw(sorted[i].endTime)

    // Find which group this event belongs to
    let foundGroup = -1
    for (let g = 0; g < groups.length; g++) {
      for (const memberIdx of groups[g]) {
        const mStart = timeToMinutesRaw(sorted[memberIdx].startTime)
        const mEnd = timeToMinutesRaw(sorted[memberIdx].endTime)
        if (evStart < mEnd && evEnd > mStart) {
          foundGroup = g
          break
        }
      }
      if (foundGroup !== -1) break
    }

    if (foundGroup === -1) {
      groups.push([i])
    } else {
      groups[foundGroup].push(i)
    }
  }

  // For each group, find the max lane used
  for (const group of groups) {
    let maxLane = 0
    for (const idx of group) {
      maxLane = Math.max(maxLane, assignments[idx].lane)
    }
    const totalLanes = maxLane + 1
    for (const idx of group) {
      result.set(assignments[idx].id, {
        lane: assignments[idx].lane,
        totalLanes,
      })
    }
  }

  return result
}

// ── Daylight arcs ───────────────────────────────────────────────────────────

interface ArcPaths {
  fill: string
  stroke: string
}

export interface DaylightArcs {
  sun: ArcPaths
  moon: ArcPaths
  indicator: { x: number; y: number; isSun: boolean } | null
}

export function buildDaylightArcs(
  width: number,
  height: number,
  startMin: number,
  nowMin: number,
): DaylightArcs {
  const horizonY = height * 0.5
  const sunPeak = height * 0.08
  const moonTrough = height * 0.92
  const steps = 60

  // Sun arcs: build a helper, then draw today's + previous day's to cover the full window
  function buildSunArc(rise: number, set: number) {
    const rX = (minutesToPercent(rise, startMin) / 100) * width
    const sX = (minutesToPercent(set, startMin) / 100) * width
    const arcW = sX - rX
    const pts: string[] = []
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const x = rX + t * arcW
      const y = horizonY - (horizonY - sunPeak) * Math.sin(Math.PI * t)
      pts.push(`${x},${y}`)
    }
    const fill = `M ${rX},${horizonY} L ${pts.join(" L ")} L ${sX},${horizonY} Z`
    const stroke = `M ${pts.join(" L ")}`
    return { fill, stroke, riseX: rX, arcW }
  }

  const sunToday = buildSunArc(SUNRISE_MIN, SUNSET_MIN)
  const sunPrev = buildSunArc(PREV_SUNRISE_MIN, PREV_SUNSET_MIN)

  // Today's sun arc coords (used for indicator)
  const sunriseX = sunToday.riseX
  const sunArcW = sunToday.arcW

  const sunFill = sunPrev.fill + " " + sunToday.fill
  const sunStroke = sunPrev.stroke + " " + sunToday.stroke

  // Moon arcs: each night is one continuous arc from sunset to next sunrise.
  // We draw two full night arcs to cover the visible window:
  //   Night 1: PREV_SUNSET → SUNRISE (the night before today's daytime)
  //   Night 2: SUNSET → NEXT_SUNRISE (tonight)
  function buildMoonArc(nightStart: number, nightEnd: number) {
    const x0 = (minutesToPercent(nightStart, startMin) / 100) * width
    const x1 = (minutesToPercent(nightEnd, startMin) / 100) * width
    const arcW = x1 - x0
    const pts: string[] = []
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const x = x0 + t * arcW
      const y = horizonY + (moonTrough - horizonY) * Math.sin(Math.PI * t)
      pts.push(`${x},${y}`)
    }
    const fill = `M ${x0},${horizonY} L ${pts.join(" L ")} L ${x1},${horizonY} Z`
    const stroke = `M ${pts.join(" L ")}`
    return { fill, stroke, x0, arcW }
  }

  // Draw 3 night arcs to cover any 24h window position:
  //   Night 0: PREV_PREV_SUNSET → PREV_SUNRISE (two days ago evening → yesterday morning)
  //   Night 1: PREV_SUNSET → SUNRISE (yesterday evening → this morning)
  //   Night 2: SUNSET → NEXT_SUNRISE (this evening → tomorrow morning)
  const night0 = buildMoonArc(PREV_PREV_SUNSET_MIN, PREV_SUNRISE_MIN)
  const night1 = buildMoonArc(PREV_SUNSET_MIN, SUNRISE_MIN)
  const night2 = buildMoonArc(SUNSET_MIN, NEXT_SUNRISE_MIN)

  const combinedMoonFill = night0.fill + " " + night1.fill + " " + night2.fill
  const combinedMoonStroke = night0.stroke + " " + night1.stroke + " " + night2.stroke

  // Current position indicator
  let indicator: DaylightArcs["indicator"] = null
  const isSun = nowMin >= SUNRISE_MIN && nowMin < SUNSET_MIN

  if (isSun) {
    const t = (nowMin - SUNRISE_MIN) / (SUNSET_MIN - SUNRISE_MIN)
    const x = sunriseX + t * sunArcW
    const y = horizonY - (horizonY - sunPeak) * Math.sin(Math.PI * t)
    indicator = { x, y, isSun: true }
  } else {
    // Determine which night arc the current time falls in
    let nightStart: number, nightEnd: number, arc: typeof night1
    if (nowMin >= SUNSET_MIN) {
      nightStart = SUNSET_MIN
      nightEnd = NEXT_SUNRISE_MIN
      arc = night2
    } else {
      nightStart = PREV_SUNSET_MIN
      nightEnd = SUNRISE_MIN
      arc = night1
    }
    const t = (nowMin - nightStart) / (nightEnd - nightStart)
    const x = arc.x0 + t * arc.arcW
    const y = horizonY + (moonTrough - horizonY) * Math.sin(Math.PI * t)
    indicator = { x, y, isSun: false }
  }

  return {
    sun: { fill: sunFill, stroke: sunStroke },
    moon: { fill: combinedMoonFill, stroke: combinedMoonStroke },
    indicator,
  }
}
