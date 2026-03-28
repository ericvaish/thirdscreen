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
  listMedicines,
  listDoses,
  isLocal,
} from "@/lib/data-layer"
import { useNotifications } from "@/lib/notifications"
import { generatePKCE } from "@/lib/spotify/pkce"
import { GOOGLE_AUTH_URL, GOOGLE_SCOPES } from "@/lib/google-calendar/constants"

// ── Constants ────────────────────────────────────────────────────────────────

const WINDOW_HOURS = 24 // total span: -12h to +12h
const WINDOW_MINUTES = WINDOW_HOURS * 60
const EVENT_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

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
              <div className="font-mono text-[0.5rem] uppercase text-muted-foreground/50">
                {format(day, "EEE")}
              </div>
              <div
                className={`mx-auto flex size-5 items-center justify-center rounded-full font-mono text-[0.625rem] font-medium ${
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
                        ev.color ?? EVENT_COLORS[i % EVENT_COLORS.length],
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
                        ev.color ?? EVENT_COLORS[idx % EVENT_COLORS.length],
                    }}
                  >
                    <span className="block truncate px-0.5 text-[0.375rem] font-medium leading-tight text-white/90">
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
            className="text-center font-mono text-[0.5rem] uppercase text-muted-foreground/40"
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
                className={`flex size-4 shrink-0 items-center justify-center rounded-full font-mono text-[0.5625rem] font-medium ${
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
                          ev.color ?? EVENT_COLORS[i % EVENT_COLORS.length],
                      }}
                    />
                  ))}
                  {events.length > 4 && (
                    <span className="text-[0.375rem] leading-none text-muted-foreground/50">
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

// ── Main component ───────────────────────────────────────────────────────────

export function TimelineZone() {
  const { isSignedIn } = useAuth()

  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [dateEvents, setDateEvents] = useState<Map<string, TimelineEvent[]>>(
    new Map(),
  )
  const [medDoses, setMedDoses] = useState<MedDose[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)
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
        color: EVENT_COLORS[events.length % EVENT_COLORS.length],
      })
      setDialogOpen(false)
      setPrefillStart("")
      setPrefillEnd("")
      fetchEvents()
      toast.success("Event added")
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
    <div className="zone-surface zone-timeline flex h-full flex-col">
      {/* Header */}
      <div className="relative flex shrink-0 items-center justify-between px-3 py-1.5">
        {/* Left: title */}
        <div className="z-10 flex shrink-0 items-center gap-1.5">
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
                className="absolute left-[calc(100%+0.5rem)] top-1/2 -translate-y-1/2 h-11 rounded-lg border border-amber-400/25 bg-amber-400/10 px-3 font-mono text-[0.625rem] font-bold uppercase tracking-wider text-amber-400/80 transition-colors hover:border-amber-400/40 hover:bg-amber-400/20 hover:text-amber-400 active:scale-95 whitespace-nowrap"
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
                className={`flex h-10 items-center justify-center rounded-md px-3 font-mono text-[0.625rem] font-bold uppercase tracking-wider transition-all active:scale-95 ${
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
              <p className="mb-2 font-mono text-[0.625rem] font-medium uppercase tracking-wider text-muted-foreground">
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
                            className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
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

      {viewMode === "day" && (
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
                    className={`absolute top-0 -translate-x-1/2 font-mono text-[0.5rem] leading-none text-muted-foreground/40 ${!isEven ? "hidden sm:inline" : ""}`}
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
                  <span className="whitespace-nowrap rounded bg-primary/20 px-1.5 py-0.5 font-mono text-[0.5rem] font-medium text-primary">
                    {formatTime12(selectionStart)} -{" "}
                    {formatTime12(selectionEnd)}
                  </span>
                </div>
              </div>
            )}

          {/* Calendar events */}
          {events
            .filter((ev) => !ev.allDay)
            .map((ev, idx) => {
              const leftPct = timeToPercent(ev.startTime, windowStart)
              const rightPct = timeToPercent(ev.endTime, windowStart)
              const widthPct = Math.max(rightPct - leftPct, 2)

              const evColor = ev.color ?? EVENT_COLORS[idx % EVENT_COLORS.length]

              return (
                <Popover key={ev.id}>
                  <PopoverTrigger asChild>
                    <button
                      data-event
                      className="absolute flex cursor-pointer items-center gap-1 overflow-hidden rounded-md px-2 py-1 text-left text-[0.625rem] font-medium leading-tight shadow-sm transition-all hover:brightness-110 hover:shadow-md"
                      style={{
                        left: `${leftPct}%`,
                        width: `${widthPct}%`,
                        top: "16px",
                        bottom: "16px",
                        backgroundColor: evColor,
                        color: "var(--primary-foreground)",
                      }}
                    >
                      <span className="truncate">{ev.title}</span>
                      {ev.location && (
                        <MapPin className="size-2 shrink-0 opacity-70" />
                      )}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    side="bottom"
                    align="start"
                    className="w-64 p-0"
                  >
                    {/* Color bar */}
                    <div
                      className="h-1 w-full rounded-t-md"
                      style={{ backgroundColor: evColor }}
                    />
                    <div className="space-y-2 p-3">
                      <p className="text-sm font-semibold">{ev.title}</p>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="size-3 shrink-0" />
                        {formatTime12(
                          parseInt(ev.startTime.split(":")[0]) * 60 +
                            parseInt(ev.startTime.split(":")[1]),
                        )}{" "}
                        -{" "}
                        {formatTime12(
                          parseInt(ev.endTime.split(":")[0]) * 60 +
                            parseInt(ev.endTime.split(":")[1]),
                        )}
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
                          <span className="whitespace-pre-wrap">
                            {ev.description}
                          </span>
                        </div>
                      )}
                      <div className="pt-0.5">
                        <span className="rounded-full bg-muted px-1.5 py-0.5 font-mono text-[0.5rem] uppercase tracking-wider text-muted-foreground">
                          {ev.source}
                        </span>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              )
            })}

          {/* All-day events */}
          {events.filter((ev) => ev.allDay).length > 0 && (
            <div className="absolute left-1 top-3 flex gap-1">
              {events
                .filter((ev) => ev.allDay)
                .map((ev, idx) => {
                  const evColor = ev.color ?? EVENT_COLORS[idx % EVENT_COLORS.length]
                  return (
                    <Popover key={ev.id}>
                      <PopoverTrigger asChild>
                        <button
                          data-event
                          className="cursor-pointer rounded-full px-1.5 py-0.5 text-[0.5rem] font-medium transition-all hover:brightness-110"
                          style={{
                            backgroundColor: evColor,
                            color: "var(--primary-foreground)",
                          }}
                        >
                          {ev.title}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent side="bottom" align="start" className="w-64 p-0">
                        <div className="h-1 w-full rounded-t-md" style={{ backgroundColor: evColor }} />
                        <div className="space-y-2 p-3">
                          <p className="text-sm font-semibold">{ev.title}</p>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <CalendarDays className="size-3 shrink-0" />
                            All day
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
                  className={`flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[0.4375rem] font-medium transition-opacity ${
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
              <div className="-translate-x-1/2 whitespace-nowrap rounded bg-muted/80 px-1 py-0.5 font-mono text-[0.5rem] font-medium text-foreground/70 backdrop-blur-sm">
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

    </div>
  )
}
