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
import { Slider } from "@/components/ui/slider"
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
          <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-1.5">
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

// ── Entity Card ─────────────────────────────────────────────────────────────

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

  // Dynamic glow for on-state lights
  const glowColor = entity.attributes.rgb_color
    ? `rgb(${entity.attributes.rgb_color.join(",")})`
    : isOn
      ? "var(--zone-smarthome-accent)"
      : undefined

  return (
    <div
      className={cn(
        "group relative flex flex-col gap-2 rounded-xl border px-3 py-2.5 transition-all",
        isOn
          ? "border-[var(--zone-smarthome-accent)]/30 bg-[var(--zone-smarthome-accent)]/8"
          : "border-border/40 bg-muted/20 hover:bg-muted/30",
      )}
      style={isOn && glowColor ? { boxShadow: `0 0 20px -8px ${glowColor}` } : undefined}
    >
      {/* Top row: icon + name + toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onToggle(entity.entity_id)}
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-lg transition-colors",
            isOn
              ? "bg-[var(--zone-smarthome-accent)]/20 text-[var(--zone-smarthome-accent)]"
              : "bg-muted/40 text-muted-foreground",
          )}
        >
          <Icon className="size-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium leading-tight">{name}</p>
          <p className="text-xs text-muted-foreground">
            {isOn
              ? hasBrightness
                ? `${brightnessPercent}%`
                : "On"
              : "Off"}
          </p>
        </div>
      </div>

      {/* Brightness slider -- always visible when on and supported */}
      {isOn && hasBrightness && (
        <div className="flex items-center gap-2">
          <LightbulbOff className="size-3.5 shrink-0 text-muted-foreground/50" />
          <Slider
            value={[brightnessPercent]}
            min={1}
            max={100}
            step={1}
            onValueChange={([v]) => onBrightness(entity.entity_id, v)}
            className="flex-1"
          />
          <Lightbulb className="size-3.5 shrink-0 text-[var(--zone-smarthome-accent)]" />
        </div>
      )}

      {/* Color temperature slider -- always visible when on and supported */}
      {isOn && hasColorTemp && (
        <div className="flex items-center gap-2">
          <Sun className="size-3.5 shrink-0 text-amber-400" />
          <div className="relative flex-1">
            <div
              className="pointer-events-none absolute inset-0 rounded-full"
              style={{
                background: "linear-gradient(to right, #ff9329, #fff5e0, #a6c8ff)",
                height: "6px",
                top: "50%",
                transform: "translateY(-50%)",
                opacity: 0.4,
                borderRadius: "9999px",
              }}
            />
            <Slider
              value={[colorTempKelvin]}
              min={minKelvin}
              max={maxKelvin}
              step={100}
              onValueChange={([v]) => onColorTemp(entity.entity_id, v)}
              className="relative flex-1"
            />
          </div>
          <Sun className="size-3.5 shrink-0 text-blue-300" />
        </div>
      )}
    </div>
  )
}
