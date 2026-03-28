"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  format,
  addDays,
  addWeeks,
  addMonths,
  subDays,
  subWeeks,
  subMonths,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  isSameDay,
  isSameMonth,
  isToday,
  eachDayOfInterval,
} from "date-fns"
import {
  Plus,
  MapPin,
  Pill,
  Sun,
  Moon,
  CalendarCog,
  CalendarDays,
  Trash2,
  Mail,
  ChevronLeft,
  ChevronRight,
  LogIn,
  Clock,
  FileText,
  Video,
  ExternalLink,
  Users,
  Pencil,
  Check,
  X,
  User,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { useAuth, SignInButton } from "@clerk/nextjs"
import type { ScheduleEvent, MedicineItem } from "@/lib/types"
import {
  listScheduleEvents,
  createScheduleEvent,
  updateScheduleEvent,
  deleteScheduleEvent,
  listMedicines,
  listDoses,
  isLocal,
} from "@/lib/data-layer"
import { useNotifications } from "@/lib/notifications"
import { useMascot } from "@/lib/mascot"
import { useDashboard } from "@/components/dashboard/DashboardContext"
import { ZoneDragHandle } from "@/components/dashboard/ZoneDragHandle"
import { generatePKCE } from "@/lib/spotify/pkce"
import { GOOGLE_AUTH_URL, GOOGLE_SCOPES } from "@/lib/google-calendar/constants"

// ── Constants ────────────────────────────────────────────────────────────────

const WINDOW_HOURS = 24 // total span: -12h to +12h
const WINDOW_MINUTES = WINDOW_HOURS * 60
// Muted, desaturated calendar colors inspired by Apple Calendar.
// Low chroma so they look good on dark backgrounds without being garish.
// 10 colors so events rarely repeat in a typical day.
const EVENT_COLORS = [
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

// Stable color from event ID (doesn't shift when events are added/removed)
function eventColor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0
  }
  return EVENT_COLORS[Math.abs(hash) % EVENT_COLORS.length]
}

const SUNRISE_MIN = 6 * 60 + 30
const SUNSET_MIN = 19 * 60

type ViewMode = "day" | "week" | "month"

// ── Day-view utility functions ───────────────────────────────────────────────

function timeToPercent(time: string, startMin: number): number {
  const [h, m] = time.split(":").map(Number)
  const minutes = h * 60 + m
  return ((minutes - startMin) / WINDOW_MINUTES) * 100
}

function minutesToPercent(minutes: number, startMin: number): number {
  return ((minutes - startMin) / WINDOW_MINUTES) * 100
}

function percentToMinutes(pct: number, startMin: number): number {
  return (pct / 100) * WINDOW_MINUTES + startMin
}

function snapTo15(minutes: number): number {
  return Math.round(minutes / 15) * 15
}

