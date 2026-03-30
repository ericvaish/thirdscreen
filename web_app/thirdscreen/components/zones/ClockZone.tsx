"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useDashboard } from "@/components/dashboard/DashboardContext"
import { ZoneDragHandle } from "@/components/dashboard/ZoneDragHandle"
import { Settings, CalendarDays, Thermometer } from "lucide-react"
import { listScheduleEvents } from "@/lib/data-layer"
import type { ScheduleEvent } from "@/lib/types"
import { GRID_COLS, GRID_ROWS } from "@/lib/grid-layout"
import { format } from "date-fns"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Separator } from "@/components/ui/separator"

// ── Settings types ─────────────────────────────────────────────────────────

type ClockStyle = "digital" | "analog"
type ClockFormat = "12h" | "24h"
type ClockFit = "fill" | "center"

interface ClockSettings {
  style: ClockStyle
  format: ClockFormat
  fit: ClockFit
  showSeconds: boolean
  showDate: boolean
  showNextEvent: boolean
  showWeather: boolean
  padding: number // 0-30 percent
  dateSizeRatio: number // 0.1-0.4
}

const DEFAULT_SETTINGS: ClockSettings = {
  style: "digital",
  format: "12h",
  fit: "fill",
  showSeconds: true,
  showDate: true,
  showNextEvent: true,
  showWeather: true,
  padding: 0,
  dateSizeRatio: 0.18,
}

