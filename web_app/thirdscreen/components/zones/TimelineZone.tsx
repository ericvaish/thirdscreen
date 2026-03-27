"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { format } from "date-fns"
import { Plus, MapPin, Pill, Sun, CalendarPlus, Trash2, Mail } from "lucide-react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import type { ScheduleEvent, MedicineItem } from "@/lib/types"
import { listScheduleEvents, createScheduleEvent, listMedicines, listDoses, isLocal } from "@/lib/data-layer"
import { useNotifications } from "@/lib/notifications"
import { generatePKCE } from "@/lib/spotify/pkce"
import { GOOGLE_AUTH_URL, GOOGLE_SCOPES } from "@/lib/google-calendar/constants"

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

// Next-day sunrise for the moon arc's right endpoint
const NEXT_SUNRISE_MIN = 24 * 60 + SUNRISE_MIN // tomorrow's sunrise in "extended" minutes
const PREV_SUNSET_MIN = SUNSET_MIN - 24 * 60   // yesterday's sunset in "extended" minutes

interface ArcPaths {
  fill: string
  stroke: string
}

interface DaylightArcs {
  sun: ArcPaths
  moon: ArcPaths
  /** Position of the sun/moon indicator on the arc: { x, y, isSun } */
  indicator: { x: number; y: number; isSun: boolean } | null
}

function buildDaylightArcs(width: number, height: number, startMin: number, nowMin: number): DaylightArcs {
  const horizonY = height * 0.5
  const sunPeak = height * 0.08    // how high sun arc goes (from top)
  const moonTrough = height * 0.92 // how low moon arc goes (from top)
  const steps = 60

  // ── Sun arc (sunrise → sunset, curves above horizon) ──
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

  // ── Moon arc (sunset → next sunrise, curves below horizon) ──
  const moonStartX = (minutesToPercent(SUNSET_MIN, startMin) / 100) * width
  const moonEndX = (minutesToPercent(NEXT_SUNRISE_MIN, startMin) / 100) * width
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

  // ── Pre-sunrise moon arc (yesterday sunset → today sunrise) ──
  // This covers the early morning dark period before sunrise
  const prevMoonStartX = (minutesToPercent(PREV_SUNSET_MIN, startMin) / 100) * width
  const prevMoonEndX = (minutesToPercent(SUNRISE_MIN, startMin) / 100) * width
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

  // Combine both moon arcs
  const combinedMoonFill = moonFill + " " + prevMoonFill
  const combinedMoonStroke = moonStroke + " " + prevMoonStroke

  // ── Current position indicator ──
  let indicator: DaylightArcs["indicator"] = null
  const isSun = nowMin >= SUNRISE_MIN && nowMin < SUNSET_MIN

  if (isSun) {
    const t = (nowMin - SUNRISE_MIN) / (SUNSET_MIN - SUNRISE_MIN)
    const x = sunriseX + t * sunArcW
    const y = horizonY - (horizonY - sunPeak) * Math.sin(Math.PI * t)
    indicator = { x, y, isSun: true }
  } else {
    // Night time: figure out which moon arc we're on
    if (nowMin >= SUNSET_MIN) {
      // Evening: on the post-sunset moon arc
      const t = (nowMin - SUNSET_MIN) / (NEXT_SUNRISE_MIN - SUNSET_MIN)
      const x = moonStartX + t * moonArcW
      const y = horizonY + (moonTrough - horizonY) * Math.sin(Math.PI * t)
      indicator = { x, y, isSun: false }
    } else {
      // Pre-sunrise: on the prev-sunset moon arc
      const t = (nowMin - (PREV_SUNSET_MIN + 24 * 60)) / (SUNRISE_MIN - (PREV_SUNSET_MIN + 24 * 60))
      // Actually simpler: nowMin is 0..SUNRISE_MIN, arc goes from PREV_SUNSET to SUNRISE
      // In extended minutes: nowMin maps to position on prevMoon arc
      const arcStart = PREV_SUNSET_MIN + 24 * 60 // = SUNSET_MIN (yesterday, normalized)
      const arcEnd = SUNRISE_MIN
      const totalArc = arcEnd - arcStart + 24 * 60 // handle wrap
      // prevMoon arc covers yesterday sunset (PREV_SUNSET_MIN) to today sunrise (SUNRISE_MIN)
      // That's a span of SUNRISE_MIN - PREV_SUNSET_MIN minutes
      const span = SUNRISE_MIN - PREV_SUNSET_MIN // this is positive since PREV is negative
      const tPrev = (nowMin - PREV_SUNSET_MIN) / span
      const clampedT = Math.max(0, Math.min(1, tPrev))
      const x = prevMoonStartX + clampedT * prevMoonArcW
      const y = horizonY + (moonTrough - horizonY) * Math.sin(Math.PI * clampedT)
      indicator = { x, y, isSun: false }
    }
  }

  return {
    sun: { fill: sunFill, stroke: sunStroke },
    moon: { fill: combinedMoonFill, stroke: combinedMoonStroke },
    indicator,
  }
}

