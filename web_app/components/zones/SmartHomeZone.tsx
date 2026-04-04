"use client"

import { useCallback, useEffect, useRef, useState } from "react"
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
import { ZoneDragHandle } from "@/components/dashboard/ZoneDragHandle"
import { ZoneLabel } from "@/components/dashboard/ZoneLabel"
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

// ── Component ───────────────────────────────────────────────────────────────

export function SmartHomeZone() {
  const { editMode } = useDashboard()
  const [state, setState] = useState<ConnectionState>({ status: "loading" })
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const brightnessTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const colorTempTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  useEffect(() => {
    async function check() {
      try {
        const url = await getSetting("ha_base_url")
        setHasConfig(!!url)
        if (url) {
          fetchStates()
        } else {
          setState({ status: "disconnected" })
        }
      } catch {
        setState({ status: "disconnected" })
        setHasConfig(false)
      }
    }
    check()
  }, [fetchStates])

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
    // Optimistic: flip state immediately
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
      // Refetch for accurate state after a small delay
      setTimeout(fetchStates, 500)
    } catch {
      fetchStates()
    }
  }, [fetchStates])

  const handleBrightness = useCallback((entityId: string, value: number) => {
    // Optimistic update
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

    // Debounce the API call
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
    // Optimistic update
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

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="zone-surface zone-smarthome flex h-full flex-col">
      {/* Header */}
      <div className={cn("flex shrink-0 items-center gap-2 px-3 pt-2.5 pb-1.5", editMode && "zone-drag-handle")}>
        <ZoneDragHandle />
        <ZoneLabel accentVar="--zone-smarthome-accent" icon={<Home className="size-4" />}>
          Smart Home
        </ZoneLabel>
        {state.status === "connected" && (
          <span className="ml-auto font-mono text-xs text-muted-foreground">
            {state.entities.length} {state.entities.length === 1 ? "device" : "devices"}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {state.status === "loading" && (
          <div className="flex h-full items-center justify-center">
            <span className="text-xs text-muted-foreground">Connecting...</span>
          </div>
        )}

        {state.status === "disconnected" && (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
            <Home className="size-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              Connect Home Assistant in Settings to control your devices.
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

        {state.status === "connected" && state.entities.length > 0 && (
          <div className="flex flex-col divide-y divide-border/10">
            {state.entities.map((entity) => (
              <EntityCard
                key={entity.entity_id}
                entity={entity}
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

// ── Pill Slider (inline, minimal) ──────────────────────────────────────────

function PillSlider({
  icon,
  value,
  min,
  max,
  step,
  onChange,
  trackStyle,
}: {
  icon: React.ReactNode
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  trackStyle?: React.CSSProperties
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
      className="relative flex h-7 cursor-pointer items-center overflow-hidden rounded-full bg-muted/30"
      style={trackStyle}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* Filled portion */}
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-foreground/10"
        style={{ width: `${fraction * 100}%` }}
      />
      {/* Icon */}
      <div className="relative z-10 flex size-7 shrink-0 items-center justify-center">
        {icon}
      </div>
    </div>
  )
}

// ── Entity Row ─────────────────────────────────────────────────────────────

function EntityCard({
  entity,
  onToggle,
  onBrightness,
  onColorTemp,
}: {
  entity: HAEntity
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

  return (
    <div className="flex flex-col gap-1.5 py-1.5">
      {/* Device row: icon toggle + name + brightness */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onToggle(entity.entity_id)}
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-full transition-colors",
            isOn
              ? "text-[var(--zone-smarthome-accent)]"
              : "text-muted-foreground/30",
          )}
        >
          <Icon className="size-4" />
        </button>
        <span className={cn(
          "min-w-0 flex-1 truncate text-xs font-medium",
          isOn ? "text-foreground" : "text-muted-foreground/40"
        )}>
          {name}
        </span>

        {/* Inline brightness pill */}
        {isOn && hasBrightness ? (
          <div className="w-20 shrink-0">
            <PillSlider
              icon={<Lightbulb className="size-3 text-[var(--zone-smarthome-accent)]" />}
              value={brightnessPercent}
              min={1}
              max={100}
              step={1}
              onChange={(v) => onBrightness(entity.entity_id, v)}
            />
          </div>
        ) : (
          <span className={cn(
            "shrink-0 font-mono text-xs",
            isOn ? "text-[var(--zone-smarthome-accent)]" : "text-muted-foreground/20"
          )}>
            {isOn ? "On" : "Off"}
          </span>
        )}
      </div>

      {/* Color temp pill -- only when on and supported */}
      {isOn && hasColorTemp && (
        <div className="ml-10">
          <PillSlider
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
  )
}
