"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Home,
  Lightbulb,
  LightbulbOff,
  Power,
  Fan,
  Thermometer,
  Settings2,
  Sun,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useDashboard } from "@/components/dashboard/DashboardContext"
import { getSetting } from "@/lib/data-layer"

// ── Types ───────────────────────────────────────────────────────────────────

interface HAEntity {
  entity_id: string
  state: string
  attributes: {
    friendly_name?: string
    brightness?: number
    rgb_color?: [number, number, number]
    color_temp_kelvin?: number
    min_color_temp_kelvin?: number
    max_color_temp_kelvin?: number
    supported_color_modes?: string[]
    color_mode?: string
    icon?: string
    [key: string]: unknown
  }
  last_changed: string
  last_updated: string
}

type ConnectionState =
  | { status: "disconnected" }
  | { status: "loading" }
  | { status: "connected"; entities: HAEntity[] }
  | { status: "error"; message: string }

// ── Constants ───────────────────────────────────────────────────────────────

const POLL_INTERVAL = 5000

const DOMAIN_ICONS: Record<string, typeof Lightbulb> = {
  light: Lightbulb,
  switch: Power,
  fan: Fan,
  climate: Thermometer,
}

const MIN_CARD_W = 110
const MIN_CARD_H = 44
const GRID_GAP = 6

// ── Layout solver ───────────────────────────────────────────────────────────

interface GridLayout {
  cols: number
  rows: number
  cardW: number
  cardH: number
  scroll: boolean
}

function computeGrid(W: number, H: number, n: number): GridLayout {
  if (!W || !H || !n) {
    return { cols: 1, rows: Math.max(1, n), cardW: W, cardH: H / Math.max(1, n), scroll: false }
  }

  const containerAspect = W / H
  let best: (GridLayout & { score: number }) | null = null

  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols)
    const cardW = (W - (cols - 1) * GRID_GAP) / cols
    const cardH = (H - (rows - 1) * GRID_GAP) / rows

    if (cardW < MIN_CARD_W || cardH < MIN_CARD_H) continue

    const gridAspect = cols / rows
    const aspectMatch = Math.abs(Math.log(gridAspect / containerAspect))

    const cardAspect = cardW / cardH
    // Penalize square or portrait cards (we want horizontal-ish cards)
    const cardPenalty =
      cardAspect < 1 ? Math.abs(Math.log(cardAspect)) :
      cardAspect > 8 ? Math.log(cardAspect / 8) : 0

    const empty = cols * rows - n
    const score = aspectMatch + cardPenalty * 0.5 + empty * 0.25

    if (!best || score < best.score) {
      best = { cols, rows, cardW, cardH, scroll: false, score }
    }
  }

  if (best) {
    const { cols, rows, cardW, cardH, scroll } = best
    return { cols, rows, cardW, cardH, scroll }
  }

  // Fallback: scrollable single-column with a usable min-card height
  const cardH = Math.max(MIN_CARD_H, 56)
  const visibleRows = Math.max(1, Math.floor(H / (cardH + GRID_GAP)))
  return { cols: 1, rows: n, cardW: W, cardH, scroll: visibleRows < n }
}

// ── Component ───────────────────────────────────────────────────────────────