function loadSettings(): ClockSettings {
  try {
    const raw = localStorage.getItem("ts_clock_settings")
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {}
  return DEFAULT_SETTINGS
}

function saveSettings(s: ClockSettings) {
  localStorage.setItem("ts_clock_settings", JSON.stringify(s))
}

// ── Weather ────────────────────────────────────────────────────────────────

async function fetchTemp(): Promise<{ temp: number } | null> {
  try {
    const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
    ).catch(async () => {
      const res = await fetch("https://ipapi.co/json/")
      if (!res.ok) return null
      const d: { latitude: number; longitude: number } = await res.json()
      return { coords: { latitude: d.latitude, longitude: d.longitude } } as GeolocationPosition
    })
    if (!pos) return null
    const { latitude, longitude } = pos.coords
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m&temperature_unit=celsius`
    )
    if (!res.ok) return null
    const data: { current: { temperature_2m: number } } = await res.json()
    return { temp: Math.round(data.current.temperature_2m) }
  } catch {
    return null
  }
}

// ── Next event ─────────────────────────────────────────────────────────────

function getNextEvent(events: ScheduleEvent[], nowMinutes: number): { title: string; minutesUntil: number } | null {
  let best: { title: string; minutesUntil: number } | null = null
  for (const ev of events) {
    if (ev.allDay) continue
    const [h, m] = ev.startTime.split(":").map(Number)
    const evMin = h * 60 + m
    const diff = evMin - nowMinutes
    if (diff > 0 && (!best || diff < best.minutesUntil)) {
      best = { title: ev.title, minutesUntil: diff }
    }
  }
  return best
}

function formatCountdown(minutes: number): string {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return m > 0 ? `${h}h ${m}m` : `${h}h`
  }
  return `${minutes}m`
}

// ── Analog clock face ──────────────────────────────────────────────────────

function AnalogClock({ size, hours, minutes, seconds, showSeconds, accentColor }: {
  size: number
  hours: number
  minutes: number
  seconds: number
  showSeconds: boolean
  accentColor: string
}) {
  const cx = size / 2
  const cy = size / 2
  const r = size * 0.44

  const hourAngle = ((hours % 12) + minutes / 60) * 30 - 90
  const minuteAngle = (minutes + seconds / 60) * 6 - 90
  const secondAngle = seconds * 6 - 90

  const hand = (angle: number, length: number, width: number, color: string) => {
    const rad = (angle * Math.PI) / 180
    const x2 = cx + Math.cos(rad) * length
    const y2 = cy + Math.sin(rad) * length
    return (
      <line
        x1={cx} y1={cy} x2={x2} y2={y2}
        stroke={color} strokeWidth={width} strokeLinecap="round"
      />
    )
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Dial markers */}
      {Array.from({ length: 12 }, (_, i) => {
        const angle = (i * 30 - 90) * (Math.PI / 180)
        const isMajor = i % 3 === 0
        const outerR = r * 0.95
        const innerR = isMajor ? r * 0.78 : r * 0.85
        return (
          <line
            key={i}
            x1={cx + Math.cos(angle) * innerR}
            y1={cy + Math.sin(angle) * innerR}
            x2={cx + Math.cos(angle) * outerR}
            y2={cy + Math.sin(angle) * outerR}
            stroke="currentColor"
            strokeWidth={isMajor ? size * 0.02 : size * 0.008}
            strokeLinecap="round"
            className="text-foreground/30"
          />
        )
      })}
      {/* Hour hand */}
      {hand(hourAngle, r * 0.55, size * 0.035, "currentColor")}
      {/* Minute hand */}
      {hand(minuteAngle, r * 0.78, size * 0.02, "currentColor")}
      {/* Second hand */}
      {showSeconds && hand(secondAngle, r * 0.85, size * 0.008, accentColor)}
      {/* Center dot */}
      <circle cx={cx} cy={cy} r={size * 0.025} fill={accentColor} />
    </svg>
  )
}

// ── Clock display (shared between zone and preview) ────────────────────────

function ClockDisplay({
  time,
  settings,
  containerWidth,
  containerHeight,
  nextEvent,
  weather,
}: {
  time: Date
  settings: ClockSettings
  containerWidth: number
  containerHeight: number
  nextEvent: { title: string; minutesUntil: number } | null
  weather: { temp: number } | null
}) {
  const hours = time.getHours()
  const minutes = time.getMinutes()
  const seconds = time.getSeconds()

  const paddingFactor = 1 - settings.padding / 100
  const effectiveW = containerWidth * paddingFactor
  const effectiveH = containerHeight * paddingFactor

  if (settings.style === "analog") {
    const clockSize = Math.max(40, Math.min(effectiveW, effectiveH) * 0.85)
    const secondarySize = Math.max(12, clockSize * 0.09)

    return (
      <div className="flex flex-col items-center justify-center gap-2">
        <AnalogClock
          size={clockSize}
          hours={hours}
          minutes={minutes}
          seconds={seconds}
          showSeconds={settings.showSeconds}
          accentColor="var(--zone-clock-accent)"
        />
        {settings.showDate && (
          <p className="font-mono tracking-wide text-muted-foreground/50" style={{ fontSize: secondarySize }}>
            {time.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
          </p>
        )}
        <SecondaryInfo
          nextEvent={settings.showNextEvent ? nextEvent : null}
          weather={settings.showWeather ? weather : null}
          size={secondarySize}
        />
      </div>
    )
  }

  // Digital
  // Count how many secondary lines are shown to budget vertical space
  const secondaryLines = (settings.showDate ? 1 : 0) + (settings.showNextEvent || settings.showWeather ? 1 : 0)
  const isFill = settings.fit === "fill"
  // Space Grotesk "1:00" measures ~3.2 char-widths. "12:00" ~4.0.
  // The AM/PM + seconds sidebar adds ~1.2 char-widths. Total ~4.5-5.2.
  // In fill mode we use the tight estimate so digits nearly touch edges.
  const hasAmPm = settings.format === "12h"
  const hasSidebar = hasAmPm || settings.showSeconds
  // Space Grotesk digit width is ~0.6em. "2:28" = 4 chars * 0.6 + colon 0.3 = 2.7em.
  // AM/PM sidebar is rendered at 0.22em font size, so ~0.5em wide.
  // Total: ~3.2em for time + sidebar. Use this to compute max font size from width.
  const timeEm = 2.7 + (hasSidebar ? 0.6 : 0)
  const sizeFromWidth = effectiveW / (isFill ? timeEm : timeEm * 1.3)
  // lineHeight is ~1.0 for the time, so the font size IS the height of the digits.
  // Budget: almost all vertical space for time, minus secondary lines.
  const verticalBudget = isFill ? 0.92 - secondaryLines * 0.15 : 0.60 - secondaryLines * 0.10
  const sizeFromHeight = effectiveH * Math.max(0.4, verticalBudget)
  const fontSize = Math.max(24, Math.min(sizeFromWidth, sizeFromHeight))
  const secondarySize = Math.max(12, fontSize * settings.dateSizeRatio)
  const ampmSize = Math.max(14, fontSize * 0.22)
  const secondsSize = Math.max(12, fontSize * 0.2)

  const ampm = hours >= 12 ? "PM" : "AM"
  const displayTime = settings.format === "12h"
    ? `${hours % 12 || 12}:${String(minutes).padStart(2, "0")}`
    : `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="flex items-baseline gap-[0.08em]" style={{ fontSize }}>
        <span
          className="font-[family-name:var(--font-display)] font-bold tabular-nums tracking-tight text-foreground"
          style={{ lineHeight: 1 }}
        >
          {displayTime}
        </span>
        <div className="flex flex-col items-start" style={{ gap: secondsSize * 0.15 }}>
          {settings.format === "12h" && (
            <span
              className="font-mono font-semibold tabular-nums text-[var(--zone-clock-accent)]"
              style={{ fontSize: ampmSize, lineHeight: 1 }}
            >
              {ampm}
            </span>
          )}
          {settings.showSeconds && (
            <span
              className="font-mono tabular-nums text-muted-foreground/40"
              style={{ fontSize: secondsSize, lineHeight: 1 }}
            >
              {String(seconds).padStart(2, "0")}
            </span>
          )}
        </div>
      </div>

      {settings.showDate && (
        <p
          className="mt-[0.3em] font-mono tracking-wide text-muted-foreground/50"
          style={{ fontSize: secondarySize }}
        >
          {time.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
        </p>
      )}

      <SecondaryInfo
        nextEvent={settings.showNextEvent ? nextEvent : null}
        weather={settings.showWeather ? weather : null}
        size={secondarySize}
      />
    </div>
  )
}

function SecondaryInfo({ nextEvent, weather, size }: {
  nextEvent: { title: string; minutesUntil: number } | null
  weather: { temp: number } | null
  size: number
}) {
  if (!nextEvent && !weather) return null
  return (
    <div className="mt-[0.5em] flex items-center gap-[1.5em] text-muted-foreground/40" style={{ fontSize: size }}>
      {nextEvent && (
        <div className="flex items-center gap-[0.4em]">
          <CalendarDays style={{ width: size, height: size }} className="shrink-0 text-[var(--zone-clock-accent)]/60" />
          <span className="font-mono">
            <span className="text-foreground/60">{nextEvent.title}</span>
            {" in "}
            <span className="font-semibold text-[var(--zone-clock-accent)]/80">
              {formatCountdown(nextEvent.minutesUntil)}
            </span>
          </span>
        </div>
      )}
      {weather && (
        <div className="flex items-center gap-[0.3em]">
          <Thermometer style={{ width: size, height: size }} className="shrink-0" />
          <span className="font-mono font-semibold text-foreground/50">{weather.temp}°C</span>
        </div>
      )}
    </div>
  )
}

// ── Settings dialog ────────────────────────────────────────────────────────

function ClockSettingsDialog({
  settings,
  onChange,
  time,
  nextEvent,
  weather,
  zoneW,
  zoneH,
  onZoneResize,
}: {
  settings: ClockSettings
  onChange: (s: ClockSettings) => void
  time: Date
  nextEvent: { title: string; minutesUntil: number } | null
  weather: { temp: number } | null
  zoneW: number
  zoneH: number
  onZoneResize: (w: number, h: number) => void
}) {
  const update = useCallback(
    (patch: Partial<ClockSettings>) => {
      const next = { ...settings, ...patch }
      onChange(next)
    },
    [settings, onChange],
  )

  const OptionButton = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button
      onClick={onClick}
      className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition-all active:scale-[0.98] ${
        active
          ? "border-[var(--zone-clock-accent)]/40 bg-[var(--zone-clock-accent)]/10 text-[var(--zone-clock-accent)]"
          : "border-border/20 bg-muted/10 text-muted-foreground hover:border-border/30 hover:bg-muted/15"
      }`}
    >
      {children}
    </button>
  )

  // Compute preview dimensions that match the zone's actual aspect ratio
  const previewMaxW = 500
  const previewMaxH = 400
  const zoneAspect = zoneW / Math.max(zoneH, 1)
  let previewW: number
  let previewH: number
  if (zoneAspect > previewMaxW / previewMaxH) {
    previewW = previewMaxW
    previewH = previewMaxW / zoneAspect
  } else {
    previewH = previewMaxH
    previewW = previewMaxH * zoneAspect
  }

  return (
    <DialogContent className="p-0 overflow-hidden" style={{ maxWidth: "min(900px, 90vw)", width: "min(900px, 90vw)" }}>
      <div className="flex min-h-[450px]">
        {/* Preview — aspect ratio matches actual zone grid size */}
        <div className="flex min-w-0 flex-1 items-center justify-center border-r border-border/10 bg-background p-6">
          <div
            className="zone-surface zone-clock flex items-center justify-center overflow-hidden rounded-lg transition-all duration-300"
            style={{ width: previewW, height: previewH }}
          >
            <ClockDisplay
              time={time}
              settings={settings}
              containerWidth={previewW}
              containerHeight={previewH}
              nextEvent={nextEvent}
              weather={weather}
            />
          </div>
        </div>

        {/* Settings */}
        <div style={{ width: 320, minWidth: 320 }} className="shrink-0 overflow-y-auto p-5">
          <DialogHeader className="p-0 pb-3">
            <DialogTitle className="font-[family-name:var(--font-display)] text-sm font-bold tracking-tight">
              Clock Settings
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            {/* Style */}
            <section>
              <SectionLabel>Style</SectionLabel>
              <div className="mt-1.5 flex gap-1.5">
                <OptionButton active={settings.style === "digital"} onClick={() => update({ style: "digital" })}>
                  Digital
                </OptionButton>
                <OptionButton active={settings.style === "analog"} onClick={() => update({ style: "analog" })}>
                  Analog
                </OptionButton>
              </div>
            </section>

            {/* Format (digital only) */}
            {settings.style === "digital" && (
              <section>
                <SectionLabel>Format</SectionLabel>
                <div className="mt-1.5 flex gap-1.5">
                  <OptionButton active={settings.format === "12h"} onClick={() => update({ format: "12h" })}>
                    12h
                  </OptionButton>
                  <OptionButton active={settings.format === "24h"} onClick={() => update({ format: "24h" })}>
                    24h
                  </OptionButton>
                </div>
              </section>
            )}

            {/* Layout */}
            <section>
              <SectionLabel>Layout</SectionLabel>
              <div className="mt-1.5 flex gap-1.5">
                <OptionButton active={settings.fit === "fill"} onClick={() => update({ fit: "fill" })}>
                  Fill
                </OptionButton>
                <OptionButton active={settings.fit === "center"} onClick={() => update({ fit: "center" })}>
                  Center
                </OptionButton>
              </div>
            </section>

            {/* Padding */}
            <section>
              <div className="flex items-center justify-between">
                <SectionLabel>Padding</SectionLabel>
                <span className="font-mono text-xs text-muted-foreground/40">{settings.padding}%</span>
              </div>
              <Slider
                min={0}
                max={30}
                step={1}
                value={[settings.padding]}
                onValueChange={([v]) => update({ padding: v })}
                className="mt-1.5"
              />
            </section>

            {/* Date size ratio (digital only) */}
            {settings.style === "digital" && (
              <section>
                <div className="flex items-center justify-between">
                  <SectionLabel>Date Size</SectionLabel>
                  <span className="font-mono text-xs text-muted-foreground/40">{Math.round(settings.dateSizeRatio * 100)}%</span>
                </div>
                <Slider
                  min={10}
                  max={40}
                  step={1}
                  value={[Math.round(settings.dateSizeRatio * 100)]}
                  onValueChange={([v]) => update({ dateSizeRatio: v / 100 })}
                  className="mt-1.5"
                />
              </section>
            )}

            <Separator className="bg-border/15" />

            {/* Toggles */}
            <section className="space-y-3">
              <SectionLabel>Show</SectionLabel>
              <ToggleRow label="Seconds" checked={settings.showSeconds} onChange={(v) => update({ showSeconds: v })} />
              <ToggleRow label="Date" checked={settings.showDate} onChange={(v) => update({ showDate: v })} />
              <ToggleRow label="Next event" checked={settings.showNextEvent} onChange={(v) => update({ showNextEvent: v })} />
              <ToggleRow label="Weather" checked={settings.showWeather} onChange={(v) => update({ showWeather: v })} />
            </section>

            <Separator className="bg-border/15" />

            {/* Zone size */}
            <section>
              <SectionLabel>Zone Size</SectionLabel>
              <div className="mt-2 space-y-3">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-foreground/70">Width</span>
                    <span className="font-mono text-xs text-muted-foreground/40">{zoneW} / {GRID_COLS}</span>
                  </div>
                  <Slider
                    min={2}
                    max={GRID_COLS}
                    step={1}
                    value={[zoneW]}
                    onValueChange={([v]) => onZoneResize(v, zoneH)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-foreground/70">Height</span>
                    <span className="font-mono text-xs text-muted-foreground/40">{zoneH} / {GRID_ROWS}</span>
                  </div>
                  <Slider
                    min={2}
                    max={GRID_ROWS}
                    step={1}
                    value={[zoneH]}
                    onValueChange={([v]) => onZoneResize(zoneW, v)}
                    className="mt-1"
                  />
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </DialogContent>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Label className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground/50">
      {children}
    </Label>
  )
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-foreground/70">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

// ── ClockZone ──────────────────────────────────────────────────────────────

export function ClockZone() {
  const { editMode, layout, onLayoutChange } = useDashboard()
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ w: 400, h: 300 })
  const [time, setTime] = useState<Date | null>(null)
  const [weather, setWeather] = useState<{ temp: number } | null>(null)
  const [nextEvent, setNextEvent] = useState<{ title: string; minutesUntil: number } | null>(null)
  const [settings, setSettings] = useState<ClockSettings>(DEFAULT_SETTINGS)

  // Load settings on mount
  useEffect(() => {
    setSettings(loadSettings())
  }, [])

  const handleSettingsChange = useCallback((s: ClockSettings) => {
    setSettings(s)
    saveSettings(s)
  }, [])

  // Update time every second
  useEffect(() => {
    setTime(new Date())
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // Track content area size (excludes header)
  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setContainerSize({ w: width, h: height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Fetch weather
  useEffect(() => {
    fetchTemp().then((w) => { if (w) setWeather(w) })
    const id = setInterval(() => {
      fetchTemp().then((w) => { if (w) setWeather(w) })
    }, 10 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  // Fetch next event every minute
  useEffect(() => {
    const fetchNext = async () => {
      const now = new Date()
      const todayStr = format(now, "yyyy-MM-dd")
      const nowMin = now.getHours() * 60 + now.getMinutes()
      try {
        const events = (await listScheduleEvents(todayStr)) as ScheduleEvent[]
        setNextEvent(getNextEvent(events, nowMin))
      } catch {
        setNextEvent(null)
      }
    }
    fetchNext()
    const id = setInterval(fetchNext, 60_000)
    return () => clearInterval(id)
  }, [])

  if (!time) return null

  return (
    <div
      ref={containerRef}
      className="zone-surface zone-clock flex h-full flex-col"
    >
      {/* Header: title on left, settings on right */}
      <div className={`flex shrink-0 items-center justify-between px-4 py-1.5 ${editMode ? "zone-drag-handle" : ""}`}>
        <div className="flex items-center gap-1.5">
          <ZoneDragHandle />
          <div
            className="h-5 w-[3px] rounded-full"
            style={{ background: "var(--zone-clock-accent)" }}
          />
          <span
            className="font-[family-name:var(--font-display)] text-sm font-bold tracking-tight"
            style={{ color: "var(--zone-clock-accent)" }}
          >
            Clock
          </span>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <button
              className="flex size-11 items-center justify-center rounded-lg text-muted-foreground/50 transition-colors hover:bg-muted/20 hover:text-muted-foreground/80"
              title="Clock settings"
            >
              <Settings className="size-4" />
            </button>
          </DialogTrigger>
          <ClockSettingsDialog
            settings={settings}
            onChange={handleSettingsChange}
            time={time}
            nextEvent={nextEvent}
            weather={weather}
            zoneW={layout?.clock?.w ?? 4}
            zoneH={layout?.clock?.h ?? 5}
            onZoneResize={(w, h) => {
              if (layout && onLayoutChange) {
                onLayoutChange({
                  ...layout,
                  clock: { ...layout.clock, w, h },
                })
              }
            }}
          />
        </Dialog>
      </div>

      <div ref={contentRef} className="flex min-h-0 flex-1 items-center justify-center">
        <ClockDisplay
          time={time}
          settings={settings}
          containerWidth={containerSize.w}
          containerHeight={containerSize.h}
          nextEvent={nextEvent}
          weather={weather}
        />
      </div>
    </div>
  )
}
