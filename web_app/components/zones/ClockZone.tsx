"use client"

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useDashboard } from "@/components/dashboard/DashboardContext"
import { useRegisterZoneActions, type ZoneAction } from "@/lib/zone-actions"
import {
  WIDGET_SIZES,
  WIDGET_SIZE_LABELS,
  ZONE_ALLOWED_SIZES,
  setZoneSize,
  type WidgetSize,
} from "@/lib/grid-layout"
import { ZoneDragHandle } from "@/components/dashboard/ZoneDragHandle"
import { ZoneLabel } from "@/components/dashboard/ZoneLabel"
import { Settings, CalendarDays, Clock, Thermometer } from "lucide-react"
import { listScheduleEvents } from "@/lib/data-layer"
import type { ScheduleEvent } from "@/lib/types"
import { format } from "date-fns"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { useWeather } from "@/lib/weather"

// ── Settings types ─────────────────────────────────────────────────────────

type ClockStyle = "digital" | "analog"
type ClockFormat = "12h" | "24h"
interface ClockSettings {
  style: ClockStyle
  format: ClockFormat
  showSeconds: boolean
  showDate: boolean
  showNextEvent: boolean
  showWeather: boolean
  showCalendar: boolean
}

const DEFAULT_SETTINGS: ClockSettings = {
  style: "digital",
  format: "12h",
  showSeconds: true,
  showDate: true,
  showNextEvent: true,
  showWeather: true,
  showCalendar: false,
}

// ── Per-size layout presets ─────────────────────────────────────────────────
// Each widget size has a hand-tuned layout:
//   S   (2×2): time + date + temperature, vertically stacked, no calendar.
//   M   (4×2): S layout on the left half + calendar on the right half.
//   L   (4×4): S layout on the left half + calendar on the right half (taller).
//   XL  (8×4): S layout on the left half + calendar on the right half (huge).
//   TOWER / BANNER fall back to S.

type ClockLayout = "stack" | "split"

interface LayoutPreset {
  layout: ClockLayout
  /** Show next-event line. Off by default — user-visible toggle still applies. */
  allowNextEvent: boolean
  /** Show calendar. Toggle is forced on for split layouts and off for stack. */
  allowCalendar: boolean
}

const SIZE_PRESETS: Record<WidgetSize, LayoutPreset> = {
  S:      { layout: "stack", allowNextEvent: false, allowCalendar: false },
  M:      { layout: "split", allowNextEvent: false, allowCalendar: true  },
  L:      { layout: "split", allowNextEvent: true,  allowCalendar: true  },
  XL:     { layout: "split", allowNextEvent: true,  allowCalendar: true  },
  BANNER: { layout: "stack", allowNextEvent: false, allowCalendar: false },
  TOWER:  { layout: "stack", allowNextEvent: true,  allowCalendar: false },
}

const FALLBACK_PRESET: LayoutPreset = SIZE_PRESETS.M

function getPreset(size: WidgetSize | undefined): LayoutPreset {
  return (size && SIZE_PRESETS[size]) ?? FALLBACK_PRESET
}

// Minimum block dim — keeps content readable on tiny widgets.
const MIN_BLOCK_PX = 80

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

// ── Weather (uses shared weather service — no independent API calls) ──────

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
  gridSize,
}: {
  time: Date
  settings: ClockSettings
  containerWidth: number
  containerHeight: number
  nextEvent: { title: string; minutesUntil: number } | null
  weather: { temp: number } | null
  gridSize?: WidgetSize
}) {
  const preset = getPreset(gridSize)
  // Date and weather are always shown (they're part of the core S layout).
  // Next-event is opt-in per size and respects the user toggle.
  const showDate = settings.showDate
  const showWeather = settings.showWeather
  const showNextEvent = settings.showNextEvent && preset.allowNextEvent
  // Calendar is dictated by size, not user toggle: split layouts always show it.
  const showCalendar = preset.allowCalendar

  if (preset.layout === "split" && showCalendar) {
    // Two blocks side-by-side, each filling its half of the container.
    const blockW = Math.max(MIN_BLOCK_PX, containerWidth / 2)
    const blockH = Math.max(MIN_BLOCK_PX, containerHeight)
    return (
      <div className="flex h-full w-full">
        <div style={{ width: blockW, height: blockH }} className="flex items-center justify-center">
          <ClockBlock
            time={time}
            settings={settings}
            blockW={blockW}
            blockH={blockH}
            nextEvent={showNextEvent ? nextEvent : null}
            weather={showWeather ? weather : null}
            showDate={showDate}
          />
        </div>
        <div style={{ width: blockW, height: blockH }} className="flex items-center justify-center">
          <MiniCalendar
            date={time}
            accentColor="var(--zone-clock-accent)"
            blockW={blockW}
            blockH={blockH}
          />
        </div>
      </div>
    )
  }

  // Single block fills the entire container.
  const blockW = Math.max(MIN_BLOCK_PX, containerWidth)
  const blockH = Math.max(MIN_BLOCK_PX, containerHeight)
  return (
    <div className="flex h-full w-full items-center justify-center">
      <ClockBlock
        time={time}
        settings={settings}
        blockW={blockW}
        blockH={blockH}
        nextEvent={showNextEvent ? nextEvent : null}
        weather={showWeather ? weather : null}
        showDate={showDate}
      />
    </div>
  )
}