function minutesToTimeStr(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

function formatTime12(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const ampm = h >= 12 ? "PM" : "AM"
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`
}

// ── Overlap lane assignment for events ────────────────────────────────────────

interface LaneAssignment {
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
function computeEventLanes(
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

// ── Daylight arcs ────────────────────────────────────────────────────────────

const NEXT_SUNRISE_MIN = 24 * 60 + SUNRISE_MIN
const PREV_SUNSET_MIN = SUNSET_MIN - 24 * 60

interface ArcPaths {
  fill: string
  stroke: string
}

interface DaylightArcs {
  sun: ArcPaths
  moon: ArcPaths
  indicator: { x: number; y: number; isSun: boolean } | null
}

function buildDaylightArcs(
  width: number,
  height: number,
  startMin: number,
  nowMin: number,
): DaylightArcs {
  const horizonY = height * 0.5
  const sunPeak = height * 0.08
  const moonTrough = height * 0.92
  const steps = 60

  // Sun arc (sunrise → sunset, curves above horizon)
  const sunriseX = (minutesToPercent(SUNRISE_MIN, startMin) / 100) * width
  const sunsetX = (minutesToPercent(SUNSET_MIN, startMin) / 100) * width
  const sunArcW = sunsetX - sunriseX

  const sunPoints: string[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const x = sunriseX + t * sunArcW
    const y = horizonY - (horizonY - sunPeak) * Math.sin(Math.PI * t)
    sunPoints.push(`${x},${y}`)
  }

  const sunFill = `M ${sunriseX},${horizonY} L ${sunPoints.join(" L ")} L ${sunsetX},${horizonY} Z`
  const sunStroke = `M ${sunPoints.join(" L ")}`

  // Moon arc (sunset → next sunrise, curves below horizon)
  const moonStartX = (minutesToPercent(SUNSET_MIN, startMin) / 100) * width
  const moonEndX =
    (minutesToPercent(NEXT_SUNRISE_MIN, startMin) / 100) * width
  const moonArcW = moonEndX - moonStartX

  const moonPoints: string[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const x = moonStartX + t * moonArcW
    const y = horizonY + (moonTrough - horizonY) * Math.sin(Math.PI * t)
    moonPoints.push(`${x},${y}`)
  }

  const moonFill = `M ${moonStartX},${horizonY} L ${moonPoints.join(" L ")} L ${moonEndX},${horizonY} Z`
  const moonStroke = `M ${moonPoints.join(" L ")}`

  // Pre-sunrise moon arc
  const prevMoonStartX =
    (minutesToPercent(PREV_SUNSET_MIN, startMin) / 100) * width
  const prevMoonEndX =
    (minutesToPercent(SUNRISE_MIN, startMin) / 100) * width
  const prevMoonArcW = prevMoonEndX - prevMoonStartX

  const prevMoonPoints: string[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const x = prevMoonStartX + t * prevMoonArcW
    const y = horizonY + (moonTrough - horizonY) * Math.sin(Math.PI * t)
    prevMoonPoints.push(`${x},${y}`)
  }

  const prevMoonFill = `M ${prevMoonStartX},${horizonY} L ${prevMoonPoints.join(" L ")} L ${prevMoonEndX},${horizonY} Z`
  const prevMoonStroke = `M ${prevMoonPoints.join(" L ")}`

  const combinedMoonFill = moonFill + " " + prevMoonFill
  const combinedMoonStroke = moonStroke + " " + prevMoonStroke

  // Current position indicator
  let indicator: DaylightArcs["indicator"] = null
  const isSun = nowMin >= SUNRISE_MIN && nowMin < SUNSET_MIN

  if (isSun) {
    const t = (nowMin - SUNRISE_MIN) / (SUNSET_MIN - SUNRISE_MIN)
    const x = sunriseX + t * sunArcW
    const y = horizonY - (horizonY - sunPeak) * Math.sin(Math.PI * t)
    indicator = { x, y, isSun: true }
  } else {
    if (nowMin >= SUNSET_MIN) {
      const t = (nowMin - SUNSET_MIN) / (NEXT_SUNRISE_MIN - SUNSET_MIN)
      const x = moonStartX + t * moonArcW
      const y = horizonY + (moonTrough - horizonY) * Math.sin(Math.PI * t)
      indicator = { x, y, isSun: false }
    } else {
      const span = SUNRISE_MIN - PREV_SUNSET_MIN
      const tPrev = (nowMin - PREV_SUNSET_MIN) / span
      const clampedT = Math.max(0, Math.min(1, tPrev))
      const x = prevMoonStartX + clampedT * prevMoonArcW
      const y =
        horizonY + (moonTrough - horizonY) * Math.sin(Math.PI * clampedT)
      indicator = { x, y, isSun: false }
    }
  }

  return {
    sun: { fill: sunFill, stroke: sunStroke },
    moon: { fill: combinedMoonFill, stroke: combinedMoonStroke },
    indicator,
  }
}

// ── Shared types ─────────────────────────────────────────────────────────────

interface MedDose {
  medName: string
  dosage: string | null
  hour: number
  minute: number
  taken: boolean
}

interface TimelineEvent {
  id: string
  title: string
  startTime: string
  endTime: string
  allDay: boolean
  color: string | null
  location: string | null
  description: string | null
  source: "local" | "google"
  // Extended fields from Google Calendar
  meetingLink: string | null
  htmlLink: string | null
  organizer: string | null
  attendees: { email: string; name: string | null; status: string }[] | null
  accountEmail: string | null
}

// ── Week view helper ─────────────────────────────────────────────────────────

const WEEK_HOURS = [6, 8, 10, 12, 14, 16, 18, 20, 22] // hour markers in week columns

function WeekView({
  selectedDate,
  dateEvents,
  onSelectDay,
}: {
  selectedDate: Date
  dateEvents: Map<string, TimelineEvent[]>
  onSelectDay: (date: Date) => void
}) {
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 })
  const days = eachDayOfInterval({
    start: weekStart,
    end: addDays(weekStart, 6),
  })

  const now = new Date()
  const nowHour = now.getHours() + now.getMinutes() / 60

  return (
    <div className="flex min-h-0 flex-1 gap-px px-2 pb-1">
      {days.map((day) => {
        const key = format(day, "yyyy-MM-dd")
        const events = dateEvents.get(key) ?? []
        const timedEvents = events.filter((e) => !e.allDay)
        const allDayEvents = events.filter((e) => e.allDay)
        const isDayToday = isToday(day)
        const isSelected = isSameDay(day, selectedDate)

        return (
          <button
            key={key}
            onClick={() => onSelectDay(day)}
            className={`group relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-md border transition-colors ${
              isSelected
                ? "border-[var(--zone-timeline-accent)]/40 bg-[var(--zone-timeline-accent)]/5"
                : "border-border/10 hover:border-border/25 hover:bg-muted/20"
            }`}
          >
            {/* Day header */}
            <div className="shrink-0 px-1 pt-1 pb-0.5 text-center">
              <div className="font-mono text-xs uppercase text-muted-foreground/50">
                {format(day, "EEE")}
              </div>
              <div
                className={`mx-auto flex size-5 items-center justify-center rounded-full font-mono text-xs font-medium ${
                  isDayToday
                    ? "bg-amber-400 text-black"
                    : "text-foreground/70"
                }`}
              >
                {format(day, "d")}
              </div>
            </div>

            {/* All-day event dots */}
            {allDayEvents.length > 0 && (
              <div className="flex justify-center gap-0.5 px-0.5 pb-0.5">
                {allDayEvents.slice(0, 3).map((ev, i) => (
                  <div
                    key={ev.id}
                    className="size-1 rounded-full"
                    style={{
                      backgroundColor:
                        ev.color ?? eventColor(ev.id),
                    }}
                  />
                ))}
              </div>
            )}

            {/* Mini timeline column */}
            <div className="relative min-h-0 flex-1">
              {/* Hour grid lines */}
              {WEEK_HOURS.map((h) => {
                const pct = ((h - 5) / 19) * 100
                return (
                  <div
                    key={h}
                    className="absolute left-0 w-full"
                    style={{ top: `${pct}%` }}
                  >
                    <div className="h-px w-full bg-border/10" />
                  </div>
                )
              })}

              {/* Now line */}
              {isDayToday && nowHour >= 5 && nowHour <= 24 && (
                <div
                  className="absolute left-0 z-10 w-full"
                  style={{ top: `${((nowHour - 5) / 19) * 100}%` }}
                >
                  <div className="h-px w-full bg-amber-400/70 shadow-[0_0_4px_oklch(0.8_0.16_85)]" />
                </div>
              )}

              {/* Event bars */}
              {timedEvents.map((ev, idx) => {
                const [sh, sm] = ev.startTime.split(":").map(Number)
                const [eh, em] = ev.endTime.split(":").map(Number)
                const startH = sh + sm / 60
                const endH = eh + em / 60
                const topPct = Math.max(0, ((startH - 5) / 19) * 100)
                const bottomPct = Math.min(100, ((endH - 5) / 19) * 100)
                const heightPct = Math.max(bottomPct - topPct, 2)

                return (
                  <div
                    key={ev.id}
                    className="absolute left-0.5 right-0.5 overflow-hidden rounded-sm"
                    style={{
                      top: `${topPct}%`,
                      height: `${heightPct}%`,
                      backgroundColor:
                        ev.color ?? eventColor(ev.id),
                    }}
                  >
                    <span className="block truncate px-0.5 text-xs font-medium leading-tight text-white/90">
                      {ev.title}
                    </span>
                  </div>
                )
              })}
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ── Month view helper ────────────────────────────────────────────────────────

function MonthView({
  selectedDate,
  dateEvents,
  onSelectDay,
}: {
  selectedDate: Date
  dateEvents: Map<string, TimelineEvent[]>
  onSelectDay: (date: Date) => void
}) {
  const monthStart = startOfMonth(selectedDate)
  const monthEnd = endOfMonth(selectedDate)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })

  return (
    <div className="flex min-h-0 flex-1 flex-col px-2 pb-1">
      {/* Weekday headers */}
      <div className="grid shrink-0 grid-cols-7 gap-px pb-0.5">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div
            key={d}
            className="text-center font-mono text-xs uppercase text-muted-foreground/40"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day cells grid */}
      <div className="grid min-h-0 flex-1 grid-cols-7 gap-px">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd")
          const events = dateEvents.get(key) ?? []
          const inMonth = isSameMonth(day, selectedDate)
          const isDayToday = isToday(day)
          const isSelected = isSameDay(day, selectedDate)

          return (
            <button
              key={key}
              onClick={() => onSelectDay(day)}
              className={`group relative flex flex-col items-center overflow-hidden rounded-md border p-0.5 transition-colors ${
                !inMonth
                  ? "border-transparent opacity-30"
                  : isSelected
                    ? "border-[var(--zone-timeline-accent)]/40 bg-[var(--zone-timeline-accent)]/5"
                    : "border-transparent hover:border-border/25 hover:bg-muted/20"
              }`}
            >
              <span
                className={`flex size-4 shrink-0 items-center justify-center rounded-full font-mono text-xs font-medium ${
                  isDayToday
                    ? "bg-amber-400 text-black"
                    : "text-foreground/60"
                }`}
              >
                {format(day, "d")}
              </span>

              {/* Event indicators */}
              {events.length > 0 && (
                <div className="mt-0.5 flex flex-wrap justify-center gap-[2px]">
                  {events.slice(0, 4).map((ev, i) => (
                    <div
                      key={ev.id}
                      className="size-[3px] rounded-full"
                      style={{
                        backgroundColor:
                          ev.color ?? eventColor(ev.id),
                      }}
                    />
                  ))}
                  {events.length > 4 && (
                    <span className="text-xs leading-none text-muted-foreground/50">
                      +{events.length - 4}
                    </span>
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Event detail dialog ──────────────────────────────────────────────────────

const RESPONSE_ICONS: Record<string, { icon: typeof Check; color: string }> = {
  accepted: { icon: Check, color: "text-emerald-400" },
  declined: { icon: X, color: "text-red-400" },
  tentative: { icon: Clock, color: "text-amber-400" },
  needsAction: { icon: Clock, color: "text-muted-foreground/50" },
}

function EventDetailDialog({
  event,
  open,
  onOpenChange,
  onDelete,
  onUpdate,
}: {
  event: TimelineEvent
  open: boolean
  onOpenChange: (open: boolean) => void
  onDelete: (id: string) => void
  onUpdate: (id: string, data: { title?: string; startTime?: string; endTime?: string }) => void
}) {
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(event.title)
  const [editStart, setEditStart] = useState(event.startTime)
  const [editEnd, setEditEnd] = useState(event.endTime)

  const isEditable = event.source === "local"

  const startMin = parseInt(event.startTime.split(":")[0]) * 60 + parseInt(event.startTime.split(":")[1])
  const endMin = parseInt(event.endTime.split(":")[0]) * 60 + parseInt(event.endTime.split(":")[1])
  const durationMin = endMin - startMin

  const handleSave = () => {
    onUpdate(event.id, { title: editTitle, startTime: editStart, endTime: editEnd })
    setEditing(false)
  }

  const handleDelete = () => {
    onDelete(event.id)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        {/* Color header bar */}
        <div
          className="h-2 w-full"
          style={{ backgroundColor: event.color ?? "var(--zone-timeline-accent)" }}
        />

        <div className="space-y-4 px-5 pb-5 pt-3">
          {/* Title */}
          {editing ? (
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="text-lg font-bold"
              autoFocus
            />
          ) : (
            <DialogHeader className="p-0">
              <DialogTitle className="text-lg font-bold leading-snug">
                {event.title}
              </DialogTitle>
            </DialogHeader>
          )}

          {/* Time */}
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted/30">
              <Clock className="size-4 text-muted-foreground/60" />
            </div>
            {editing ? (
              <div className="flex items-center gap-2">
                <Input type="time" value={editStart} onChange={(e) => setEditStart(e.target.value)} className="w-28" />
                <span className="text-muted-foreground">to</span>
                <Input type="time" value={editEnd} onChange={(e) => setEditEnd(e.target.value)} className="w-28" />
              </div>
            ) : (
              <div>
                <p className="text-sm font-medium">
                  {event.allDay
                    ? "All day"
                    : `${formatTime12(startMin)} - ${formatTime12(endMin)}`}
                </p>
                {!event.allDay && durationMin > 0 && (
                  <p className="text-xs text-muted-foreground/50">
                    {durationMin >= 60
                      ? `${Math.floor(durationMin / 60)}h${durationMin % 60 > 0 ? ` ${durationMin % 60}m` : ""}`
                      : `${durationMin}m`}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Meeting link */}
          {event.meetingLink && (
            <a
              href={event.meetingLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-2.5 text-sm font-medium text-blue-400 transition-colors hover:bg-blue-500/20"
            >
              <Video className="size-4 shrink-0" />
              <span className="flex-1 truncate">Join meeting</span>
              <ExternalLink className="size-3 shrink-0 opacity-50" />
            </a>
          )}

          {/* Location */}
          {event.location && (
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted/30">
                <MapPin className="size-4 text-muted-foreground/60" />
              </div>
              <p className="text-sm">{event.location}</p>
            </div>
          )}

          {/* Description */}
          {event.description && (
            <div className="flex gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted/30">
                <FileText className="size-4 text-muted-foreground/60" />
              </div>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground/80 leading-relaxed">
                {event.description}
              </p>
            </div>
          )}

          {/* Organizer */}
          {event.organizer && (
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted/30">
                <User className="size-4 text-muted-foreground/60" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground/50">Organizer</p>
                <p className="text-sm">{event.organizer}</p>
              </div>
            </div>
          )}

          {/* Attendees */}
          {event.attendees && event.attendees.length > 0 && (
            <div className="flex gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted/30">
                <Users className="size-4 text-muted-foreground/60" />
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-xs text-muted-foreground/50">
                  {event.attendees.length} attendee{event.attendees.length !== 1 ? "s" : ""}
                </p>
                <div className="space-y-0.5">
                  {event.attendees.map((a) => {
                    const resp = RESPONSE_ICONS[a.status] ?? RESPONSE_ICONS.needsAction
                    const StatusIcon = resp.icon
                    return (
                      <div key={a.email} className="flex items-center gap-2 py-0.5">
                        <StatusIcon className={`size-3 shrink-0 ${resp.color}`} />
                        <span className="truncate text-sm">
                          {a.name ?? a.email}
                        </span>
                        {a.name && (
                          <span className="truncate text-xs text-muted-foreground/40">
                            {a.email}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Source badge + Google Calendar link */}
          <div className="flex items-center gap-2 pt-1">
            <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-xs uppercase tracking-wider text-muted-foreground">
              {event.source}
            </span>
            {event.accountEmail && (
              <span className="text-xs text-muted-foreground/40">
                {event.accountEmail}
              </span>
            )}
            {event.htmlLink && (
              <a
                href={event.htmlLink}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto text-xs text-muted-foreground/40 hover:text-foreground/60"
              >
                <ExternalLink className="size-3" />
              </a>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 border-t border-border/20 pt-3">
            {isEditable && !editing && (
              <>
                <Button
                  variant="outline"
                  className="flex-1 gap-1.5"
                  onClick={() => {
                    setEditTitle(event.title)
                    setEditStart(event.startTime)
                    setEditEnd(event.endTime)
                    setEditing(true)
                  }}
                >
                  <Pencil className="size-3.5" />
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1 gap-1.5"
                  onClick={handleDelete}
                >
                  <Trash2 className="size-3.5" />
                  Delete
                </Button>
              </>
            )}
            {isEditable && editing && (
              <>
                <Button className="flex-1 gap-1.5" onClick={handleSave}>
                  <Check className="size-3.5" />
                  Save
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </>
            )}
            {!isEditable && (
              <p className="text-xs text-muted-foreground/40">
                This event is from Google Calendar and can only be edited there.
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export function TimelineZone() {
  const { editMode } = useDashboard()
  const { isSignedIn } = useAuth()
  const { trigger: mascotTrigger } = useMascot()

  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [dateEvents, setDateEvents] = useState<Map<string, TimelineEvent[]>>(
    new Map(),
  )
  const [medDoses, setMedDoses] = useState<MedDose[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null)
  const [calendarOpen, setCalendarOpen] = useState(false)

  // Orientation detection: vertical when taller than wide
  const zoneRef = useRef<HTMLDivElement>(null)
  const [isVertical, setIsVertical] = useState(false)

  useEffect(() => {
    const el = zoneRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setIsVertical(height > width)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const [showSunArc, setShowSunArc] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [nowMinutes, setNowMinutes] = useState(720)

  // View mode and date navigation
  const [viewMode, setViewMode] = useState<ViewMode>("day")
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())

  // The date string for the selected day (used for day view fetching)
  const selectedDateStr = useMemo(
    () => format(selectedDate, "yyyy-MM-dd"),
    [selectedDate],
  )

  // Animated window position
  // Today: center on current time. Other days: show full 0:00-24:00.
  const isViewingToday = isToday(selectedDate)
  const targetWindowStart = isViewingToday
    ? nowMinutes - WINDOW_MINUTES / 2
    : 0

  const [windowStart, setWindowStart] = useState(targetWindowStart)
  const windowEnd = windowStart + WINDOW_MINUTES
  const animRef = useRef<number | null>(null)

  // Smoothly animate windowStart toward targetWindowStart
  useEffect(() => {
    if (animRef.current) cancelAnimationFrame(animRef.current)

    const animate = () => {
      setWindowStart((prev) => {
        const diff = targetWindowStart - prev
        if (Math.abs(diff) < 0.5) return targetWindowStart
        const next = prev + diff * 0.15 // ease factor
        animRef.current = requestAnimationFrame(animate)
        return next
      })
    }

    animRef.current = requestAnimationFrame(animate)
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [targetWindowStart])

  useEffect(() => {
    setMounted(true)
    const n = new Date()
    setNowMinutes(n.getHours() * 60 + n.getMinutes())
    const stored = localStorage.getItem("timeline-sun-arc")
    if (stored === "false") setShowSunArc(false)
    const storedView = localStorage.getItem(
      "timeline-view-mode",
    ) as ViewMode | null
    if (storedView && ["day", "week", "month"].includes(storedView))
      setViewMode(storedView)

    const interval = setInterval(() => {
      const now = new Date()
      setNowMinutes(now.getHours() * 60 + now.getMinutes())
    }, 30_000)
    return () => clearInterval(interval)
  }, [])

  // Hover + drag state (day view only)
  const timelineRef = useRef<HTMLDivElement>(null)
  const [hoverMinutes, setHoverMinutes] = useState<number | null>(null)
  const [dragStart, setDragStart] = useState<number | null>(null)
  const [dragEnd, setDragEnd] = useState<number | null>(null)
  const isDragging = useRef(false)

  const [prefillStart, setPrefillStart] = useState("")
  const [prefillEnd, setPrefillEnd] = useState("")

  // Calendar accounts state
  const [calendarAccounts, setCalendarAccounts] = useState<
    { id: string; email: string; color: string | null }[]
  >([])
  const [googleClientId, setGoogleClientId] = useState<string | null>(null)

  const fetchCalendarAccounts = useCallback(async () => {
    if (isLocal && !isSignedIn) return
    try {
      const [cidRes, accRes] = await Promise.all([
        fetch("/api/google-calendar?action=client-id"),
        fetch("/api/google-calendar?action=accounts"),
      ])
      if (cidRes.ok) {
        const data = await cidRes.json()
        setGoogleClientId(data.clientId)
      }
      if (accRes.ok) {
        setCalendarAccounts(await accRes.json())
      }
    } catch {}
  }, [isSignedIn])

  const toggleSunArc = () => {
    setShowSunArc((prev) => {
      const next = !prev
      localStorage.setItem("timeline-sun-arc", String(next))
      return next
    })
  }

  // ── Data fetching ────────────────────────────────────────────────────────

  // Fetch events for a single date (returns array)
  const fetchEventsForDate = useCallback(
    async (dateStr: string): Promise<TimelineEvent[]> => {
      const merged: TimelineEvent[] = []

      const localEvents = (await listScheduleEvents(
        dateStr,
      )) as ScheduleEvent[]
      for (const ev of localEvents) {
        merged.push({
          id: ev.id,
          title: ev.title,
          startTime: ev.startTime,
          endTime: ev.endTime,
          allDay: ev.allDay,
          color: ev.color,
          location: ev.location,
          description: ev.description,
          source: "local",
          meetingLink: null,
          htmlLink: null,
          organizer: null,
          attendees: null,
          accountEmail: null,
        })
      }

      if (!isLocal || isSignedIn) {
        try {
          const googleRes = await fetch(
            `/api/google-calendar?action=events&date=${dateStr}`,
          )
          if (googleRes.ok) {
            const google = await googleRes.json()
            for (const ev of google) {
              merged.push({
                id: ev.id,
                title: ev.title,
                startTime: ev.startTime,
                endTime: ev.endTime,
                allDay: ev.allDay,
                color: ev.color,
                location: ev.location,
                description: ev.description ?? null,
                source: "google",
                meetingLink: ev.meetingLink ?? null,
                htmlLink: ev.htmlLink ?? null,
                organizer: ev.organizer ?? null,
                attendees: ev.attendees ?? null,
                accountEmail: ev.accountEmail ?? null,
              })
            }
          }
        } catch {}
      }

      return merged
    },
    [isSignedIn],
  )

  // Fetch events for current view
  const fetchEvents = useCallback(async () => {
    try {
      if (viewMode === "day") {
        const dayEvents = await fetchEventsForDate(selectedDateStr)
        setEvents(dayEvents)
      } else {
        // Compute date range for week or month
        let rangeStart: Date
        let rangeEnd: Date

        if (viewMode === "week") {
          rangeStart = startOfWeek(selectedDate, { weekStartsOn: 0 })
          rangeEnd = addDays(rangeStart, 6)
        } else {
          const mStart = startOfMonth(selectedDate)
          const mEnd = endOfMonth(selectedDate)
          rangeStart = startOfWeek(mStart, { weekStartsOn: 0 })
          rangeEnd = endOfWeek(mEnd, { weekStartsOn: 0 })
        }

        const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd })
        const dateStrs = days.map((d) => format(d, "yyyy-MM-dd"))

        // Fetch all dates in parallel
        const results = await Promise.all(
          dateStrs.map((ds) => fetchEventsForDate(ds)),
        )

        const newMap = new Map<string, TimelineEvent[]>()
        dateStrs.forEach((ds, i) => {
          newMap.set(ds, results[i])
        })
        setDateEvents(newMap)
      }
    } catch {}
  }, [viewMode, selectedDate, selectedDateStr, fetchEventsForDate])

  const fetchMedicines = useCallback(async () => {
    if (viewMode !== "day") return
    try {
      const allMeds = (await listMedicines()) as MedicineItem[]
      const meds = allMeds.filter((m) => m.active)

      const dayOfWeek = selectedDate.getDay()
      const todayMeds = meds.filter((m) => m.activeDays.includes(dayOfWeek))

      const doseResults = await Promise.all(
        todayMeds.map(async (med) => {
          const doses = (await listDoses(
            med.id,
            selectedDateStr,
          )) as { timeId: string }[]
          const takenIds = new Set(doses.map((d) => d.timeId))

          return med.times.map((t) => ({
            medName: med.name,
            dosage: med.dosage,
            hour: t.hour,
            minute: t.minute,
            taken: takenIds.has(t.id),
          }))
        }),
      )

      setMedDoses(doseResults.flat())
    } catch {}
  }, [viewMode, selectedDate, selectedDateStr])

  useEffect(() => {
    fetchEvents()
    fetchMedicines()
    fetchCalendarAccounts()
  }, [fetchEvents, fetchMedicines, fetchCalendarAccounts])

  // Meeting reminders (day view only, today only)
  const { push: pushNotif } = useNotifications()
  const notifiedEventsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (viewMode !== "day" || !isToday(selectedDate)) return

    const check = () => {
      const now = new Date()
      const nowMin = now.getHours() * 60 + now.getMinutes()

      for (const ev of events) {
        if (ev.allDay) continue
        const [h, m] = ev.startTime.split(":").map(Number)
        const evMin = h * 60 + m
        const diff = evMin - nowMin

        if (diff > 0 && diff <= 5 && !notifiedEventsRef.current.has(ev.id)) {
          notifiedEventsRef.current.add(ev.id)
          pushNotif("meeting", ev.title, {
            body: `Starting in ${diff} min`,
            ttl: diff * 60 * 1000,
          })
        }
      }
    }

    check()
    const interval = setInterval(check, 30_000)
    return () => clearInterval(interval)
  }, [events, pushNotif, viewMode, selectedDate])

  // ── Google Calendar ──────────────────────────────────────────────────────

  const addGoogleAccount = useCallback(async () => {
    if (!googleClientId) return
    const { codeVerifier, codeChallenge } = await generatePKCE()
    const redirectUri = `${window.location.origin}/api/google-calendar/callback`
    const state = btoa(JSON.stringify({ v: codeVerifier, r: redirectUri }))

    const params = new URLSearchParams({
      client_id: googleClientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: GOOGLE_SCOPES,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      state,
      access_type: "offline",
      prompt: "consent",
    })

    window.open(
      `${GOOGLE_AUTH_URL}?${params}`,
      "google-calendar-auth",
      "width=500,height=700,left=200,top=100",
    )
  }, [googleClientId])

  const removeCalendarAccount = useCallback(
    async (id: string) => {
      setCalendarAccounts((prev) => prev.filter((a) => a.id !== id))
      try {
        await fetch(`/api/google-calendar?id=${id}`, { method: "DELETE" })
        toast.success("Account removed")
        fetchEvents()
      } catch {
        fetchCalendarAccounts()
      }
    },
    [fetchEvents, fetchCalendarAccounts],
  )

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return
      if (e.data?.type === "google-calendar-auth" && e.data.success) {
        toast.success("Google account connected")
        fetchCalendarAccounts()
        fetchEvents()
      }
    }
    window.addEventListener("message", handler)
    return () => window.removeEventListener("message", handler)
  }, [fetchCalendarAccounts, fetchEvents])

  // ── Day view interaction handlers ────────────────────────────────────────

  const xToMinutes = useCallback(
    (clientX: number): number | null => {
      const el = timelineRef.current
      if (!el) return null
      const rect = el.getBoundingClientRect()
      const relX = clientX - rect.left
      const pct = (relX / rect.width) * 100
      const raw = percentToMinutes(pct, windowStart)
      const snapped = snapTo15(raw)
      if (snapped < 0 || snapped > 23 * 60 + 59) return null
      return snapped
    },
    [windowStart],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const mins = xToMinutes(e.clientX)
      setHoverMinutes(mins)
      if (isDragging.current && mins !== null) {
        setDragEnd(mins)
      }
    },
    [xToMinutes],
  )

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return
      const target = e.target as HTMLElement
      if (target.closest("button, a, [data-event]")) return

      const mins = xToMinutes(e.clientX)
      if (mins === null) return

      isDragging.current = true
      setDragStart(mins)
      setDragEnd(mins)

      const el = timelineRef.current
      if (el) el.setPointerCapture(e.pointerId)
    },
    [xToMinutes],
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging.current) return
      isDragging.current = false

      const el = timelineRef.current
      if (el) el.releasePointerCapture(e.pointerId)

      if (dragStart !== null && dragEnd !== null) {
        const start = Math.min(dragStart, dragEnd)
        const end = Math.max(dragStart, dragEnd)

        if (end - start >= 15) {
          // Drag: use the dragged range
          setPrefillStart(minutesToTimeStr(start))
          setPrefillEnd(minutesToTimeStr(end))
          setDialogOpen(true)
        } else if (dragStart === dragEnd && dragStart > nowMinutes) {
          // Single click ahead of current time: start=exact now, end=clicked time
          setPrefillStart(minutesToTimeStr(nowMinutes))
          setPrefillEnd(minutesToTimeStr(dragStart))
          setDialogOpen(true)
        }
      }

      setDragStart(null)
      setDragEnd(null)
    },
    [dragStart, dragEnd],
  )

  const handlePointerLeave = useCallback(() => {
    if (!isDragging.current) {
      setHoverMinutes(null)
    }
  }, [])

  const handleDeleteEvent = async (id: string) => {
    try {
      await deleteScheduleEvent(id)
      fetchEvents()
      toast.success("Event deleted")
    } catch {
      toast.error("Failed to delete event")
    }
  }

  const handleUpdateEvent = async (id: string, data: { title?: string; startTime?: string; endTime?: string }) => {
    try {
      await updateScheduleEvent({ id, ...data })
      fetchEvents()
      toast.success("Event updated")
    } catch {
      toast.error("Failed to update event")
    }
  }

  const handleAddEvent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const title = form.get("title") as string
    const startTime = form.get("startTime") as string
    const endTime = form.get("endTime") as string
    if (!title || !startTime || !endTime) return

    try {
      await createScheduleEvent({
        cardId: "schedule-1",
        title,
        startTime,
        endTime,
        date: selectedDateStr,
        allDay: false,
        color: EVENT_COLORS[Math.floor(Math.random() * EVENT_COLORS.length)],
      })
      setDialogOpen(false)
      setPrefillStart("")
      setPrefillEnd("")
      fetchEvents()
      toast.success("Event added")
      mascotTrigger("event_added")
    } catch {
      toast.error("Failed to add event")
    }
  }

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open)
    if (!open) {
      setPrefillStart("")
      setPrefillEnd("")
    }
  }

  // ── Navigation helpers ───────────────────────────────────────────────────

  const handleViewChange = (mode: ViewMode) => {
    setViewMode(mode)
    localStorage.setItem("timeline-view-mode", mode)
  }

  const goToToday = () => {
    setSelectedDate(new Date())
  }

  const goBack = () => {
    if (viewMode === "day") setSelectedDate((d) => subDays(d, 1))
    else if (viewMode === "week") setSelectedDate((d) => subWeeks(d, 1))
    else setSelectedDate((d) => subMonths(d, 1))
  }

  const goForward = () => {
    if (viewMode === "day") setSelectedDate((d) => addDays(d, 1))
    else if (viewMode === "week") setSelectedDate((d) => addWeeks(d, 1))
    else setSelectedDate((d) => addMonths(d, 1))
  }

  const handleDayClick = (date: Date) => {
    setSelectedDate(date)
    handleViewChange("day")
  }

  // Current time position (dynamic based on window)
  const nowPercent = minutesToPercent(nowMinutes, windowStart)

  const selectionStart =
    dragStart !== null && dragEnd !== null
      ? Math.min(dragStart, dragEnd)
      : null
  const selectionEnd =
    dragStart !== null && dragEnd !== null
      ? Math.max(dragStart, dragEnd)
      : null

  // Header date display
  const headerDateLabel = useMemo(() => {
    if (!mounted) return "\u00A0"
    if (viewMode === "day") return format(selectedDate, "EEEE, MMM d")
    if (viewMode === "week") {
      const ws = startOfWeek(selectedDate, { weekStartsOn: 0 })
      const we = addDays(ws, 6)
      return `${format(ws, "MMM d")} - ${format(we, "MMM d, yyyy")}`
    }
    return format(selectedDate, "MMMM yyyy")
  }, [mounted, viewMode, selectedDate])

  const showTodayButton = !isToday(selectedDate)

  return (
    <div ref={zoneRef} className="zone-surface zone-timeline flex h-full flex-col">
      {/* Header */}
      <div className={`relative flex shrink-0 items-center justify-between px-3 py-1.5 ${editMode ? "zone-drag-handle" : ""}`}>
        {/* Left: title */}
        <div className="z-10 flex shrink-0 items-center gap-1.5">
          <ZoneDragHandle />
          <div
            className="h-5 w-[3px] rounded-full"
            style={{ background: "var(--zone-timeline-accent)" }}
          />
          <span
            className="font-[family-name:var(--font-display)] text-sm font-bold tracking-tight"
            style={{ color: "var(--zone-timeline-accent)" }}
          >
            Schedule
          </span>
        </div>

        {/* Center: date navigation - absolutely centered on card */}
        <div className="absolute inset-x-0 flex items-center justify-center">
          <div className="relative flex items-center gap-1">
            <button
              onClick={goBack}
              className="flex size-11 items-center justify-center rounded-lg border border-border/25 bg-muted/15 text-muted-foreground/60 transition-colors hover:border-border/40 hover:bg-muted/30 hover:text-foreground active:scale-95"
            >
              <ChevronLeft className="size-4" />
            </button>

            {/* Date label / calendar picker */}
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <button className="flex h-11 min-w-[11rem] items-center justify-center gap-1.5 rounded-lg border border-border/25 bg-muted/15 px-3 text-xs font-semibold text-foreground/80 transition-colors hover:border-border/40 hover:bg-muted/30">
                  <CalendarDays className="size-3.5 shrink-0 text-muted-foreground/50" />
                  {headerDateLabel}
                </button>
              </PopoverTrigger>
              <PopoverContent
                side="bottom"
                align="center"
                className="w-auto p-0"
              >
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    if (date) {
                      setSelectedDate(date)
                      setCalendarOpen(false)
                    }
                  }}
                  defaultMonth={selectedDate}
                />
              </PopoverContent>
            </Popover>

            <button
              onClick={goForward}
              className="flex size-11 items-center justify-center rounded-lg border border-border/25 bg-muted/15 text-muted-foreground/60 transition-colors hover:border-border/40 hover:bg-muted/30 hover:text-foreground active:scale-95"
            >
              <ChevronRight className="size-4" />
            </button>

            {/* Today button - absolutely positioned so it doesn't shift the centered nav */}
            {showTodayButton && (
              <button
                onClick={goToToday}
                className="absolute left-[calc(100%+0.5rem)] top-1/2 -translate-y-1/2 h-11 rounded-lg border border-amber-400/25 bg-amber-400/10 px-3 font-mono text-xs font-bold uppercase tracking-wider text-amber-400/80 transition-colors hover:border-amber-400/40 hover:bg-amber-400/20 hover:text-amber-400 active:scale-95 whitespace-nowrap"
              >
                Today
              </button>
            )}
          </div>
        </div>

        {/* Right: view mode switcher + actions */}
        <div className="z-10 flex items-center gap-1">
          {/* Sun arc toggle (day view only) - before D/W/M */}
          {viewMode === "day" && (
            <button
              onClick={toggleSunArc}
              className={`flex size-11 items-center justify-center rounded-lg border transition-colors active:scale-95 ${
                showSunArc
                  ? "border-amber-400/30 bg-amber-400/10 text-amber-400"
                  : "border-border/25 bg-muted/15 text-muted-foreground/40 hover:border-amber-400/30 hover:text-amber-400"
              }`}
              title="Toggle daylight arc"
            >
              <Sun className="size-4" />
            </button>
          )}

          {/* View mode tabs */}
          <div className="flex items-center rounded-lg border border-border/25 bg-muted/15 p-0.5">
            {(["day", "week", "month"] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => handleViewChange(mode)}
                className={`flex h-10 items-center justify-center rounded-md px-3 font-mono text-xs font-bold uppercase tracking-wider transition-all active:scale-95 ${
                  viewMode === mode
                    ? "bg-[var(--zone-timeline-accent)]/20 text-[var(--zone-timeline-accent)] shadow-sm"
                    : "text-muted-foreground/40 hover:bg-muted/20 hover:text-muted-foreground/70"
                }`}
              >
                {mode === "day" ? "D" : mode === "week" ? "W" : "M"}
              </button>
            ))}
          </div>

          {/* Calendar accounts popover -- always visible */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                className="flex size-11 items-center justify-center rounded-lg border border-border/25 bg-muted/15 text-muted-foreground/50 transition-colors hover:border-border/40 hover:bg-muted/30 hover:text-foreground active:scale-95"
                title="Connect calendars"
              >
                <CalendarCog className="size-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent side="bottom" align="end" className="w-64">
              <p className="mb-2 font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Connected Calendars
              </p>

              {isSignedIn ? (
                <>
                  {calendarAccounts.length > 0 ? (
                    <div className="mb-3 space-y-1">
                      {calendarAccounts.map((acc) => (
                        <div
                          key={acc.id}
                          className="group flex min-h-11 items-center gap-2 rounded px-2 hover:bg-muted/30"
                        >
                          <div
                            className="size-2 shrink-0 rounded-full"
                            style={{
                              backgroundColor: acc.color ?? "#3b82f6",
                            }}
                          />
                          <Mail className="size-3 shrink-0 text-muted-foreground/40" />
                          <span className="min-w-0 flex-1 truncate text-xs">
                            {acc.email}
                          </span>
                          <button
                            onClick={() => removeCalendarAccount(acc.id)}
                            className="flex size-11 shrink-0 items-center justify-center"
                          >
                            <Trash2 className="size-2.5 text-muted-foreground/30 hover:text-destructive" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mb-3 text-xs text-muted-foreground/40">
                      No calendars connected yet
                    </p>
                  )}
                  {googleClientId && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addGoogleAccount}
                      className="w-full text-xs"
                    >
                      <Plus className="size-3" />
                      Add Google Account
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <p className="mb-3 text-xs text-muted-foreground/50">
                    Connect your calendars to see events from Google, Outlook, and more on your schedule.
                  </p>
                  <div className="mb-3 space-y-1.5">
                    <div className="flex items-center gap-2 rounded px-2 py-1.5 text-xs text-muted-foreground/40">
                      <div className="size-2 rounded-full bg-blue-500/40" />
                      Google Calendar
                    </div>
                    <div className="flex items-center gap-2 rounded px-2 py-1.5 text-xs text-muted-foreground/40">
                      <div className="size-2 rounded-full bg-sky-500/40" />
                      Outlook Calendar
                    </div>
                    <div className="flex items-center gap-2 rounded px-2 py-1.5 text-xs text-muted-foreground/40">
                      <div className="size-2 rounded-full bg-rose-500/40" />
                      Apple Calendar
                    </div>
                  </div>
                  <SignInButton mode="modal">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs"
                    >
                      <LogIn className="size-3" />
                      Sign in to connect
                    </Button>
                  </SignInButton>
                </>
              )}
            </PopoverContent>
          </Popover>

          {/* Add event button */}
          <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
            <DialogTrigger asChild>
              <button
                className="flex size-11 items-center justify-center rounded-lg border border-border/25 bg-muted/15 text-muted-foreground/50 transition-colors hover:border-border/40 hover:bg-muted/30 hover:text-foreground active:scale-95"
                title="Add event"
              >
                <Plus className="size-4" />
              </button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Event</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddEvent} className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    name="title"
                    placeholder="Meeting name"
                    required
                    autoFocus
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="startTime">Start</Label>
                    <Input
                      id="startTime"
                      name="startTime"
                      type="time"
                      required
                      defaultValue={prefillStart}
                      key={`start-${prefillStart}`}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="endTime">End</Label>
                    <Input
                      id="endTime"
                      name="endTime"
                      type="time"
                      required
                      defaultValue={prefillEnd}
                      key={`end-${prefillEnd}`}
                    />
                  </div>
                </div>
                <Button type="submit">Add Event</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* ── View body ─────────────────────────────────────────────────────── */}

      {viewMode === "day" && isVertical && (
        /* ── Vertical day view ──────────────────────────────────────── */
        <div className="relative min-h-0 flex-1 overflow-hidden">
          {/* All-day events */}
          {events.filter((ev) => ev.allDay).length > 0 && (
            <div className="flex shrink-0 gap-1 border-b border-border/10 px-3 py-1.5">
              {events
                .filter((ev) => ev.allDay)
                .map((ev) => {
                  const evColor = ev.color ?? eventColor(ev.id)
                  return (
                    <span
                      key={ev.id}
                      className="rounded-full px-2 py-0.5 text-[0.5rem] font-medium"
                      style={{ backgroundColor: evColor, color: "var(--primary-foreground)" }}
                    >
                      {ev.title}
                    </span>
                  )
                })}
            </div>
          )}
          <div
            className="absolute inset-0 overflow-y-auto"
            ref={(el) => {
              // Auto-scroll to current time on mount
              if (el && isViewingToday && mounted) {
                const scrollPct = minutesToPercent(nowMinutes, windowStart) / 100
                const target = scrollPct * WINDOW_MINUTES * 0.8 - el.clientHeight / 3
                el.scrollTop = Math.max(0, target)
              }
            }}
          >
            <div className="relative" style={{ height: `${WINDOW_MINUTES * 0.8}px` }}>
              {/* Hour markers */}
              {(() => {
                const firstHour = Math.ceil(windowStart / 60)
                const lastHour = Math.floor(windowEnd / 60)
                const markers = []
                for (let hour = firstHour; hour <= lastHour; hour++) {
                  const mins = hour * 60
                  const pct = minutesToPercent(mins, windowStart)
                  const displayHour = ((hour % 24) + 24) % 24
                  markers.push(
                    <div
                      key={hour}
                      className="absolute left-0 w-full"
                      style={{ top: `${pct}%` }}
                    >
                      <div className="flex items-center gap-2 px-2">
                        <span className="w-8 shrink-0 text-right font-mono text-[0.5rem] leading-none text-muted-foreground/40">
                          {displayHour === 0
                            ? "12a"
                            : displayHour < 12
                              ? `${displayHour}a`
                              : displayHour === 12
                                ? "12p"
                                : `${displayHour - 12}p`}
                        </span>
                        <div className="h-px flex-1 bg-border/15" />
                      </div>
                    </div>,
                  )
                }
                return markers
              })()}

              {/* Events */}
              {events
                .filter((ev) => !ev.allDay)
                .map((ev) => {
                  const topPct = timeToPercent(ev.startTime, windowStart)
                  const bottomPct = timeToPercent(ev.endTime, windowStart)
                  const heightPct = Math.max(bottomPct - topPct, 1.5)
                  const evColor = ev.color ?? eventColor(ev.id)

                  return (
                    <Popover key={ev.id}>
                      <PopoverTrigger asChild>
                        <button
                          data-event
                          className="absolute left-12 right-2 cursor-pointer overflow-hidden rounded-lg px-3 py-1.5 text-left text-xs font-medium leading-tight shadow-sm transition-all hover:brightness-110 hover:shadow-md"
                          style={{
                            top: `${topPct}%`,
                            height: `${heightPct}%`,
                            backgroundColor: evColor,
                            color: "var(--primary-foreground)",
                          }}
                        >
                          <span className="line-clamp-2">{ev.title}</span>
                          {ev.location && (
                            <span className="mt-0.5 flex items-center gap-1 text-[0.5rem] opacity-70">
                              <MapPin className="size-2" />
                              {ev.location}
                            </span>
                          )}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent side="left" align="start" className="w-64 p-0">
                        <div className="h-1 w-full rounded-t-md" style={{ backgroundColor: evColor }} />
                        <div className="space-y-2 p-3">
                          <p className="text-sm font-semibold">{ev.title}</p>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Clock className="size-3 shrink-0" />
                            {formatTime12(parseInt(ev.startTime.split(":")[0]) * 60 + parseInt(ev.startTime.split(":")[1]))}
                            {" - "}
                            {formatTime12(parseInt(ev.endTime.split(":")[0]) * 60 + parseInt(ev.endTime.split(":")[1]))}
                          </div>
                          {ev.location && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <MapPin className="size-3 shrink-0" />
                              <span>{ev.location}</span>
                            </div>
                          )}
                          {ev.description && (
                            <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                              <FileText className="mt-0.5 size-3 shrink-0" />
                              <span className="whitespace-pre-wrap">{ev.description}</span>
                            </div>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  )
                })}

              {/* Now line (horizontal) */}
              {mounted && isViewingToday && nowPercent >= 0 && nowPercent <= 100 && (
                <div
                  className="pointer-events-none absolute left-0 z-10 w-full"
                  style={{ top: `${nowPercent}%` }}
                >
                  <div className="flex items-center">
                    <div className="now-dot size-2 shrink-0 rounded-full bg-amber-400" />
                    <div className="h-px flex-1 bg-amber-400/70 shadow-[0_0_6px_oklch(0.8_0.16_85)]" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {viewMode === "day" && !isVertical && (
        /* ── Horizontal day view ────────────────────────────────────── */
        <div
          ref={timelineRef}
          className="relative min-h-0 flex-1 cursor-crosshair select-none"
          onPointerMove={handlePointerMove}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerLeave}
        >
          {/* Sun/moon arcs */}
          {mounted && showSunArc && (
            <svg
              className="pointer-events-none absolute inset-0 z-0"
              width="100%"
              height="100%"
              preserveAspectRatio="none"
              viewBox="0 0 1000 100"
            >
              <defs>
                <linearGradient
                  id="sun-arc-fill"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" className="sun-arc-stop-top" />
                  <stop offset="50%" className="sun-arc-stop-bottom" />
                </linearGradient>
                <linearGradient
                  id="moon-arc-fill"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="50%" className="moon-arc-stop-top" />
                  <stop offset="100%" className="moon-arc-stop-bottom" />
                </linearGradient>
              </defs>
              {(() => {
                const arcs = buildDaylightArcs(
                  1000,
                  100,
                  windowStart,
                  nowMinutes,
                )
                return (
                  <>
                    <line
                      x1="0"
                      y1="50"
                      x2="1000"
                      y2="50"
                      className="horizon-line"
                      strokeWidth="0.3"
                    />
                    <path d={arcs.sun.fill} fill="url(#sun-arc-fill)" />
                    <path
                      d={arcs.sun.stroke}
                      fill="none"
                      className="sun-arc-stroke"
                      strokeWidth="0.5"
                    />
                    <path d={arcs.moon.fill} fill="url(#moon-arc-fill)" />
                    <path
                      d={arcs.moon.stroke}
                      fill="none"
                      className="moon-arc-stroke"
                      strokeWidth="0.5"
                    />
                  </>
                )
              })()}
            </svg>
          )}

          {/* Hour markers */}
          {(() => {
            const firstHour = Math.ceil(windowStart / 60)
            const lastHour = Math.floor(windowEnd / 60)
            const markers = []
            for (let hour = firstHour; hour <= lastHour; hour++) {
              const mins = hour * 60
              const pct = minutesToPercent(mins, windowStart)
              const displayHour = ((hour % 24) + 24) % 24
              const isEven = hour % 2 === 0
              markers.push(
                <div
                  key={hour}
                  className="absolute top-0 h-full"
                  style={{ left: `${pct}%` }}
                >
                  <span
                    className={`absolute top-0 -translate-x-1/2 font-mono text-xs leading-none text-muted-foreground/40 ${!isEven ? "hidden sm:inline" : ""}`}
                  >
                    {displayHour === 0
                      ? "12a"
                      : displayHour < 12
                        ? `${displayHour}a`
                        : displayHour === 12
                          ? "12p"
                          : `${displayHour - 12}p`}
                  </span>
                  <div className="mt-2.5 h-[calc(100%-10px)] w-px bg-border/15" />
                </div>,
              )
            }
            return markers
          })()}

          {/* Drag selection highlight */}
          {selectionStart !== null &&
            selectionEnd !== null &&
            selectionEnd - selectionStart >= 15 && (
              <div
                className="pointer-events-none absolute z-[5] rounded-md border border-primary/40 bg-primary/10"
                style={{
                  left: `${minutesToPercent(selectionStart, windowStart)}%`,
                  width: `${minutesToPercent(selectionEnd, windowStart) - minutesToPercent(selectionStart, windowStart)}%`,
                  top: "16px",
                  bottom: "4px",
                }}
              >
                <div className="flex h-full items-center justify-center">
                  <span className="whitespace-nowrap rounded bg-primary/20 px-1.5 py-0.5 font-mono text-xs font-medium text-primary">
                    {formatTime12(selectionStart)} -{" "}
                    {formatTime12(selectionEnd)}
                  </span>
                </div>
              </div>
            )}

          {/* Calendar events */}
          {(() => {
            const timedEvents = events.filter((ev) => !ev.allDay)
            const lanes = computeEventLanes(timedEvents)

            return timedEvents.map((ev, idx) => {
              const leftPct = timeToPercent(ev.startTime, windowStart)
              const rightPct = timeToPercent(ev.endTime, windowStart)
              const widthPct = Math.max(rightPct - leftPct, 2)

              const evColor = ev.color ?? eventColor(ev.id)
              const assignment = lanes.get(ev.id) ?? { lane: 0, totalLanes: 1 }
              const eventAreaTop = 16 // px below hour markers
              const eventAreaBottom = 16 // px above bottom
              const laneHeightPct = 100 / assignment.totalLanes
              const topPct = assignment.lane * laneHeightPct

              return (
                <button
                  key={ev.id}
                  data-event
                  onClick={() => setSelectedEvent(ev)}
                  className="absolute flex cursor-pointer items-center gap-1 overflow-hidden rounded-md px-2 py-0.5 text-left text-xs font-medium leading-tight shadow-sm transition-all hover:brightness-110 hover:shadow-md"
                  style={{
                    left: `${leftPct}%`,
                    width: `${widthPct}%`,
                    top: `calc(${eventAreaTop}px + (100% - ${eventAreaTop + eventAreaBottom}px) * ${topPct / 100})`,
                    height: `calc((100% - ${eventAreaTop + eventAreaBottom}px) * ${laneHeightPct / 100} - 2px)`,
                    backgroundColor: evColor,
                    color: "var(--primary-foreground)",
                  }}
                >
                  <span className="truncate">{ev.title}</span>
                  {ev.location && (
                    <MapPin className="size-2 shrink-0 opacity-70" />
                  )}
                </button>
              )
            })
          })()}

          {/* All-day events */}
          {events.filter((ev) => ev.allDay).length > 0 && (
            <div className="absolute left-1 top-3 flex gap-1">
              {events
                .filter((ev) => ev.allDay)
                .map((ev, idx) => {
                  const evColor = ev.color ?? eventColor(ev.id)
                  return (
                    <button
                      key={ev.id}
                      data-event
                      onClick={() => setSelectedEvent(ev)}
                      className="cursor-pointer rounded-full px-1.5 py-0.5 text-xs font-medium transition-all hover:brightness-110"
                      style={{
                        backgroundColor: evColor,
                        color: "var(--primary-foreground)",
                      }}
                    >
                      {ev.title}
                    </button>
                  )
                })}
            </div>
          )}

          {/* Medicine dose markers */}
          {medDoses.map((dose, idx) => {
            const minutes = dose.hour * 60 + dose.minute
            const pct = minutesToPercent(minutes, windowStart)
            if (pct < 0 || pct > 100) return null

            return (
              <div
                key={`med-${idx}`}
                className="absolute -translate-x-1/2"
                style={{ left: `${pct}%`, bottom: "2px" }}
                title={`${dose.medName}${dose.dosage ? ` (${dose.dosage})` : ""} at ${String(dose.hour).padStart(2, "0")}:${String(dose.minute).padStart(2, "0")}`}
              >
                <div
                  className={`flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-xs font-medium transition-opacity ${
                    dose.taken
                      ? "border-[var(--vital-meds)]/30 bg-[var(--vital-meds)]/10 text-[var(--vital-meds)] opacity-50 line-through"
                      : "border-[var(--vital-meds)]/40 bg-[var(--vital-meds)]/15 text-[var(--vital-meds)]"
                  }`}
                >
                  <Pill className="size-2" />
                  <span className="max-w-[50px] truncate">
                    {dose.medName}
                  </span>
                </div>
              </div>
            )
          })}

          {/* Hover time indicator */}
          {hoverMinutes !== null && !isDragging.current && (
            <div
              className="pointer-events-none absolute top-0 z-[8] h-full"
              style={{
                left: `${minutesToPercent(hoverMinutes, windowStart)}%`,
              }}
            >
              <div className="-translate-x-1/2 whitespace-nowrap rounded bg-muted/80 px-1 py-0.5 font-mono text-xs font-medium text-foreground/70 backdrop-blur-sm">
                {formatTime12(hoverMinutes)}
              </div>
              <div className="absolute top-5 bottom-0 left-0 w-px bg-foreground/10" />
            </div>
          )}

          {/* Current time indicator */}
          {mounted && isViewingToday && nowPercent >= 0 && nowPercent <= 100 && (
            <div
              className="pointer-events-none absolute top-0 z-10 h-full"
              style={{ left: `${nowPercent}%` }}
            >
              <div className="absolute top-[13px] bottom-0 left-0 w-px bg-amber-400/70 shadow-[0_0_6px_oklch(0.8_0.16_85)]" />
              <div className="now-dot absolute top-[10px] -translate-x-1/2 size-2 rounded-full bg-amber-400" />
            </div>
          )}
        </div>
      )}

      {viewMode === "week" && (
        <WeekView
          selectedDate={selectedDate}
          dateEvents={dateEvents}
          onSelectDay={handleDayClick}
        />
      )}

      {viewMode === "month" && (
        <MonthView
          selectedDate={selectedDate}
          dateEvents={dateEvents}
          onSelectDay={handleDayClick}
        />
      )}

      {/* Event detail dialog */}
      {selectedEvent && (
        <EventDetailDialog
          event={selectedEvent}
          open={!!selectedEvent}
          onOpenChange={(open) => { if (!open) setSelectedEvent(null) }}
          onDelete={handleDeleteEvent}
          onUpdate={handleUpdateEvent}
        />
      )}
    </div>
  )
}