interface MedDose {
  medName: string
  dosage: string | null
  hour: number
  minute: number
  taken: boolean
}

// Unified event shape for timeline display (local + external)
interface TimelineEvent {
  id: string
  title: string
  startTime: string
  endTime: string
  allDay: boolean
  color: string | null
  location: string | null
  source: "local" | "google"
}

export function TimelineZone() {
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [medDoses, setMedDoses] = useState<MedDose[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [showSunArc, setShowSunArc] = useState(true)
  const [today, setToday] = useState("")
  const [mounted, setMounted] = useState(false)
  const [nowMinutes, setNowMinutes] = useState(() => {
    const n = new Date()
    return n.getHours() * 60 + n.getMinutes()
  })

  // Derived window bounds: current time is always centered
  const windowStart = nowMinutes - WINDOW_MINUTES / 2
  const windowEnd = nowMinutes + WINDOW_MINUTES / 2

  useEffect(() => {
    setMounted(true)
    setToday(format(new Date(), "yyyy-MM-dd"))
    const stored = localStorage.getItem("timeline-sun-arc")
    if (stored === "false") setShowSunArc(false)

    // Update current time every 30 seconds so timeline stays centered
    const interval = setInterval(() => {
      const n = new Date()
      setNowMinutes(n.getHours() * 60 + n.getMinutes())
      // Also update today if it changed (past midnight)
      setToday(format(n, "yyyy-MM-dd"))
    }, 30_000)
    return () => clearInterval(interval)
  }, [])

  // Hover + drag state
  const timelineRef = useRef<HTMLDivElement>(null)
  const [hoverMinutes, setHoverMinutes] = useState<number | null>(null)
  const [dragStart, setDragStart] = useState<number | null>(null)
  const [dragEnd, setDragEnd] = useState<number | null>(null)
  const isDragging = useRef(false)

  // Pre-filled times for dialog (set by drag)
  const [prefillStart, setPrefillStart] = useState("")
  const [prefillEnd, setPrefillEnd] = useState("")

  // Calendar accounts state
  const [calendarAccounts, setCalendarAccounts] = useState<{ id: string; email: string; color: string | null }[]>([])
  const [googleClientId, setGoogleClientId] = useState<string | null>(null)

  const fetchCalendarAccounts = useCallback(async () => {
    if (isLocal) return
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
  }, [])

  const toggleSunArc = () => {
    setShowSunArc((prev) => {
      const next = !prev
      localStorage.setItem("timeline-sun-arc", String(next))
      return next
    })
  }

  const fetchEvents = useCallback(async () => {
    if (!today) return
    try {
      const merged: TimelineEvent[] = []

      // Local/DB events via data layer
      const localEvents = (await listScheduleEvents(today)) as ScheduleEvent[]
      for (const ev of localEvents) {
        merged.push({
          id: ev.id,
          title: ev.title,
          startTime: ev.startTime,
          endTime: ev.endTime,
          allDay: ev.allDay,
          color: ev.color,
          location: ev.location,
          source: "local",
        })
      }

      // Google Calendar events (only in server mode -- requires OAuth)
      if (!isLocal) {
        try {
          const googleRes = await fetch(`/api/google-calendar?action=events&date=${today}`)
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
                source: "google",
              })
            }
          }
        } catch {}
      }

      setEvents(merged)
    } catch {}
  }, [today])

  const fetchMedicines = useCallback(async () => {
    try {
      const allMeds = (await listMedicines()) as MedicineItem[]
      const meds = allMeds.filter((m) => m.active)

      const dayOfWeek = new Date().getDay()
      const todayMeds = meds.filter((m) => m.activeDays.includes(dayOfWeek))

      const doseResults = await Promise.all(
        todayMeds.map(async (med) => {
          const doses = (await listDoses(med.id, today)) as { timeId: string }[]
          const takenIds = new Set(doses.map((d) => d.timeId))

          return med.times.map((t) => ({
            medName: med.name,
            dosage: med.dosage,
            hour: t.hour,
            minute: t.minute,
            taken: takenIds.has(t.id),
          }))
        })
      )

      setMedDoses(doseResults.flat())
    } catch {}
  }, [today])

  useEffect(() => {
    fetchEvents()
    fetchMedicines()
    fetchCalendarAccounts()
  }, [fetchEvents, fetchMedicines, fetchCalendarAccounts])

  // Meeting reminders: check every 30s, notify 5 min before events
  const { push: pushNotif } = useNotifications()
  const notifiedEventsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    const check = () => {
      const now = new Date()
      const nowMin = now.getHours() * 60 + now.getMinutes()

      for (const ev of events) {
        if (ev.allDay) continue
        const [h, m] = ev.startTime.split(":").map(Number)
        const evMin = h * 60 + m
        const diff = evMin - nowMin

        // Notify 5 minutes before
        if (diff > 0 && diff <= 5 && !notifiedEventsRef.current.has(ev.id)) {
          notifiedEventsRef.current.add(ev.id)
          pushNotif("meeting", ev.title, {
            body: `Starting in ${diff} min`,
            ttl: diff * 60 * 1000, // dismiss when event starts
          })
        }
      }
    }

    check()
    const interval = setInterval(check, 30_000)
    return () => clearInterval(interval)
  }, [events, pushNotif])

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
      "width=500,height=700,left=200,top=100"
    )
  }, [googleClientId])

  const removeCalendarAccount = useCallback(async (id: string) => {
    setCalendarAccounts((prev) => prev.filter((a) => a.id !== id))
    try {
      await fetch(`/api/google-calendar?id=${id}`, { method: "DELETE" })
      toast.success("Account removed")
      fetchEvents()
    } catch {
      fetchCalendarAccounts()
    }
  }, [fetchEvents, fetchCalendarAccounts])

  // Listen for Google OAuth callback
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

  // Convert mouse X position to snapped minutes
  const xToMinutes = useCallback((clientX: number): number | null => {
    const el = timelineRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    const relX = clientX - rect.left
    const pct = (relX / rect.width) * 100
    const raw = percentToMinutes(pct, windowStart)
    const snapped = snapTo15(raw)
    // Clamp to valid day range (0:00 - 23:59) for event creation
    if (snapped < 0 || snapped > 23 * 60 + 59) return null
    return snapped
  }, [windowStart])

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const mins = xToMinutes(e.clientX)
      setHoverMinutes(mins)
      if (isDragging.current && mins !== null) {
        setDragEnd(mins)
      }
    },
    [xToMinutes]
  )

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Only start drag on primary button, and not on existing events/buttons
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
    [xToMinutes]
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

        // Need at least 15 minutes of selection
        if (end - start >= 15) {
          setPrefillStart(minutesToTimeStr(start))
          setPrefillEnd(minutesToTimeStr(end))
          setDialogOpen(true)
        }
      }

      setDragStart(null)
      setDragEnd(null)
    },
    [dragStart, dragEnd]
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
        date: today,
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

  // Clear prefill when dialog closes
  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open)
    if (!open) {
      setPrefillStart("")
      setPrefillEnd("")
    }
  }

  // Current time is always at 50% (center of the window)
  const nowPercent = 50

  // Drag selection range
  const selectionStart = dragStart !== null && dragEnd !== null ? Math.min(dragStart, dragEnd) : null
  const selectionEnd = dragStart !== null && dragEnd !== null ? Math.max(dragStart, dragEnd) : null

  return (
    <div className="zone-surface zone-timeline flex h-full flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between px-4 py-1.5">
        <div className="flex items-baseline gap-2.5">
          <div className="flex items-center gap-2">
            <div className="h-4 w-[3px] rounded-full" style={{ background: "var(--zone-timeline-accent)" }} />
            <span className="font-[family-name:var(--font-display)] text-sm font-bold tracking-tight" style={{ color: "var(--zone-timeline-accent)" }}>
              Schedule
            </span>
          </div>
          <span className="text-[0.625rem] text-muted-foreground/60">
            {mounted ? format(new Date(), "EEEE, MMM d") : "\u00A0"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant={showSunArc ? "secondary" : "ghost"}
            size="icon-xs"
            onClick={toggleSunArc}
            className={showSunArc ? "text-amber-400" : "text-muted-foreground/40 hover:text-amber-400"}
            title="Toggle daylight arc"
          >
            <Sun className="size-3.5" />
          </Button>

          {/* Calendar accounts popover */}
          {googleClientId && (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="text-muted-foreground/50 hover:text-foreground"
                  title="Connect calendars"
                >
                  <CalendarPlus className="size-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent side="bottom" align="end" className="w-64">
                <p className="mb-2 font-mono text-[0.625rem] font-medium uppercase tracking-wider text-muted-foreground">
                  Connected Calendars
                </p>
                {calendarAccounts.length > 0 ? (
                  <div className="mb-3 space-y-1">
                    {calendarAccounts.map((acc) => (
                      <div
                        key={acc.id}
                        className="group flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/30"
                      >
                        <div
                          className="size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: acc.color ?? "#3b82f6" }}
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
              </PopoverContent>
            </Popover>
          )}

          <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                className="text-muted-foreground/50 hover:text-foreground"
              >
                <Plus className="size-3.5" />
              </Button>
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

      {/* Timeline - percentage-based, no scroll */}
      <div
        ref={timelineRef}
        className="relative min-h-0 flex-1 cursor-crosshair select-none"
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
      >
        {/* Sun/moon arcs (behind everything) */}
        {mounted && showSunArc && (
          <svg
            className="pointer-events-none absolute inset-0 z-0"
            width="100%"
            height="100%"
            preserveAspectRatio="none"
            viewBox="0 0 1000 100"
          >
            <defs>
              <linearGradient id="sun-arc-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" className="sun-arc-stop-top" />
                <stop offset="50%" className="sun-arc-stop-bottom" />
              </linearGradient>
              <linearGradient id="moon-arc-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="50%" className="moon-arc-stop-top" />
                <stop offset="100%" className="moon-arc-stop-bottom" />
              </linearGradient>
            </defs>
            {(() => {
              const arcs = buildDaylightArcs(1000, 100, windowStart, nowMinutes)
              return (
                <>
                  {/* Horizon line */}
                  <line x1="0" y1="50" x2="1000" y2="50" className="horizon-line" strokeWidth="0.3" />
                  {/* Sun arc (above horizon) */}
                  <path d={arcs.sun.fill} fill="url(#sun-arc-fill)" />
                  <path d={arcs.sun.stroke} fill="none" className="sun-arc-stroke" strokeWidth="0.5" />
                  {/* Moon arc (below horizon) */}
                  <path d={arcs.moon.fill} fill="url(#moon-arc-fill)" />
                  <path d={arcs.moon.stroke} fill="none" className="moon-arc-stroke" strokeWidth="0.5" />
                  {/* Sun/Moon indicator dot on the arc */}
                  {arcs.indicator && (
                    <circle
                      cx={arcs.indicator.x}
                      cy={arcs.indicator.y}
                      r="2.5"
                      className={arcs.indicator.isSun ? "sun-indicator" : "moon-indicator"}
                    />
                  )}
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
            // Normalize hour to 0-23 for display
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
              </div>
            )
          }
          return markers
        })()}

        {/* Drag selection highlight */}
        {selectionStart !== null && selectionEnd !== null && selectionEnd - selectionStart >= 15 && (
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
              <span className="rounded bg-primary/20 px-1.5 py-0.5 font-mono text-[0.5rem] font-medium text-primary whitespace-nowrap">
                {formatTime12(selectionStart)} - {formatTime12(selectionEnd)}
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

            return (
              <div
                key={ev.id}
                data-event
                className="absolute flex items-center gap-1 overflow-hidden rounded-md px-2 py-1 text-[0.625rem] font-medium leading-tight shadow-sm transition-all hover:brightness-110 hover:shadow-md"
                style={{
                  left: `${leftPct}%`,
                  width: `${widthPct}%`,
                  top: "16px",
                  bottom: "16px",
                  backgroundColor:
                    ev.color ?? EVENT_COLORS[idx % EVENT_COLORS.length],
                  color: "var(--primary-foreground)",
                }}
              >
                <span className="truncate">{ev.title}</span>
                {ev.location && (
                  <MapPin className="size-2 shrink-0 opacity-70" />
                )}
              </div>
            )
          })}

        {/* All-day events */}
        {events.filter((ev) => ev.allDay).length > 0 && (
          <div className="absolute left-1 top-3 flex gap-1">
            {events
              .filter((ev) => ev.allDay)
              .map((ev, idx) => (
                <span
                  key={ev.id}
                  className="rounded-full px-1.5 py-0.5 text-[0.5rem] font-medium"
                  style={{
                    backgroundColor:
                      ev.color ?? EVENT_COLORS[idx % EVENT_COLORS.length],
                    color: "var(--primary-foreground)",
                  }}
                >
                  {ev.title}
                </span>
              ))}
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
                <span className="max-w-[50px] truncate">{dose.medName}</span>
              </div>
            </div>
          )
        })}

        {/* Hover time indicator */}
        {hoverMinutes !== null && !isDragging.current && (
          <div
            className="pointer-events-none absolute top-0 z-[8] h-full"
            style={{ left: `${minutesToPercent(hoverMinutes, windowStart)}%` }}
          >
            <div className="-translate-x-1/2 rounded bg-muted/80 px-1 py-0.5 font-mono text-[0.5rem] font-medium text-foreground/70 backdrop-blur-sm whitespace-nowrap">
              {formatTime12(hoverMinutes)}
            </div>
            <div className="absolute top-5 bottom-0 left-0 w-px bg-foreground/10" />
          </div>
        )}

        {/* Current time indicator — always at center */}
        {mounted && (
          <div
            className="pointer-events-none absolute top-0 z-10 h-full"
            style={{ left: `${nowPercent}%` }}
          >
            <div className="absolute top-[13px] left-0 w-px bottom-0 bg-amber-400/70 shadow-[0_0_6px_oklch(0.8_0.16_85)]" />
            <div className="now-dot absolute top-[10px] -translate-x-1/2 size-2 rounded-full bg-amber-400" />
          </div>
        )}
      </div>
    </div>
  )
}
