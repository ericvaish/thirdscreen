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
  isToday,
  eachDayOfInterval,
} from "date-fns"
import {
  Plus,
  MapPin,
  Pill,
  Sun,
  CalendarCog,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  X,
  MoreHorizontal,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { useAuth } from "@clerk/nextjs"
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
import { ZoneLabel } from "@/components/dashboard/ZoneLabel"
import { generatePKCE } from "@/lib/spotify/pkce"
import { GOOGLE_AUTH_URL, GOOGLE_SCOPES } from "@/lib/google-calendar/constants"
import { useTimezone } from "@/lib/timezone"

import {
  WINDOW_MINUTES,
  EVENT_COLORS,
  SUNRISE_MIN,
  SUNSET_MIN,
  eventColor,
  timeToPercent,
  minutesToPercent,
  percentToMinutes,
  snapTo15,
  minutesToTimeStr,
  formatTime12,
  computeEventLanes,
  buildDaylightArcs,
  type ViewMode,
  type TimelineEvent,
  type MedDose,
} from "./timeline/timeline-utils"
import { WeekView } from "./timeline/WeekView"
import { MonthView } from "./timeline/MonthView"
import { EventDetailDialog } from "./timeline/EventDetailDialog"
import { EventListPanel } from "./timeline/EventListPanel"
import { ViewModeDropdown } from "./timeline/ViewModeDropdown"
import { CalendarAccountsContent } from "./timeline/CalendarAccountsContent"
import { cn } from "@/lib/utils"


export function TimelineZone() {
  const { editMode } = useDashboard()
  const { isSignedIn } = useAuth()
  const { trigger: mascotTrigger } = useMascot()
  const { timezone } = useTimezone()

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
  // Progressive header collapse based on actual element overlap
  // Level 0: all buttons visible (wide)
  // Level 1: sun arc + D/W/M merged into one dropdown
  // Level 2: also merge calendar accounts + add event into overflow
  // Level 3: everything in a single overflow menu (smallest)
  const [compactLevel, setCompactLevel] = useState(0)
  const centerNavRef = useRef<HTMLDivElement>(null)
  const rightActionsRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLDivElement>(null)

  // Check if center nav content is wider than its flex container (being squeezed)
  useEffect(() => {
    const center = centerNavRef.current
    if (!center) return
    const raf = requestAnimationFrame(() => {
      if (center.scrollWidth > center.clientWidth + 2) {
        setCompactLevel((prev) => Math.min(prev + 1, 3))
      }
    })
    return () => cancelAnimationFrame(raf)
  }, [compactLevel])

  // On zone resize, reset to 0 so the cascade re-evaluates
  useEffect(() => {
    const zone = zoneRef.current
    if (!zone) return
    let firstRun = true
    const ro = new ResizeObserver(() => {
      if (firstRun) { firstRun = false; return }
      setCompactLevel(0)
    })
    ro.observe(zone)
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
  const prevDateRef = useRef(selectedDate)

  // Smoothly animate windowStart toward targetWindowStart.
  // When navigating to a different day, start the animation from an offset
  // in the correct direction so the slide feels natural:
  //   Next day → content slides left (start from a high value, animate down to target)
  //   Prev day → content slides right (start from a low value, animate up to target)
  useEffect(() => {
    if (animRef.current) cancelAnimationFrame(animRef.current)

    const prevDate = prevDateRef.current
    prevDateRef.current = selectedDate

    if (prevDate && !isSameDay(prevDate, selectedDate)) {
      const goingForward = selectedDate > prevDate
      // Offset by half a window so the slide is visible but not jarring
      const offset = WINDOW_MINUTES * 0.4
      setWindowStart(goingForward ? targetWindowStart - offset : targetWindowStart + offset)
    }

    const animate = () => {
      setWindowStart((prev) => {
        const diff = targetWindowStart - prev
        if (Math.abs(diff) < 0.5) return targetWindowStart
        const next = prev + diff * 0.15
        animRef.current = requestAnimationFrame(animate)
        return next
      })
    }

    animRef.current = requestAnimationFrame(animate)
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [targetWindowStart, selectedDate])

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
  const [prefillDate, setPrefillDate] = useState("")

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
            `/api/google-calendar?action=events&date=${dateStr}&tz=${encodeURIComponent(timezone)}`,
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
    [isSignedIn, timezone],
  )

  // Fetch events for current view
  const fetchEvents = useCallback(async () => {
    try {
      if (viewMode === "day") {
        // Fetch selected day + adjacent days that the window might extend into
        const prevDateStr = format(subDays(selectedDate, 1), "yyyy-MM-dd")
        const nextDateStr = format(addDays(selectedDate, 1), "yyyy-MM-dd")
        const [prevEvents, dayEvents, nextEvents] = await Promise.all([
          fetchEventsForDate(prevDateStr),
          fetchEventsForDate(selectedDateStr),
          fetchEventsForDate(nextDateStr),
        ])

        // Offset adjacent-day events so they position correctly on the timeline.
        // The timeline uses minutes-since-midnight of the selected date,
        // so previous day events need -1440 offset and next day events need +1440.
        const offsetEvents = (evts: TimelineEvent[], offsetMin: number): TimelineEvent[] =>
          evts.filter((ev) => !ev.allDay).map((ev) => {
            const [sh, sm] = ev.startTime.split(":").map(Number)
            const [eh, em] = ev.endTime.split(":").map(Number)
            const newStart = sh * 60 + sm + offsetMin
            const newEnd = eh * 60 + em + offsetMin
            return {
              ...ev,
              id: `${ev.id}_offset${offsetMin}`,
              startTime: `${String(Math.floor(newStart / 60)).padStart(2, "0")}:${String(newStart % 60).padStart(2, "0")}`,
              endTime: `${String(Math.floor(newEnd / 60)).padStart(2, "0")}:${String(newEnd % 60).padStart(2, "0")}`,
              _offsetMin: offsetMin,
              _originalDate: offsetMin < 0 ? prevDateStr : nextDateStr,
            } as TimelineEvent
          })

        setEvents([
          ...offsetEvents(prevEvents, -1440),
          ...dayEvents,
          ...offsetEvents(nextEvents, 1440),
        ])
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
      const todayMeds = meds.filter((m) => {
        if (m.repeatPattern === "daily") return true
        if (m.repeatPattern === "every_other_day") {
          const start = new Date(m.createdAt)
          start.setHours(0, 0, 0, 0)
          const sel = new Date(selectedDate)
          sel.setHours(0, 0, 0, 0)
          const diffDays = Math.round((sel.getTime() - start.getTime()) / 86400000)
          return diffDays % 2 === 0
        }
        return m.activeDays.includes(dayOfWeek)
      })

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

  // Poll Google Calendar for new/changed events every 60s
  useEffect(() => {
    const interval = setInterval(() => {
      fetchEvents()
    }, 60_000)
    return () => clearInterval(interval)
  }, [fetchEvents])

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
      // Allow values outside 0-1439 since the window can span into adjacent days
      if (snapped < windowStart || snapped > windowEnd) return null
      return snapped
    },
    [windowStart, windowEnd],
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

        // Determine which date this falls on
        const dayOffset = Math.floor(start / 1440)
        const eventDate = dayOffset === 0
          ? selectedDate
          : dayOffset > 0
            ? addDays(selectedDate, dayOffset)
            : subDays(selectedDate, Math.abs(dayOffset))
        const normStart = ((start % 1440) + 1440) % 1440
        const normEnd = ((end % 1440) + 1440) % 1440

        if (end - start >= 15) {
          // Drag: allow anywhere on the timeline
          setPrefillDate(format(eventDate, "yyyy-MM-dd"))
          setPrefillStart(minutesToTimeStr(normStart))
          setPrefillEnd(minutesToTimeStr(normEnd || normStart + (end - start)))
          setDialogOpen(true)
        } else {
          // Single click: only allow in the future (on today), start = now, end = clicked time
          if (isToday(selectedDate) && normStart <= nowMinutes) return
          const clickStart = isToday(selectedDate) ? nowMinutes : normStart
          const clickEnd = normStart > clickStart ? normStart : (clickStart + 60 > 1440 ? 1439 : clickStart + 60)
          setPrefillDate(format(eventDate, "yyyy-MM-dd"))
          setPrefillStart(minutesToTimeStr(clickStart))
          setPrefillEnd(minutesToTimeStr(clickEnd))
          setDialogOpen(true)
        }
      }

      setDragStart(null)
      setDragEnd(null)
    },
    [dragStart, dragEnd, selectedDate, nowMinutes],
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

  // Determine the actual date for a time that may be in an adjacent day
  const dateForMinutes = useCallback(
    (timeStr: string): string => {
      const [h] = timeStr.split(":").map(Number)
      const totalMin = h * 60
      if (totalMin >= 1440) {
        // Next day
        return format(addDays(selectedDate, 1), "yyyy-MM-dd")
      }
      if (totalMin < 0) {
        // Previous day
        return format(subDays(selectedDate, 1), "yyyy-MM-dd")
      }
      return selectedDateStr
    },
    [selectedDate, selectedDateStr],
  )

  // Normalize a time string that might have hours >= 24 back to 0-23 range
  const normalizeTimeStr = (timeStr: string): string => {
    const [h, m] = timeStr.split(":").map(Number)
    const normalized = ((h % 24) + 24) % 24
    return `${String(normalized).padStart(2, "0")}:${String(m).padStart(2, "0")}`
  }

  const handleAddEvent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const title = form.get("title") as string
    const startTime = form.get("startTime") as string
    const endTime = form.get("endTime") as string
    const eventDate = form.get("date") as string
    if (!title || !startTime || !endTime || !eventDate) return

    try {
      await createScheduleEvent({
        cardId: "schedule-1",
        title,
        startTime,
        endTime,
        date: eventDate,
        allDay: false,
        color: EVENT_COLORS[Math.floor(Math.random() * EVENT_COLORS.length)],
      })
      setDialogOpen(false)
      setPrefillStart("")
      setPrefillEnd("")
      setPrefillDate("")
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

  const goToToday = useCallback(() => {
    setSelectedDate(new Date())
  }, [])

  // ── Auto-return to today ──────────────────────────────────────────────────
  const AUTO_RETURN_DELAY = 2 * 60 * 1000 // 2 minutes
  const COUNTDOWN_SECONDS = 10
  const [countdown, setCountdown] = useState<number | null>(null)
  const autoReturnTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null)

  const clearAutoReturn = useCallback(() => {
    if (autoReturnTimer.current) { clearTimeout(autoReturnTimer.current); autoReturnTimer.current = null }
    if (countdownInterval.current) { clearInterval(countdownInterval.current); countdownInterval.current = null }
    setCountdown(null)
  }, [])

  const cancelAutoReturn = useCallback(() => {
    clearAutoReturn()
    // Reset the 2-minute timer
    if (!isToday(selectedDate)) {
      autoReturnTimer.current = setTimeout(() => {
        setCountdown(COUNTDOWN_SECONDS)
      }, AUTO_RETURN_DELAY)
    }
  }, [clearAutoReturn, selectedDate])

  // Start/stop the auto-return timer when navigating away from today
  useEffect(() => {
    clearAutoReturn()
    if (!isToday(selectedDate)) {
      autoReturnTimer.current = setTimeout(() => {
        setCountdown(COUNTDOWN_SECONDS)
      }, AUTO_RETURN_DELAY)
    }
    return clearAutoReturn
  }, [selectedDate, clearAutoReturn])

  // Run the 10s countdown and go to today when it hits 0
  useEffect(() => {
    if (countdown === null) return
    if (countdown <= 0) {
      clearAutoReturn()
      goToToday()
      return
    }
    const tick = setTimeout(() => {
      setCountdown((c) => (c !== null ? c - 1 : null))
    }, 1000)
    return () => clearTimeout(tick)
  }, [countdown, clearAutoReturn, goToToday])

  // Handle wake from sleep / date rollover: snap back to today if the date went stale
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        // If selectedDate is no longer today (date rolled past midnight, or PC slept),
        // immediately go to today
        if (!isToday(selectedDate)) {
          goToToday()
        }
        // Always refresh events on wake
        fetchEvents()
      }
    }
    document.addEventListener("visibilitychange", handleVisibility)
    return () => document.removeEventListener("visibilitychange", handleVisibility)
  }, [selectedDate, goToToday, fetchEvents])

  const goBack = () => {
    if (viewMode === "day") {
      setEvents([]) // Clear instantly so old events don't animate
      setSelectedDate((d) => subDays(d, 1))
    }
    else if (viewMode === "week") setSelectedDate((d) => subWeeks(d, 1))
    else setSelectedDate((d) => subMonths(d, 1))
  }

  const goForward = () => {
    if (viewMode === "day") {
      setEvents([]) // Clear instantly so old events don't animate
      setSelectedDate((d) => addDays(d, 1))
    }
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
      <div className={`flex shrink-0 items-center gap-1 px-3 py-1.5 ${editMode ? "zone-drag-handle" : ""}`}>
        {/* Left: view mode + sun arc */}
        <div ref={titleRef} className="flex shrink-0 items-center gap-1">
          <ZoneDragHandle />
          {compactLevel === 0 && (
            <>
              <div className="ts-inner-glass flex items-center rounded-full p-0.5">
                {(["day", "week", "month"] as ViewMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => handleViewChange(mode)}
                    className={cn(
                      "flex size-10 items-center justify-center rounded-full font-mono text-xs font-bold uppercase tracking-wider transition-all active:scale-95",
                      viewMode === mode
                        ? "bg-[color-mix(in_oklab,currentColor_18%,transparent)]"
                        : "opacity-50 hover:opacity-100",
                    )}
                  >
                    {mode === "day" ? "D" : mode === "week" ? "W" : "M"}
                  </button>
                ))}
              </div>
              {viewMode === "day" && (
                <button
                  onClick={toggleSunArc}
                  className={cn(
                    "ts-inner-glass flex size-11 items-center justify-center rounded-full transition-colors active:scale-95",
                    showSunArc && "ring-1 ring-amber-400/40 text-amber-400",
                  )}
                  title="Toggle daylight arc"
                >
                  <Sun className="size-4" />
                </button>
              )}
            </>
          )}
        </div>

        {/* Center: date navigation - flexes to fill available space */}
        <div ref={centerNavRef} className="flex min-w-0 flex-1 items-center justify-center overflow-hidden">
          <div className="flex items-center gap-1">
            <button
              onClick={goBack}
              className="ts-inner-glass flex size-11 shrink-0 items-center justify-center rounded-full transition-colors active:scale-95"
            >
              <ChevronLeft className="size-4" />
            </button>

            {/* Date label / calendar picker */}
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <button className="ts-inner-glass flex h-11 items-center justify-center gap-1.5 rounded-full px-4 text-xs font-semibold whitespace-nowrap transition-colors">
                  <CalendarDays className="size-3.5 shrink-0 opacity-70" />
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
              className="ts-inner-glass flex size-11 shrink-0 items-center justify-center rounded-full transition-colors active:scale-95"
            >
              <ChevronRight className="size-4" />
            </button>

            {showTodayButton && (
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={goToToday}
                  className="h-11 shrink-0 rounded-lg border border-amber-400/25 bg-amber-400/10 px-3 font-mono text-xs font-bold uppercase tracking-wider whitespace-nowrap text-amber-400/80 transition-colors hover:border-amber-400/40 hover:bg-amber-400/20 hover:text-amber-400 active:scale-95"
                >
                  {countdown !== null ? `Today (${countdown}s)` : "Today"}
                </button>
                {countdown !== null && (
                  <button
                    onClick={cancelAutoReturn}
                    className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-amber-400/25 bg-amber-400/10 text-amber-400/80 transition-colors hover:border-amber-400/40 hover:bg-amber-400/20 hover:text-amber-400 active:scale-95"
                    title="Cancel auto-return"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: view mode switcher + actions (progressively collapsed) */}
        <div ref={rightActionsRef} className="flex shrink-0 items-center gap-1">
          {/* Level 0 (wide): D/W/M + Sun arc moved to left section; only cog + add here */}
          {compactLevel === 0 && (
            <>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className="ts-inner-glass flex size-11 items-center justify-center rounded-full transition-colors active:scale-95"
                    title="Connect calendars"
                  >
                    <CalendarCog className="size-4" />
                  </button>
                </PopoverTrigger>
                <PopoverContent side="bottom" align="end" className="w-64">
                  <CalendarAccountsContent
                    isSignedIn={!!isSignedIn}
                    calendarAccounts={calendarAccounts}
                    googleClientId={googleClientId}
                    addGoogleAccount={addGoogleAccount}
                    removeCalendarAccount={removeCalendarAccount}
                  />
                </PopoverContent>
              </Popover>
              <button
                onClick={() => handleDialogChange(true)}
                className="ts-inner-glass flex size-11 items-center justify-center rounded-full transition-colors active:scale-95"
                title="Add event"
              >
                <Plus className="size-4" />
              </button>
            </>
          )}

          {/* Level 1 (medium): sun arc + D/W/M merged into one dropdown */}
          {compactLevel === 1 && (
            <>
              <ViewModeDropdown
                viewMode={viewMode}
                onViewChange={handleViewChange}
                showSunArc={showSunArc}
                onToggleSunArc={toggleSunArc}
              />
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className="ts-inner-glass flex size-11 items-center justify-center rounded-full transition-colors active:scale-95"
                    title="Connect calendars"
                  >
                    <CalendarCog className="size-4" />
                  </button>
                </PopoverTrigger>
                <PopoverContent side="bottom" align="end" className="w-64">
                  <CalendarAccountsContent
                    isSignedIn={!!isSignedIn}
                    calendarAccounts={calendarAccounts}
                    googleClientId={googleClientId}
                    addGoogleAccount={addGoogleAccount}
                    removeCalendarAccount={removeCalendarAccount}
                  />
                </PopoverContent>
              </Popover>
              <button
                onClick={() => handleDialogChange(true)}
                className="ts-inner-glass flex size-11 items-center justify-center rounded-full transition-colors active:scale-95"
                title="Add event"
              >
                <Plus className="size-4" />
              </button>
            </>
          )}

          {/* Level 2 (narrow): D/W/M dropdown + overflow menu for calendar & add */}
          {compactLevel === 2 && (
            <>
              <ViewModeDropdown
                viewMode={viewMode}
                onViewChange={handleViewChange}
                showSunArc={showSunArc}
                onToggleSunArc={toggleSunArc}
              />
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className="ts-inner-glass flex size-11 items-center justify-center rounded-full transition-colors active:scale-95"
                    title="More actions"
                  >
                    <MoreHorizontal className="size-4" />
                  </button>
                </PopoverTrigger>
                <PopoverContent side="bottom" align="end" className="w-56 p-1">
                  <button
                    onClick={() => handleDialogChange(true)}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
                  >
                    <Plus className="size-3.5" />
                    Add Event
                  </button>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground">
                        <CalendarCog className="size-3.5" />
                        Connected Calendars
                      </button>
                    </PopoverTrigger>
                    <PopoverContent side="left" align="start" className="w-64">
                      <CalendarAccountsContent
                        isSignedIn={!!isSignedIn}
                        calendarAccounts={calendarAccounts}
                        googleClientId={googleClientId}
                        addGoogleAccount={addGoogleAccount}
                        removeCalendarAccount={removeCalendarAccount}
                      />
                    </PopoverContent>
                  </Popover>
                </PopoverContent>
              </Popover>
            </>
          )}

          {/* Level 3 (smallest): single overflow menu with everything */}
          {compactLevel >= 3 && (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className="ts-inner-glass flex size-11 items-center justify-center rounded-full transition-colors active:scale-95"
                  title="Schedule options"
                >
                  <MoreHorizontal className="size-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent side="bottom" align="end" className="w-56 p-1">
                <p className="px-2 py-1 font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground/40">
                  View
                </p>
                {(["day", "week", "month"] as ViewMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => handleViewChange(mode)}
                    className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition-colors ${
                      viewMode === mode
                        ? "bg-[var(--zone-timeline-accent)]/15 text-[var(--zone-timeline-accent)]"
                        : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                    }`}
                  >
                    <span className="font-mono font-bold uppercase tracking-wider">
                      {mode === "day" ? "D" : mode === "week" ? "W" : "M"}
                    </span>
                    {mode === "day" ? "Day" : mode === "week" ? "Week" : "Month"}
                  </button>
                ))}
                {viewMode === "day" && (
                  <>
                    <div className="my-1 h-px bg-border/20" />
                    <button
                      onClick={toggleSunArc}
                      className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition-colors ${
                        showSunArc
                          ? "text-amber-400"
                          : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                      }`}
                    >
                      <Sun className="size-3.5" />
                      Daylight Arc
                      {showSunArc && <span className="ml-auto text-amber-400">On</span>}
                    </button>
                  </>
                )}
                <div className="my-1 h-px bg-border/20" />
                <button
                  onClick={() => handleDialogChange(true)}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
                >
                  <Plus className="size-3.5" />
                  Add Event
                </button>
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground">
                      <CalendarCog className="size-3.5" />
                      Connected Calendars
                    </button>
                  </PopoverTrigger>
                  <PopoverContent side="left" align="start" className="w-64">
                    <CalendarAccountsContent
                      isSignedIn={!!isSignedIn}
                      calendarAccounts={calendarAccounts}
                      googleClientId={googleClientId}
                      addGoogleAccount={addGoogleAccount}
                      removeCalendarAccount={removeCalendarAccount}
                    />
                  </PopoverContent>
                </Popover>
              </PopoverContent>
            </Popover>
          )}

          {/* Add Event dialog -- single instance, controlled by dialogOpen state */}
          <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
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
                <div className="grid gap-2">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    name="date"
                    type="date"
                    required
                    defaultValue={prefillDate || selectedDateStr}
                    key={`date-${prefillDate || selectedDateStr}`}
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
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
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
                      className="rounded-full border border-border/20 bg-card/80 px-2 py-0.5 text-[0.5rem] font-medium text-foreground/80"
                      style={{ borderColor: evColor }}
                    >
                      {ev.title}
                    </span>
                  )
                })}
            </div>
          )}
          <div
            className="relative min-h-0 flex-1 overflow-y-auto"
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
              {/* Daylight indicator -- subtle background tint for daytime hours */}
              {mounted && showSunArc && (() => {
                const sunrisePct = minutesToPercent(SUNRISE_MIN, windowStart)
                const sunsetPct = minutesToPercent(SUNSET_MIN, windowStart)
                if (sunrisePct > 100 || sunsetPct < 0) return null
                return (
                  <div
                    className="pointer-events-none absolute left-0 w-full"
                    style={{
                      top: `${Math.max(0, sunrisePct)}%`,
                      height: `${Math.min(100, sunsetPct) - Math.max(0, sunrisePct)}%`,
                      background: "linear-gradient(to bottom, oklch(0.85 0.08 85 / 0.04), oklch(0.85 0.08 85 / 0.08) 50%, oklch(0.85 0.08 85 / 0.04))",
                    }}
                  />
                )
              })()}

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
                          className="absolute left-12 right-2 cursor-pointer overflow-hidden rounded-lg border border-border/20 bg-card/80 px-3 py-1.5 text-left text-xs font-medium leading-tight shadow-sm backdrop-blur-sm transition-all hover:bg-card"
                          style={{
                            top: `${topPct}%`,
                            height: `${heightPct}%`,
                            borderColor: evColor,
                          }}
                        >
                          <span className="line-clamp-2 text-foreground/80">{ev.title}</span>
                          {ev.location && (
                            <span className="mt-0.5 flex items-center gap-1 text-[0.5rem] text-muted-foreground/40">
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
          {/* Event list at bottom */}
          <EventListPanel
            events={events}
            direction="vertical"
            onSelectEvent={setSelectedEvent}
          />
        </div>
      )}

      {viewMode === "day" && !isVertical && (
        /* ── Horizontal day view ────────────────────────────────────── */
        <div className="relative flex min-h-0 flex-1">
        {/* Sun/moon arcs — spans full width including event list */}
        {mounted && showSunArc && (
          <svg
            className="pointer-events-none absolute inset-0 z-0"
            width="100%"
            height="100%"
            preserveAspectRatio="none"
            viewBox="0 0 1000 100"
            overflow="visible"
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
        <div
          ref={timelineRef}
          className="relative min-h-0 min-w-0 flex-1 cursor-crosshair select-none overflow-hidden"
          onPointerMove={handlePointerMove}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerLeave}
        >

          {/* Hour markers — adaptively skip hours when the zone is narrow */}
          {(() => {
            const firstHour = Math.ceil(windowStart / 60)
            const lastHour = Math.floor(windowEnd / 60)
            const totalHours = lastHour - firstHour + 1

            // Determine step: each label needs ~35px to not overlap
            const containerW = timelineRef.current?.clientWidth ?? 800
            const pxPerHour = containerW / totalHours
            const step = pxPerHour >= 35 ? 1 : pxPerHour >= 18 ? 2 : pxPerHour >= 12 ? 3 : pxPerHour >= 8 ? 4 : 6

            const markers = []
            for (let hour = firstHour; hour <= lastHour; hour++) {
              const mins = hour * 60
              const pct = minutesToPercent(mins, windowStart)
              const displayHour = ((hour % 24) + 24) % 24
              const showLabel = (hour - firstHour) % step === 0
              markers.push(
                <div
                  key={hour}
                  className="absolute top-0 h-full"
                  style={{ left: `${pct}%` }}
                >
                  {showLabel && (
                    <span className="absolute top-0 -translate-x-1/2 font-mono text-xs leading-none text-muted-foreground/40">
                      {displayHour === 0
                        ? "12a"
                        : displayHour < 12
                          ? `${displayHour}a`
                          : displayHour === 12
                            ? "12p"
                            : `${displayHour - 12}p`}
                    </span>
                  )}
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

          {/* Calendar events + medicine doses (unified lane layout) */}
          {(() => {
            const timedEvents = events.filter((ev) => !ev.allDay)

            // Convert medicine doses to pseudo-events for lane computation.
            // Use 45-min collision duration so edge-adjacent items (medicine ends
            // exactly when an event starts) are detected as overlapping — the 2%
            // minimum render width makes them visually collide anyway.
            const medPseudoEvents = medDoses.map((dose, idx) => {
              const startH = String(dose.hour).padStart(2, "0")
              const startM = String(dose.minute).padStart(2, "0")
              const endMinutes = dose.hour * 60 + dose.minute + 45
              const endH = String(Math.floor(endMinutes / 60) % 24).padStart(2, "0")
              const endM = String(endMinutes % 60).padStart(2, "0")
              return {
                id: `med-${idx}`,
                startTime: `${startH}:${startM}`,
                endTime: `${endH}:${endM}`,
                _med: dose,
              }
            })

            const allForLanes = [
              ...timedEvents.map((ev) => ({ id: ev.id, startTime: ev.startTime, endTime: ev.endTime })),
              ...medPseudoEvents,
            ]
            const lanes = computeEventLanes(allForLanes)
            const eventAreaTop = 28
            const eventAreaBottom = 16

            return (
              <>
                {timedEvents.map((ev) => {
                  const leftPct = timeToPercent(ev.startTime, windowStart)
                  const rightPct = timeToPercent(ev.endTime, windowStart)
                  const widthPct = Math.max(rightPct - leftPct, 2)

                  const evColor = ev.color ?? eventColor(ev.id)
                  const assignment = lanes.get(ev.id) ?? { lane: 0, totalLanes: 1 }
                  const laneHeightPct = 100 / assignment.totalLanes
                  const topPct = assignment.lane * laneHeightPct

                  return (
                    <button
                      key={ev.id}
                      data-event
                      onClick={() => setSelectedEvent(ev)}
                      className="absolute flex cursor-pointer items-center gap-1 overflow-hidden rounded-md border border-border/20 bg-card/80 px-2 py-0.5 text-left text-xs font-medium leading-tight shadow-sm backdrop-blur-sm transition-all hover:bg-card"
                      style={{
                        left: `${leftPct}%`,
                        width: `${widthPct}%`,
                        top: `calc(${eventAreaTop}px + (100% - ${eventAreaTop + eventAreaBottom}px) * ${topPct / 100})`,
                        height: `calc((100% - ${eventAreaTop + eventAreaBottom}px) * ${laneHeightPct / 100} - 2px)`,
                        borderColor: evColor,
                      }}
                    >
                      <span className="truncate text-foreground/80">{ev.title}</span>
                      {ev.location && (
                        <MapPin className="size-2 shrink-0 text-muted-foreground/40" />
                      )}
                    </button>
                  )
                })}

                {medPseudoEvents.map((pseudo) => {
                  const dose = pseudo._med
                  const leftPct = timeToPercent(pseudo.startTime, windowStart)
                  // Render at 30-min visual width (endTime is inflated to 45min for collision only)
                  const visualEndMin = dose.hour * 60 + dose.minute + 30
                  const visualEndTime = `${String(Math.floor(visualEndMin / 60) % 24).padStart(2, "0")}:${String(visualEndMin % 60).padStart(2, "0")}`
                  const rightPct = timeToPercent(visualEndTime, windowStart)
                  const widthPct = Math.max(rightPct - leftPct, 2)
                  const assignment = lanes.get(pseudo.id) ?? { lane: 0, totalLanes: 1 }
                  const laneHeightPct = 100 / assignment.totalLanes
                  const topPct = assignment.lane * laneHeightPct

                  return (
                    <div
                      key={pseudo.id}
                      className={`absolute flex items-center justify-center overflow-hidden rounded-full border ${
                        dose.taken
                          ? "border-[var(--vital-meds)]/30 bg-[var(--vital-meds)]/10 text-[var(--vital-meds)] opacity-50"
                          : "border-[var(--vital-meds)]/40 bg-[var(--vital-meds)]/15 text-[var(--vital-meds)]"
                      }`}
                      style={{
                        left: `${leftPct}%`,
                        width: `${widthPct}%`,
                        top: `calc(${eventAreaTop}px + (100% - ${eventAreaTop + eventAreaBottom}px) * ${topPct / 100})`,
                        height: `calc((100% - ${eventAreaTop + eventAreaBottom}px) * ${laneHeightPct / 100} - 2px)`,
                      }}
                      title={`${dose.medName}${dose.dosage ? ` (${dose.dosage})` : ""} at ${pseudo.startTime}`}
                    >
                      <Pill className="size-3.5" />
                    </div>
                  )
                })}
              </>
            )
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
                      className="cursor-pointer rounded-full border border-border/20 bg-card/80 px-1.5 py-0.5 text-xs font-medium text-foreground/80 backdrop-blur-sm transition-all hover:bg-card"
                      style={{
                        borderLeftWidth: "3px",
                        borderLeftColor: evColor,
                      }}
                    >
                      {ev.title}
                    </button>
                  )
                })}
            </div>
          )}

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
        {/* Event list sidebar */}
        <div className="w-48 shrink-0 overflow-hidden border-l border-border/10">
          <EventListPanel
            events={events}
            direction="horizontal"
            onSelectEvent={setSelectedEvent}
          />
        </div>
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
          onRefresh={() => { fetchEvents(); setSelectedEvent(null) }}
          date={selectedDate}
        />
      )}
    </div>
  )
}