// ── Square clock block ──────────────────────────────────────────────────────
// Renders the time (digital or analog) + date + secondary info, all sized as
// fractions of the block side length so the content scales in clean steps.

function ClockBlock({
  time,
  settings,
  blockW,
  blockH,
  nextEvent,
  weather,
  showDate,
}: {
  time: Date
  settings: ClockSettings
  blockW: number
  blockH: number
  nextEvent: { title: string; minutesUntil: number } | null
  weather: { temp: number } | null
  showDate: boolean
}) {
  const hours = time.getHours()
  const minutes = time.getMinutes()
  const seconds = time.getSeconds()
  const minDim = Math.min(blockW, blockH)

  if (settings.style === "analog") {
    // Analog face stays square — sized to the shorter block dimension.
    const clockSize = minDim * 0.78
    const secondarySize = Math.max(11, minDim * 0.07)
    return (
      <div
        className="flex flex-col items-center justify-center"
        style={{ width: blockW, height: blockH, gap: minDim * 0.04 }}
      >
        <AnalogClock
          size={clockSize}
          hours={hours}
          minutes={minutes}
          seconds={seconds}
          showSeconds={settings.showSeconds}
          accentColor="var(--zone-clock-accent)"
        />
        {showDate && (
          <p className="font-mono tracking-wide text-muted-foreground/50" style={{ fontSize: secondarySize }}>
            {time.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
          </p>
        )}
        <SecondaryInfo nextEvent={nextEvent} weather={weather} size={secondarySize} />
      </div>
    )
  }

  // Digital — pick the largest font that fits both width and height of the block.
  // Time text is ~5 chars wide ("12:34"), with a small AM/PM column adding ~0.30em.
  const hasAmPm = settings.format === "12h"
  const showSeconds = settings.showSeconds
  const sideColumnEm = hasAmPm || showSeconds ? 0.35 : 0
  // Approx text width factor: 5 digits at ~0.55em each + side column
  const widthFactor = 5 * 0.55 + sideColumnEm
  // Height taken below the time: date (~0.45em) + secondary (~0.55em) + gaps
  const linesBelow = (showDate ? 0.55 : 0) + ((nextEvent || weather) ? 0.6 : 0)
  const heightFactor = 1 + linesBelow

  // Fit the time text in the available rectangle, with a little padding.
  const padW = blockW * 0.92
  const padH = blockH * 0.92
  const fontFromWidth = padW / widthFactor
  const fontFromHeight = padH / heightFactor
  const fontSize = Math.max(24, Math.min(fontFromWidth, fontFromHeight))

  const secondarySize = Math.max(11, fontSize * 0.18)
  const ampmSize = fontSize * 0.22
  const secondsSize = fontSize * 0.20

  const ampm = hours >= 12 ? "PM" : "AM"
  const displayTime = hasAmPm
    ? `${hours % 12 || 12}:${String(minutes).padStart(2, "0")}`
    : `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`

  return (
    <div
      className="flex flex-col items-center justify-center"
      style={{ width: blockW, height: blockH }}
    >
      <div className="flex items-baseline gap-[0.08em]" style={{ fontSize }}>
        <span
          className="font-[family-name:var(--font-display)] font-bold tabular-nums tracking-tight text-foreground"
          style={{ lineHeight: 1 }}
        >
          {displayTime}
        </span>
        <div className="flex flex-col items-start" style={{ gap: secondsSize * 0.15 }}>
          {hasAmPm && (
            <span
              className="font-mono font-semibold tabular-nums text-[var(--zone-clock-accent)]"
              style={{ fontSize: ampmSize, lineHeight: 1 }}
            >
              {ampm}
            </span>
          )}
          {showSeconds && (
            <span
              className="font-mono tabular-nums text-muted-foreground/40"
              style={{ fontSize: secondsSize, lineHeight: 1 }}
            >
              {String(seconds).padStart(2, "0")}
            </span>
          )}
        </div>
      </div>

      {showDate && (
        <p
          className="mt-[0.4em] font-mono tracking-wide text-muted-foreground/50"
          style={{ fontSize: secondarySize }}
        >
          {time.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
        </p>
      )}

      <SecondaryInfo nextEvent={nextEvent} weather={weather} size={secondarySize} />
    </div>
  )
}

// ── Mini calendar (month view) ──────────────────────────────────────────────

function MiniCalendar({
  date,
  accentColor,
  blockW,
  blockH,
}: {
  date: Date
  accentColor: string
  blockW: number
  blockH: number
}) {
  const year = date.getFullYear()
  const month = date.getMonth()
  const today = date.getDate()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  const rows = cells.length / 7

  // Calendar fills the block rectangle (with a small inset). Cell width and
  // height are derived independently so the calendar uses all available space.
  const insetX = blockW * 0.06
  const insetY = blockH * 0.08
  const innerW = blockW - insetX * 2
  const innerH = blockH - insetY * 2
  const colGap = 4
  const rowGap = 4
  const cellW = (innerW - colGap * 6) / 7
  const headerH = Math.max(14, Math.min(cellW * 0.55, innerH * 0.12))
  const rowH = (innerH - headerH - rowGap * (rows + 1)) / rows
  const cellH = Math.max(16, rowH)
  const fontSize = Math.max(11, Math.min(cellW * 0.42, cellH * 0.55))
  const headers = ["S", "M", "T", "W", "T", "F", "S"]
  const gridCols = `repeat(7, minmax(0, 1fr))`

  return (
    <div className="font-mono shrink-0" style={{ width: innerW, height: innerH }}>
      <div className="grid" style={{ gridTemplateColumns: gridCols, columnGap: colGap }}>
        {headers.map((h, i) => (
          <div
            key={`h-${i}`}
            className="flex items-center justify-center overflow-hidden text-muted-foreground/40"
            style={{ height: headerH, fontSize: fontSize * 0.85, minWidth: 0 }}
          >
            {h}
          </div>
        ))}
      </div>
      <div
        className="grid"
        style={{ gridTemplateColumns: gridCols, columnGap: colGap, rowGap, marginTop: rowGap }}
      >
        {cells.map((d, i) => {
          const isToday = d === today
          return (
            <div
              key={i}
              className="flex items-center justify-center overflow-hidden rounded tabular-nums transition-colors"
              style={{
                height: cellH,
                fontSize,
                minWidth: 0,
                color: isToday ? "white" : d ? "var(--foreground)" : "transparent",
                backgroundColor: isToday ? accentColor : undefined,
                opacity: d ? 1 : 0,
                fontWeight: isToday ? 700 : 400,
              }}
            >
              {d ?? ""}
            </div>
          )
        })}
      </div>
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

function getZoneGridAspect(size: WidgetSize | undefined): number | null {
  if (!size) return null
  const dims = WIDGET_SIZES[size]
  if (!dims) return null
  return dims.w / dims.h
}

function ClockSettingsDialog({
  settings,
  onChange,
  time,
  nextEvent,
  weather,
  zonePxW,
  zonePxH,
  gridSize,
  onChangeGridSize,
}: {
  settings: ClockSettings
  onChange: (s: ClockSettings) => void
  time: Date
  nextEvent: { title: string; minutesUntil: number } | null
  weather: { temp: number } | null
  zonePxW: number
  zonePxH: number
  gridSize?: WidgetSize
  onChangeGridSize?: (size: WidgetSize) => void
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

  // Preview aspect ratio: prefer the quantized grid size (S/M/L/XL/Banner/Tower)
  // over the raw pixel measurement, so the preview reflects the exact ratio
  // the widget will be displayed at on the dashboard.
  const previewMaxW = 500
  const previewMaxH = 400
  const gridAspect = getZoneGridAspect(gridSize)
  const zoneAspect = gridAspect ?? zonePxW / Math.max(zonePxH, 1)
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
              gridSize={gridSize}
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

            {/* Size (aspect ratio) */}
            {onChangeGridSize && (
              <section>
                <SectionLabel>Size</SectionLabel>
                <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                  {ZONE_ALLOWED_SIZES.clock.map((size) => {
                    const dims = WIDGET_SIZES[size]
                    const isActive = gridSize === size
                    return (
                      <button
                        key={size}
                        onClick={() => onChangeGridSize(size)}
                        className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs font-semibold transition-all active:scale-[0.98] ${
                          isActive
                            ? "border-[var(--zone-clock-accent)]/40 bg-[var(--zone-clock-accent)]/10 text-[var(--zone-clock-accent)]"
                            : "border-border/20 bg-muted/10 text-muted-foreground hover:border-border/30 hover:bg-muted/15"
                        }`}
                      >
                        <span>{WIDGET_SIZE_LABELS[size]}</span>
                        <span className="font-mono text-[0.6875rem] opacity-60">
                          {dims.w}×{dims.h}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </section>
            )}

            <Separator className="bg-border/15" />

            {/* Toggles */}
            <section className="space-y-3">
              <SectionLabel>Show</SectionLabel>
              <ToggleRow label="Seconds" checked={settings.showSeconds} onChange={(v) => update({ showSeconds: v })} />
              <ToggleRow label="Date" checked={settings.showDate} onChange={(v) => update({ showDate: v })} />
              <ToggleRow
                label="Next event"
                checked={settings.showNextEvent}
                onChange={(v) => update({ showNextEvent: v })}
                disabled={!getPreset(gridSize).allowNextEvent}
                hint="Next event needs a Large or Extra Large size"
              />
              <ToggleRow label="Weather" checked={settings.showWeather} onChange={(v) => update({ showWeather: v })} />
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

function ToggleRow({
  label,
  checked,
  onChange,
  disabled,
  hint,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  hint?: string
}) {
  return (
    <div
      className={`flex items-center justify-between ${disabled ? "opacity-40" : ""}`}
      title={disabled ? hint : undefined}
    >
      <span className="text-xs text-foreground/70">{label}</span>
      <Switch checked={checked && !disabled} onCheckedChange={onChange} disabled={disabled} />
    </div>
  )
}

// ── ClockZone ──────────────────────────────────────────────────────────────

export function ClockZone() {
  const { editMode, layout, onLayoutChange } = useDashboard()
  const clockGridSize = layout?.zones.find((z) => z.id === "clock")?.size
  const [settingsOpen, setSettingsOpen] = useState(false)

  const handleChangeGridSize = useCallback(
    (size: WidgetSize) => {
      if (!layout || !onLayoutChange) return
      onLayoutChange(setZoneSize(layout, "clock", size))
    },
    [layout, onLayoutChange],
  )

  // Right-click menu actions: just an Open Settings entry that toggles the
  // dialog (the dialog itself contains all the configuration fields).
  const zoneActions = useMemo<ZoneAction[]>(
    () => [
      {
        id: "settings",
        label: "Clock settings…",
        icon: <Settings className="size-3.5" />,
        onSelect: () => setSettingsOpen(true),
      },
    ],
    [],
  )
  useRegisterZoneActions("clock", zoneActions)
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ w: 200, h: 150 })
  const [time, setTime] = useState<Date | null>(null)
  const sharedWeather = useWeather()
  const weather = sharedWeather ? { temp: sharedWeather.temp } : null
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

  // Track content area size. Observe the content node directly (not the outer
  // zone-surface) so the rect we measure matches what we observe — and use a
  // useLayoutEffect so the initial measurement happens before paint, avoiding
  // a frame of broken layout from the (200, 150) default.
  useLayoutEffect(() => {
    const content = contentRef.current
    if (!content) return
    const measure = () => {
      const rect = content.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        setContainerSize((prev) =>
          prev.w === rect.width && prev.h === rect.height
            ? prev
            : { w: rect.width, h: rect.height },
        )
      }
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(content)
    return () => ro.disconnect()
  }, [])

  // Weather comes from shared useWeather() hook — no separate fetch needed

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
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <ClockSettingsDialog
          settings={settings}
          onChange={handleSettingsChange}
          time={time}
          nextEvent={nextEvent}
          weather={weather}
          zonePxW={containerSize.w}
          zonePxH={containerSize.h}
          gridSize={clockGridSize}
          onChangeGridSize={layout && onLayoutChange ? handleChangeGridSize : undefined}
        />
      </Dialog>

      <div ref={contentRef} className="flex min-h-0 flex-1 items-center justify-center">
        <ClockDisplay
          time={time}
          settings={settings}
          containerWidth={containerSize.w}
          containerHeight={containerSize.h}
          nextEvent={nextEvent}
          weather={weather}
          gridSize={clockGridSize}
        />
      </div>
    </div>
  )
}