export function SmartHomeZone() {
  const { editMode } = useDashboard()
  const [state, setState] = useState<ConnectionState>({ status: "loading" })
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const brightnessTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const colorTempTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setContainerSize({ w: width, h: height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const fetchStates = useCallback(async () => {
    try {
      const res = await fetch("/api/home-assistant?action=status")
      if (!res.ok) throw new Error("Failed to fetch")
      const data = await res.json() as { connected: boolean; entities: HAEntity[] }

      if (!data.connected) {
        setState({ status: "disconnected" })
        return
      }

      setState({ status: "connected", entities: data.entities })
    } catch {
      setState({ status: "error", message: "Could not reach Home Assistant" })
    }
  }, [])

  // Check if HA is configured at all (via localStorage for local mode)
  const [hasConfig, setHasConfig] = useState<boolean | null>(null)

  const checkConfig = useCallback(async () => {
    try {
      const url = await getSetting("ha_base_url")
      setHasConfig(!!url)
      if (url) {
        setState((prev) => (prev.status === "connected" ? prev : { status: "loading" }))
        fetchStates()
      } else {
        setState({ status: "disconnected" })
      }
    } catch {
      setState({ status: "disconnected" })
      setHasConfig(false)
    }
  }, [fetchStates])

  useEffect(() => {
    checkConfig()
  }, [checkConfig])

  // React to config changes from Settings without requiring a refresh
  useEffect(() => {
    const handler = () => checkConfig()
    window.addEventListener("ts:ha-config-changed", handler)
    return () => window.removeEventListener("ts:ha-config-changed", handler)
  }, [checkConfig])

  // Poll for state updates
  useEffect(() => {
    if (state.status !== "connected") return
    pollRef.current = setInterval(fetchStates, POLL_INTERVAL)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [state.status, fetchStates])

  // ── Actions ─────────────────────────────────────────────────────────────

  const handleToggle = useCallback(async (entityId: string) => {
    setState((prev) => {
      if (prev.status !== "connected") return prev
      return {
        ...prev,
        entities: prev.entities.map((e) =>
          e.entity_id === entityId
            ? { ...e, state: e.state === "on" ? "off" : "on" }
            : e,
        ),
      }
    })

    try {
      await fetch("/api/home-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle", entity_id: entityId }),
      })
      setTimeout(fetchStates, 500)
    } catch {
      fetchStates()
    }
  }, [fetchStates])

  const handleBrightness = useCallback((entityId: string, value: number) => {
    setState((prev) => {
      if (prev.status !== "connected") return prev
      return {
        ...prev,
        entities: prev.entities.map((e) =>
          e.entity_id === entityId
            ? { ...e, state: value > 0 ? "on" : "off", attributes: { ...e.attributes, brightness: Math.round((value / 100) * 255) } }
            : e,
        ),
      }
    })

    if (brightnessTimeoutRef.current) clearTimeout(brightnessTimeoutRef.current)
    brightnessTimeoutRef.current = setTimeout(async () => {
      try {
        await fetch("/api/home-assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "brightness",
            entity_id: entityId,
            brightness: value,
          }),
        })
        setTimeout(fetchStates, 500)
      } catch {
        fetchStates()
      }
    }, 300)
  }, [fetchStates])

  const handleColorTemp = useCallback((entityId: string, kelvin: number) => {
    setState((prev) => {
      if (prev.status !== "connected") return prev
      return {
        ...prev,
        entities: prev.entities.map((e) =>
          e.entity_id === entityId
            ? { ...e, attributes: { ...e.attributes, color_temp_kelvin: kelvin } }
            : e,
        ),
      }
    })

    if (colorTempTimeoutRef.current) clearTimeout(colorTempTimeoutRef.current)
    colorTempTimeoutRef.current = setTimeout(async () => {
      try {
        await fetch("/api/home-assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "color_temp",
            entity_id: entityId,
            color_temp_kelvin: kelvin,
          }),
        })
        setTimeout(fetchStates, 500)
      } catch {
        fetchStates()
      }
    }, 300)
  }, [fetchStates])

  // ── Layout ──────────────────────────────────────────────────────────────

  const entities = state.status === "connected" ? state.entities : []
  const layout = useMemo(
    () => computeGrid(containerSize.w, containerSize.h, entities.length),
    [containerSize.w, containerSize.h, entities.length],
  )

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="zone-surface zone-smarthome flex h-full flex-col">

      {/* Content */}
      <div
        ref={containerRef}
        className={cn(
          "min-h-0 flex-1 p-2",
          layout.scroll ? "overflow-y-auto" : "overflow-hidden",
        )}
      >
        {state.status === "loading" && (
          <div className="flex h-full items-center justify-center">
            <span className="text-xs text-muted-foreground">Connecting...</span>
          </div>
        )}

        {state.status === "disconnected" && (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
            <Home className="size-8 opacity-50" />
            <p className="text-sm text-muted-foreground">
              Connect your Home Assistant instance to control your devices.
            </p>
            <button
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent("ts:open-settings", { detail: { section: "smarthome" } }),
                )
              }
              className="ts-inner-glass inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors"
            >
              <Home className="size-3.5" />
              Connect Home Assistant
            </button>
            <p className="text-xs text-muted-foreground/40">
              Opens the Smart Home section in Settings.
            </p>
          </div>
        )}

        {state.status === "error" && (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
            <Settings2 className="size-8 text-destructive/40" />
            <p className="text-xs text-muted-foreground">{state.message}</p>
            <Button variant="ghost" size="sm" onClick={fetchStates}>
              Retry
            </Button>
          </div>
        )}

        {state.status === "connected" && state.entities.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
            <Lightbulb className="size-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              No devices selected. Choose entities in Settings.
            </p>
          </div>
        )}

        {state.status === "connected" && state.entities.length > 0 && containerSize.w > 0 && (
          <div
            className="grid h-full w-full"
            style={{
              gridTemplateColumns: `repeat(${layout.cols}, minmax(0, 1fr))`,
              gridTemplateRows: layout.scroll
                ? `repeat(${layout.rows}, ${layout.cardH}px)`
                : `repeat(${layout.rows}, minmax(0, 1fr))`,
              gap: `${GRID_GAP}px`,
            }}
          >
            {state.entities.map((entity) => (
              <EntityCard
                key={entity.entity_id}
                entity={entity}
                cardW={layout.cardW}
                cardH={layout.cardH}
                onToggle={handleToggle}
                onBrightness={handleBrightness}
                onColorTemp={handleColorTemp}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Pill Slider ────────────────────────────────────────────────────────────

function PillSlider({
  icon,
  value,
  min,
  max,
  step,
  onChange,
  trackStyle,
  height = 28,
}: {
  icon: React.ReactNode
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  trackStyle?: React.CSSProperties
  height?: number
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)

  const fraction = (value - min) / (max - min)

  const updateFromPointer = useCallback((clientX: number) => {
    const track = trackRef.current
    if (!track) return
    const rect = track.getBoundingClientRect()
    const raw = (clientX - rect.left) / rect.width
    const clamped = Math.max(0, Math.min(1, raw))
    const stepped = Math.round((clamped * (max - min)) / step) * step + min
    onChange(Math.max(min, Math.min(max, stepped)))
  }, [min, max, step, onChange])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    draggingRef.current = true
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    updateFromPointer(e.clientX)
  }, [updateFromPointer])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current) return
    updateFromPointer(e.clientX)
  }, [updateFromPointer])

  const onPointerUp = useCallback(() => {
    draggingRef.current = false
  }, [])

  return (
    <div
      ref={trackRef}
      className="relative flex w-full cursor-pointer items-center overflow-hidden rounded-full bg-muted/30"
      style={{ height: `${height}px`, ...trackStyle }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-foreground/10"
        style={{ width: `${fraction * 100}%` }}
      />
      <div
        className="relative z-10 flex shrink-0 items-center justify-center"
        style={{ width: `${height}px`, height: `${height}px` }}
      >
        {icon}
      </div>
    </div>
  )
}

// ── Entity Card ────────────────────────────────────────────────────────────

function EntityCard({
  entity,
  cardW,
  cardH,
  onToggle,
  onBrightness,
  onColorTemp,
}: {
  entity: HAEntity
  cardW: number
  cardH: number
  onToggle: (id: string) => void
  onBrightness: (id: string, value: number) => void
  onColorTemp: (id: string, kelvin: number) => void
}) {
  const isOn = entity.state === "on"
  const domain = entity.entity_id.split(".")[0]
  const Icon = isOn && domain === "light" ? Lightbulb : (isOn ? DOMAIN_ICONS[domain] ?? Power : (domain === "light" ? LightbulbOff : DOMAIN_ICONS[domain] ?? Power))
  const name = entity.attributes.friendly_name ?? entity.entity_id.split(".")[1]?.replace(/_/g, " ") ?? entity.entity_id

  const supportedModes = entity.attributes.supported_color_modes ?? []
  const hasBrightness =
    domain === "light" &&
    supportedModes.some((m) =>
      ["brightness", "color_temp", "hs", "xy", "rgb", "rgbw", "rgbww"].includes(m),
    )
  const hasColorTemp =
    domain === "light" && supportedModes.includes("color_temp")

  const brightnessPercent = entity.attributes.brightness
    ? Math.round((entity.attributes.brightness / 255) * 100)
    : 0

  const colorTempKelvin = entity.attributes.color_temp_kelvin ?? 4000
  const minKelvin = entity.attributes.min_color_temp_kelvin ?? 2200
  const maxKelvin = entity.attributes.max_color_temp_kelvin ?? 6500

  const sliderCount = (hasBrightness ? 1 : 0) + (hasColorTemp ? 1 : 0)
  const showSliders = isOn && sliderCount > 0

  // Decide layout based on available card geometry
  // Heights: 24px name row, 4px gap, sliders ~22-32px each
  const NAME_ROW_H = 26
  const SLIDER_H = cardH >= 110 ? 28 : cardH >= 70 ? 22 : 18
  const ROW_GAP = 4

  // Can we stack name on top with sliders below?
  const stackedTotal = NAME_ROW_H + ROW_GAP + sliderCount * (SLIDER_H + ROW_GAP)
  const sideBySideTotal = NAME_ROW_H + ROW_GAP + SLIDER_H

  // Layout modes:
  // - "stacked": name row, then each slider on its own line (best with vertical room)
  // - "side": name row, then both sliders side-by-side (when wide enough)
  // - "inline": single row — icon + name + tiny pill on right (very tight)
  let mode: "stacked" | "side" | "inline" = "stacked"
  if (showSliders) {
    if (cardH >= stackedTotal) {
      mode = "stacked"
    } else if (sliderCount > 1 && cardH >= sideBySideTotal && cardW >= 200) {
      mode = "side"
    } else if (cardH >= sideBySideTotal) {
      mode = "stacked" // single slider, fits one row
    } else {
      mode = "inline"
    }
  }

  return (
    <div
      className={cn(
        "relative flex h-full w-full min-w-0 flex-col overflow-hidden rounded-xl transition-colors",
        isOn ? "" : "opacity-60",
      )}
      style={{ padding: "6px 8px", gap: `${ROW_GAP}px` }}
    >
      {/* Header row */}
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          onClick={() => onToggle(entity.entity_id)}
          className={cn(
            "flex shrink-0 items-center justify-center rounded-full transition-colors",
            isOn ? "opacity-100" : "opacity-40",
          )}
          style={{ width: NAME_ROW_H, height: NAME_ROW_H }}
        >
          <Icon className="size-4" />
        </button>
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-xs font-medium",
            isOn ? "" : "opacity-60",
          )}
        >
          {name}
        </span>

        {/* Inline pill or state label */}
        {mode === "inline" && showSliders && (
          <div className="flex shrink-0 flex-col gap-0.5" style={{ width: Math.min(cardW * 0.4, 80) }}>
            {hasBrightness && (
              <PillSlider
                height={Math.max(10, Math.floor((cardH - NAME_ROW_H) / Math.max(1, sliderCount)) - 2)}
                icon={<Lightbulb className="size-2.5" />}
                value={brightnessPercent}
                min={1}
                max={100}
                step={1}
                onChange={(v) => onBrightness(entity.entity_id, v)}
              />
            )}
            {hasColorTemp && (
              <PillSlider
                height={Math.max(10, Math.floor((cardH - NAME_ROW_H) / Math.max(1, sliderCount)) - 2)}
                icon={<Sun className="size-2.5 text-amber-400/70" />}
                value={colorTempKelvin}
                min={minKelvin}
                max={maxKelvin}
                step={100}
                onChange={(v) => onColorTemp(entity.entity_id, v)}
                trackStyle={{
                  background: "linear-gradient(to right, rgba(255,147,41,0.15), rgba(255,245,224,0.1), rgba(166,200,255,0.15))",
                }}
              />
            )}
          </div>
        )}

        {!showSliders && (
          <span
            className={cn(
              "shrink-0 font-mono text-xs",
              isOn ? "" : "opacity-50",
            )}
          >
            {isOn ? "On" : "Off"}
          </span>
        )}
      </div>

      {/* Slider area */}
      {showSliders && (mode === "stacked" || mode === "side") && (
        <div
          className={cn(
            "flex min-h-0 flex-1",
            mode === "side" ? "flex-row gap-1.5" : "flex-col gap-1",
          )}
        >
          {hasBrightness && (
            <div className={cn("min-w-0", mode === "side" ? "flex-1" : "w-full")}>
              <PillSlider
                height={SLIDER_H}
                icon={<Lightbulb className="size-3" />}
                value={brightnessPercent}
                min={1}
                max={100}
                step={1}
                onChange={(v) => onBrightness(entity.entity_id, v)}
              />
            </div>
          )}
          {hasColorTemp && (
            <div className={cn("min-w-0", mode === "side" ? "flex-1" : "w-full")}>
              <PillSlider
                height={SLIDER_H}
                icon={<Sun className="size-3 text-amber-400/70" />}
                value={colorTempKelvin}
                min={minKelvin}
                max={maxKelvin}
                step={100}
                onChange={(v) => onColorTemp(entity.entity_id, v)}
                trackStyle={{
                  background: "linear-gradient(to right, rgba(255,147,41,0.15), rgba(255,245,224,0.1), rgba(166,200,255,0.15))",
                }}
              />
            </div>
          )}
        </div>
      )}

    </div>
  )
}
