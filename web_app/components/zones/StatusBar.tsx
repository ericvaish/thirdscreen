"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import {
  Play,
  Pause,
  RotateCcw,
  Timer,
  Bell,
  Clock,
  CalendarDays,
  Mail,
  Info,
  X,
  CloudSun,
  Cloud,
  CloudRain,
  CloudSnow,
  Sun,
  CloudLightning,
  CloudFog,
  Wind,
  Leaf,
  CircleDot,
  Coffee,
  MessageSquare,
  Plus,
  Pencil,
  Trash2,
  Calendar,
  Gauge,
  TriangleAlert,
  MapPin,
  Search,
  Loader2,
  Eye,
  EyeOff,
  Settings2,
  GripVertical,
  ChevronUp,
  ChevronDown,
  BatteryFull,
  BatteryMedium,
  BatteryLow,
  BatteryWarning,
  BatteryCharging,
  Wifi,
  WifiOff,
  Sunrise,
  Sunset,
  Hash,
  Hourglass,
  Moon,
  Droplets,
  Thermometer,
  Minus,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import {
  useNotifications,
  type NotificationType,
} from "@/lib/notifications"
import { useGoogleNotifications } from "@/lib/google-services/use-google-notifications"
import { GOOGLE_AUTH_URL, GMAIL_SCOPES, CHAT_SCOPES } from "@/lib/google-services/constants"
import { generatePKCE } from "@/lib/spotify/pkce"
import { useCountdownTimer } from "@/lib/countdown-timer"

// ── Shared geolocation (used by weather + AQI) ──────────────────────────────

type GeoData = { latitude: number; longitude: number; city: string }

const MANUAL_GEO_KEY = "statusbar-manual-location"

let geoCache: GeoData | null = null
let geoPromise: Promise<GeoData | null> | null = null
const geoListeners = new Set<() => void>()

function notifyGeoListeners() {
  geoListeners.forEach((cb) => cb())
}

function getManualGeo(): GeoData | null {
  try {
    const raw = localStorage.getItem(MANUAL_GEO_KEY)
    if (!raw) return null
    return JSON.parse(raw) as GeoData
  } catch {
    return null
  }
}

export function setManualGeo(geo: GeoData) {
  localStorage.setItem(MANUAL_GEO_KEY, JSON.stringify(geo))
  geoCache = geo
  geoPromise = null
  notifyGeoListeners()
}

function clearManualGeo() {
  localStorage.removeItem(MANUAL_GEO_KEY)
  geoCache = null
  geoPromise = null
}

function resetGeo() {
  geoCache = null
  geoPromise = null
}

/** Explicitly request browser location. Returns true if granted. */
async function requestBrowserLocation(): Promise<boolean> {
  resetGeo()
  clearManualGeo()
  try {
    const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 })
    })
    const geo: GeoData = {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      city: "",
    }
    // Try to get city name via reverse geocoding (nominatim)
    try {
      const revRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${geo.latitude}&lon=${geo.longitude}&format=json&zoom=10`)
      if (revRes.ok) {
        const revData = await revRes.json() as { address?: { city?: string; town?: string; village?: string } }
        const addr = revData.address
        geo.city = addr?.city ?? addr?.town ?? addr?.village ?? ""
      }
    } catch {}
    geoCache = geo
    geoPromise = null
    notifyGeoListeners()
    return true
  } catch {
    // Browser denied -- check if permanently blocked
    try {
      const perm = await navigator.permissions.query({ name: "geolocation" })
      if (perm.state === "denied") {
        // Permanently denied — user must set city manually in settings
      }
    } catch {}
    return false
  }
}

export function useGeoChange(cb: () => void) {
  const cbRef = useRef(cb)
  cbRef.current = cb
  useEffect(() => {
    const handler = () => cbRef.current()
    geoListeners.add(handler)
    return () => { geoListeners.delete(handler) }
  }, [])
}

export function getGeo(): Promise<GeoData | null> {
  if (geoCache) return Promise.resolve(geoCache)
  const manual = getManualGeo()
  if (manual) {
    geoCache = manual
    return Promise.resolve(manual)
  }
  if (geoPromise) return geoPromise
  geoPromise = (async (): Promise<GeoData | null> => {
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
      })
      geoCache = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        city: "",
      }
      return geoCache
    } catch {
      // Browser geolocation denied/failed — user must set city manually in settings
      return null
    }
  })()
  geoPromise.then((result) => {
    if (result) notifyGeoListeners()
  })
  return geoPromise
}

// ── City search via Open-Meteo Geocoding API ────────────────────────────────

export interface GeoSearchResult {
  name: string
  country: string
  admin1?: string
  latitude: number
  longitude: number
  timezone?: string
}

export async function searchCities(query: string): Promise<GeoSearchResult[]> {
  if (query.length < 2) return []
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`
  )
  if (!res.ok) return []
  const data = await res.json() as { results?: Array<{ name: string; country: string; admin1?: string; latitude: number; longitude: number; timezone?: string }> }
  return (data.results ?? []).map((r) => ({
    name: r.name,
    country: r.country,
    admin1: r.admin1,
    latitude: r.latitude,
    longitude: r.longitude,
    timezone: r.timezone,
  }))
}

// ── City Search UI (shared by error + change city flows) ────────────────────

function CitySearchContent({ onBack, onSelect, onRequestLocation }: {
  onBack: () => void
  onSelect: (r: GeoSearchResult) => void
  onRequestLocation?: () => void
}) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<GeoSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSearch = useCallback((value: string) => {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (value.length < 2) {
      setResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    debounceRef.current = setTimeout(async () => {
      const r = await searchCities(value)
      setResults(r)
      setSearching(false)
    }, 300)
  }, [])

  return (
    <div>
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="text-muted-foreground/50 hover:text-muted-foreground">
          <X className="size-3.5" />
        </button>
        <p className="text-xs font-medium text-foreground/80">
          Search for your city
        </p>
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground/40" />
          <input
            autoFocus
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="City name..."
            className="h-8 w-full rounded-md border border-border/30 bg-muted/20 pl-7 pr-2 text-xs text-foreground outline-none placeholder:text-muted-foreground/30 focus:border-primary/30"
          />
          {searching && <Loader2 className="absolute right-2 top-1/2 size-3 -translate-y-1/2 animate-spin text-muted-foreground/40" />}
        </div>
        {onRequestLocation && (
          <button
            onClick={onRequestLocation}
            className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border/30 text-primary/60 transition-colors hover:bg-primary/10 hover:text-primary"
            title="Use browser location"
          >
            <MapPin className="size-3.5" />
          </button>
        )}
      </div>
      {results.length > 0 && (
        <div className="mt-1.5 flex flex-col gap-0.5">
          {results.map((r, i) => (
            <button
              key={`${r.latitude}-${r.longitude}-${i}`}
              onClick={() => onSelect(r)}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted/30"
            >
              <MapPin className="size-3 shrink-0 text-muted-foreground/40" />
              <div className="min-w-0">
                <span className="text-foreground/80">{r.name}</span>
                <span className="ml-1 text-muted-foreground/50">
                  {r.admin1 ? `${r.admin1}, ` : ""}{r.country}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
      {query.length >= 2 && !searching && results.length === 0 && (
        <p className="mt-2 text-xs text-muted-foreground/40">No cities found</p>
      )}
    </div>
  )
}

// ── Location Error Popover Content ──────────────────────────────────────────

function LocationErrorContent({ error, onRequestLocation, onRetry }: {
  error: "no-location" | "fetch-error"
  onRequestLocation: () => void
  onRetry: () => void
}) {
  const [mode, setMode] = useState<"default" | "search">("default")

  const selectCity = useCallback((r: GeoSearchResult) => {
    setManualGeo({ latitude: r.latitude, longitude: r.longitude, city: r.name })
    onRetry()
  }, [onRetry])

  if (mode === "search") {
    return <CitySearchContent onBack={() => setMode("default")} onSelect={selectCity} onRequestLocation={onRequestLocation} />
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <TriangleAlert className="size-3.5 shrink-0 text-amber-400" />
        <p className="text-xs font-medium text-foreground/80">
          {error === "no-location" ? "Location not available" : "Data unavailable"}
        </p>
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground/60">
        {error === "no-location"
          ? "Enable location access or enter your city manually to see live data."
          : "Could not fetch data. Will retry automatically."}
      </p>
      <div className="mt-2.5 flex flex-col gap-1.5">
        <button
          onClick={onRequestLocation}
          className="w-full rounded-md bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
        >
          {error === "no-location" ? "Request Location" : "Retry Now"}
        </button>
        {error === "no-location" && (
          <button
            onClick={() => setMode("search")}
            className="w-full rounded-md border border-border/20 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/20 hover:text-foreground"
          >
            Enter Manually
          </button>
        )}
      </div>
    </div>
  )
}

// ── Widget Registry ────────────────────────────────────────────────────────

type WidgetId = "time" | "date" | "weather" | "aqi" | "pomodoro" | "timer" | "countdown" | "battery" | "sunrise-sunset" | "humidity" | "day-progress" | "uptime"

interface WidgetDef {
  id: WidgetId
  label: string
  icon: typeof Clock
  component: React.FC
}

const STORAGE_KEY = "statusbar-widgets"
const DEFAULT_WIDGETS: WidgetId[] = ["time", "date", "weather", "aqi"]

function loadWidgets(): WidgetId[] {
  if (typeof window === "undefined") return DEFAULT_WIDGETS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_WIDGETS
    const parsed = JSON.parse(raw) as WidgetId[]
    if (!Array.isArray(parsed)) return DEFAULT_WIDGETS
    return parsed
  } catch {
    return DEFAULT_WIDGETS
  }
}

function saveWidgets(ids: WidgetId[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
}

// ── Static widget wrapper ─────────────────────────────────────────────────

function WidgetWrapper({ children, variant }: { children: React.ReactNode; variant?: "warning" }) {
  return (
    <div className={cn(
      "flex min-h-9 items-center gap-1.5 rounded-lg border px-2.5 py-1",
      variant === "warning"
        ? "border-amber-400/20 bg-amber-400/5"
        : "border-border/20 bg-muted/10",
    )}>
      {children}
    </div>
  )
}



// ── StatusBar (main export) ────────────────────────────────────────────────

const NOTIF_ICONS: Record<NotificationType, typeof Bell> = {
  timer: Timer,
  alarm: Clock,
  meeting: CalendarDays,
  email: Mail,
  chat: MessageSquare,
  info: Info,
}

const NOTIF_COLORS: Record<NotificationType, string> = {
  timer: "text-emerald-400",
  alarm: "text-amber-400",
  meeting: "text-blue-400",
  email: "text-violet-400",
  chat: "text-cyan-400",
  info: "text-muted-foreground",
}

export function StatusBar() {
  const [widgets, setWidgets] = useState<WidgetId[]>(DEFAULT_WIDGETS)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setWidgets(loadWidgets())
    setHydrated(true)
  }, [])
  const [managerOpen, setManagerOpen] = useState(false)
  const [draggingId, setDraggingId] = useState<WidgetId | null>(null)
  const [dropTargetId, setDropTargetId] = useState<WidgetId | null>(null)
  const [dropPosition, setDropPosition] = useState<"above" | "below">("above")

  const toggleWidget = useCallback((id: WidgetId) => {
    setWidgets((prev) => {
      const next = prev.includes(id) ? prev.filter((w) => w !== id) : [...prev, id]
      saveWidgets(next)
      return next
    })
  }, [])

  const moveWidget = useCallback((id: WidgetId, direction: "up" | "down") => {
    setWidgets((prev) => {
      const idx = prev.indexOf(id)
      if (idx === -1) return prev
      const targetIdx = direction === "up" ? idx - 1 : idx + 1
      if (targetIdx < 0 || targetIdx >= prev.length) return prev
      const next = [...prev]
      next.splice(idx, 1)
      next.splice(targetIdx, 0, id)
      saveWidgets(next)
      return next
    })
  }, [])

  // Build ordered list: enabled first (in order), then disabled
  const enabledWidgets = widgets.map((id) => WIDGET_REGISTRY.find((w) => w.id === id)!).filter(Boolean)
  const disabledWidgets = WIDGET_REGISTRY.filter((w) => !widgets.includes(w.id))

  return (
    <div className="zone-surface zone-status flex h-full items-center justify-between gap-3 overflow-visible px-4">
      {/* Left cluster: user-customizable widgets */}
      <div className="flex items-center gap-2">
        {widgets.map((id) => {
          const def = WIDGET_REGISTRY.find((w) => w.id === id)
          if (!def) return null
          const Comp = def.component
          return <Comp key={id} />
        })}

        {/* Widget manager trigger */}
        <button
          onClick={() => setManagerOpen(true)}
          className="flex min-h-9 items-center gap-1.5 rounded-lg border border-dashed border-border/20 px-2.5 py-1 text-muted-foreground/30 transition-colors hover:border-border/40 hover:bg-muted/10 hover:text-muted-foreground/60"
          title="Manage widgets"
        >
          <Settings2 className="size-3.5" />
        </button>
      </div>

      {/* Center — notifications moved to header */}
      <div />

      {/* Right cluster: dashboard tabs */}
      <div className="flex items-center gap-3">
        <DashboardTabs />
      </div>

      {/* Widget Manager Panel (no blur overlay so footer stays readable) */}
      {managerOpen && typeof document !== "undefined" && createPortal(
        <>
          {/* Overlay: dim only, no blur */}
          <div
            className="fixed inset-0 z-50 bg-black/10"
            onClick={() => setManagerOpen(false)}
          />
          {/* Panel centered between header and footer */}
          <div
            className="fixed z-50 flex flex-col overflow-hidden rounded-xl bg-background text-sm ring-1 ring-foreground/10 shadow-lg"
            style={{
              top: "4.5rem",
              left: "50%",
              bottom: "3.5rem",
              transform: "translateX(-50%)",
              maxWidth: "min(480px, 90vw)",
              width: "min(480px, 90vw)",
            }}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-border/20 px-4 py-3">
              <h2 className="font-[family-name:var(--font-display)] text-sm font-bold tracking-tight">
                Widgets
              </h2>
              <button
                onClick={() => setManagerOpen(false)}
                className="flex size-11 items-center justify-center rounded-md text-muted-foreground/40 transition-colors hover:bg-muted/30 hover:text-muted-foreground"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-1.5 py-1.5">
              <div className="flex flex-col">
                {[...enabledWidgets, ...disabledWidgets].map((w) => {
                  const Icon = w.icon
                  const enabled = widgets.includes(w.id)
                  const enabledIdx = widgets.indexOf(w.id)
                  const isFirst = enabledIdx === 0
                  const isLast = enabledIdx === widgets.length - 1

                  return (
                    <div key={w.id} className="relative">
                      {/* Drop indicator line */}
                      {enabled && dropTargetId === w.id && draggingId !== w.id && (
                        <div className={cn(
                          "absolute left-3 right-3 h-0.5 rounded-full bg-primary/60",
                          dropPosition === "above" ? "-top-px" : "-bottom-px"
                        )} />
                      )}
                      <div
                        className={cn(
                          "flex items-center gap-1 rounded-md px-1 py-1 transition-all",
                          enabled && draggingId === w.id && "scale-[0.97] opacity-30",
                          enabled && draggingId && draggingId !== w.id && "transition-transform"
                        )}
                        draggable={enabled}
                        onDragStart={(e) => {
                          if (!enabled) return
                          setDraggingId(w.id)
                          e.dataTransfer.effectAllowed = "move"
                          const el = e.currentTarget
                          e.dataTransfer.setDragImage(el, el.offsetWidth / 2, el.offsetHeight / 2)
                        }}
                        onDragOver={(e) => {
                          if (!enabled) return
                          e.preventDefault()
                          e.dataTransfer.dropEffect = "move"
                          const rect = e.currentTarget.getBoundingClientRect()
                          const midY = rect.top + rect.height / 2
                          setDropPosition(e.clientY < midY ? "above" : "below")
                          setDropTargetId(w.id)
                        }}
                        onDragLeave={() => {
                          setDropTargetId((prev) => prev === w.id ? null : prev)
                        }}
                        onDrop={(e) => {
                          e.preventDefault()
                          if (draggingId && draggingId !== w.id && enabled) {
                            setWidgets((prev) => {
                              const next = [...prev]
                              const fromIdx = next.indexOf(draggingId)
                              let toIdx = next.indexOf(w.id)
                              if (fromIdx === -1 || toIdx === -1) return prev
                              next.splice(fromIdx, 1)
                              toIdx = next.indexOf(w.id)
                              if (dropPosition === "below") toIdx += 1
                              next.splice(toIdx, 0, draggingId)
                              saveWidgets(next)
                              return next
                            })
                          }
                          setDraggingId(null)
                          setDropTargetId(null)
                        }}
                        onDragEnd={() => {
                          setDraggingId(null)
                          setDropTargetId(null)
                        }}
                      >
                        {enabled ? (
                          <div className="flex shrink-0 cursor-grab items-center px-1 text-muted-foreground/20 active:cursor-grabbing">
                            <GripVertical className="size-3" />
                          </div>
                        ) : (
                          <div className="shrink-0 px-1"><div className="size-3" /></div>
                        )}
                        <Icon className={cn("size-3.5 shrink-0", enabled ? "text-muted-foreground/60" : "text-muted-foreground/15")} />
                        <span className={cn("flex-1 px-1 text-xs", enabled ? "text-foreground/80" : "text-muted-foreground/30")}>{w.label}</span>
                        {enabled && (
                          <div className="flex shrink-0 items-center">
                            <button
                              onClick={() => moveWidget(w.id, "up")}
                              disabled={isFirst}
                              className={cn(
                                "flex size-11 items-center justify-center rounded-md transition-colors",
                                isFirst ? "text-muted-foreground/10" : "text-muted-foreground/30 hover:bg-muted/30 hover:text-muted-foreground/60"
                              )}
                            >
                              <ChevronUp className="size-4" />
                            </button>
                            <button
                              onClick={() => moveWidget(w.id, "down")}
                              disabled={isLast}
                              className={cn(
                                "flex size-11 items-center justify-center rounded-md transition-colors",
                                isLast ? "text-muted-foreground/10" : "text-muted-foreground/30 hover:bg-muted/30 hover:text-muted-foreground/60"
                              )}
                            >
                              <ChevronDown className="size-4" />
                            </button>
                          </div>
                        )}
                        <button
                          onClick={() => toggleWidget(w.id)}
                          className={cn(
                            "flex size-11 shrink-0 items-center justify-center rounded-md transition-colors",
                            enabled
                              ? "text-primary/60 hover:bg-primary/10 hover:text-primary"
                              : "text-muted-foreground/20 hover:bg-muted/30 hover:text-muted-foreground/40"
                          )}
                        >
                          {enabled ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  )
}

// ── Widget Components ──────────────────────────────────────────────────────

function TimeWidgetInner() {
  const [time, setTime] = useState<Date | null>(null)

  useEffect(() => {
    setTime(new Date())
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  if (!time) return null

  const hours = time.getHours()
  const minutes = time.getMinutes()
  const ampm = hours >= 12 ? "PM" : "AM"
  const display = `${hours % 12 || 12}:${String(minutes).padStart(2, "0")}`

  return (
    <WidgetWrapper>
      <Clock className="size-3.5 text-muted-foreground/40" />
      <span className="font-[family-name:var(--font-display)] text-base font-bold tabular-nums tracking-tight text-foreground">
        {display}
      </span>
      <span className="font-mono text-xs text-muted-foreground/50">
        {ampm}
      </span>
    </WidgetWrapper>
  )
}

function DateWidgetInner() {
  const [date, setDate] = useState<Date | null>(null)

  useEffect(() => {
    setDate(new Date())
    const id = setInterval(() => setDate(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  if (!date) return null

  return (
    <WidgetWrapper>
      <Calendar className="size-3.5 text-muted-foreground/40" />
      <span className="font-mono text-xs tabular-nums text-muted-foreground/60">
        {date.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        })}
      </span>
    </WidgetWrapper>
  )
}

// ── Weather Widget ──────────────────────────────────────────────────────────

interface WeatherData {
  temp: number
  feelsLike: number
  description: string
  icon: string
  humidity: number
  windSpeed: number
  city: string
}

const WEATHER_ICONS: Record<string, typeof Sun> = {
  "01": Sun,
  "02": CloudSun,
  "03": Cloud,
  "04": Cloud,
  "09": CloudRain,
  "10": CloudRain,
  "11": CloudLightning,
  "13": CloudSnow,
  "50": CloudFog,
}

function WeatherWidgetInner() {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [error, setError] = useState<"loading" | "no-location" | "fetch-error" | null>("loading")
  const [retryCount, setRetryCount] = useState(0)
  const [changingCity, setChangingCity] = useState(false)

  const handleCitySelect = useCallback((r: GeoSearchResult) => {
    setManualGeo({ latitude: r.latitude, longitude: r.longitude, city: r.name })
    setChangingCity(false)
  }, [])

  const requestLocation = useCallback(async () => {
    setError("loading")
    const success = await requestBrowserLocation()
    if (success) {
      // useGeoChange will handle the re-fetch via notifyGeoListeners
    } else {
      setError("no-location")
    }
  }, [])

  // Instant sync: when geo changes (from any widget), re-fetch
  useGeoChange(useCallback(() => {
    setError("loading")
    setWeather(null)
    setRetryCount((c) => c + 1)
  }, []))

  useEffect(() => {
    let cancelled = false

    async function fetchWeather() {
      try {
        const geo = await getGeo()
        if (!geo) {
          if (!cancelled) setError("no-location")
          return
        }
        const { latitude, longitude, city } = geo

        const weatherRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&temperature_unit=celsius`
        )
        if (!weatherRes.ok) {
          if (!cancelled) setError("fetch-error")
          return
        }
        const data: { current: { temperature_2m: number; apparent_temperature: number; weather_code: number; relative_humidity_2m: number; wind_speed_10m: number } } = await weatherRes.json()
        const c = data.current

        if (!cancelled) {
          setWeather({
            temp: Math.round(c.temperature_2m),
            feelsLike: Math.round(c.apparent_temperature),
            description: wmoCodeToDescription(c.weather_code),
            icon: wmoCodeToIcon(c.weather_code),
            humidity: c.relative_humidity_2m,
            windSpeed: Math.round(c.wind_speed_10m),
            city: city ?? "Unknown",
          })
          setError(null)
        }
      } catch {
        if (!cancelled) setError("fetch-error")
      }
    }

    fetchWeather()
    const interval = setInterval(fetchWeather, 10 * 60 * 1000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [retryCount])

  if (error && error !== "loading") {
    return (
      <WidgetWrapper variant="warning">
        <Popover>
          <PopoverTrigger asChild>
            <button className="flex items-center gap-1.5 transition-colors">
              <TriangleAlert className="size-3.5 shrink-0 text-amber-400/60" />
              <span className="font-mono text-xs text-muted-foreground/40">--°</span>
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" className="w-56">
            <LocationErrorContent
              error={error as "no-location" | "fetch-error"}
              onRequestLocation={requestLocation}
              onRetry={requestLocation}
            />
          </PopoverContent>
        </Popover>
      </WidgetWrapper>
    )
  }

  if (!weather) return (
    <WidgetWrapper>
      <Sun className="size-3.5 shrink-0 animate-pulse text-amber-400/30" />
      <span className="font-mono text-xs text-muted-foreground/20">--°</span>
    </WidgetWrapper>
  )

  const WeatherIcon = WEATHER_ICONS[weather.icon] ?? CloudSun

  return (
    <WidgetWrapper>
      <Popover onOpenChange={(open) => { if (!open) setChangingCity(false) }}>
        <PopoverTrigger asChild>
          <button className="flex items-center gap-1.5 transition-colors">
            <WeatherIcon className="size-3.5 shrink-0 text-amber-400/80" />
            <span className="font-mono text-xs font-bold tabular-nums text-foreground">{weather.temp}°</span>
          </button>
        </PopoverTrigger>
        <PopoverContent side="top" className="w-56">
          {changingCity ? (
            <CitySearchContent onBack={() => setChangingCity(false)} onSelect={handleCitySelect} onRequestLocation={() => { clearManualGeo(); requestLocation(); setChangingCity(false) }} />
          ) : (
            <>
              <div className="mb-2 flex items-center justify-between">
                <p className="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {weather.city}
                </p>
                <button
                  onClick={() => setChangingCity(true)}
                  className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground/50 transition-colors hover:bg-muted/30 hover:text-muted-foreground"
                >
                  <MapPin className="size-2.5" />
                  Change
                </button>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Condition</span>
                  <span>{weather.description}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Feels like</span>
                  <span>{weather.feelsLike}°C</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Humidity</span>
                  <span>{weather.humidity}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Wind</span>
                  <span>{weather.windSpeed} km/h</span>
                </div>
              </div>
            </>
          )}
        </PopoverContent>
      </Popover>
    </WidgetWrapper>
  )
}

// WMO weather codes to description/icon
function wmoCodeToDescription(code: number): string {
  if (code === 0) return "Clear"
  if (code <= 3) return "Partly cloudy"
  if (code <= 49) return "Fog"
  if (code <= 59) return "Drizzle"
  if (code <= 69) return "Rain"
  if (code <= 79) return "Snow"
  if (code <= 84) return "Showers"
  if (code <= 89) return "Snow showers"
  return "Thunderstorm"
}

function wmoCodeToIcon(code: number): string {
  if (code === 0) return "01"
  if (code <= 3) return "02"
  if (code <= 49) return "50"
  if (code <= 59) return "09"
  if (code <= 69) return "10"
  if (code <= 79) return "13"
  if (code <= 84) return "09"
  if (code <= 89) return "13"
  return "11"
}

// ── Air Quality Widget ──────────────────────────────────────────────────────

interface AQIData {
  aqi: number
  pm25: number
  pm10: number
  label: string
  color: string
}

function aqiToLabel(aqi: number): { label: string; color: string } {
  if (aqi <= 50) return { label: "Good", color: "text-emerald-400" }
  if (aqi <= 100) return { label: "Moderate", color: "text-amber-400" }
  if (aqi <= 150) return { label: "Unhealthy (sensitive)", color: "text-orange-400" }
  if (aqi <= 200) return { label: "Unhealthy", color: "text-red-400" }
  if (aqi <= 300) return { label: "Very unhealthy", color: "text-purple-400" }
  return { label: "Hazardous", color: "text-rose-500" }
}

function AirQualityWidgetInner() {
  const [aqi, setAqi] = useState<AQIData | null>(null)
  const [error, setError] = useState<"loading" | "no-location" | "fetch-error" | null>("loading")
  const [retryCount, setRetryCount] = useState(0)
  const [changingCity, setChangingCity] = useState(false)

  const requestLocation = useCallback(async () => {
    setError("loading")
    const success = await requestBrowserLocation()
    if (success) {
      // useGeoChange will handle the re-fetch via notifyGeoListeners
    } else {
      setError("no-location")
    }
  }, [])

  const handleCitySelect = useCallback((r: GeoSearchResult) => {
    setManualGeo({ latitude: r.latitude, longitude: r.longitude, city: r.name })
    setChangingCity(false)
  }, [])

  // Instant sync: when geo changes (from any widget), re-fetch
  useGeoChange(useCallback(() => {
    setError("loading")
    setAqi(null)
    setRetryCount((c) => c + 1)
  }, []))

  useEffect(() => {
    let cancelled = false

    async function fetchAQI() {
      try {
        const geo = await getGeo()
        if (!geo) {
          if (!cancelled) setError("no-location")
          return
        }
        const { latitude, longitude } = geo

        const res = await fetch(
          `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latitude}&longitude=${longitude}&current=us_aqi,pm2_5,pm10`
        )
        if (!res.ok) {
          if (!cancelled) setError("fetch-error")
          return
        }
        const data: { current: { us_aqi: number; pm2_5: number; pm10: number } } = await res.json()
        const c = data.current

        if (!cancelled) {
          const usAqi = Math.round(c.us_aqi)
          const { label, color } = aqiToLabel(usAqi)
          setAqi({
            aqi: usAqi,
            pm25: Math.round(c.pm2_5 * 10) / 10,
            pm10: Math.round(c.pm10 * 10) / 10,
            label,
            color,
          })
          setError(null)
        }
      } catch {
        if (!cancelled) setError("fetch-error")
      }
    }

    fetchAQI()
    const interval = setInterval(fetchAQI, 15 * 60 * 1000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [retryCount])

  if (error && error !== "loading") {
    return (
      <WidgetWrapper variant="warning">
        <Popover>
          <PopoverTrigger asChild>
            <button className="flex items-center gap-1.5 transition-colors">
              <TriangleAlert className="size-3.5 shrink-0 text-amber-400/60" />
              <span className="font-mono text-xs text-muted-foreground/40">AQI --</span>
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" className="w-56">
            <LocationErrorContent
              error={error as "no-location" | "fetch-error"}
              onRequestLocation={requestLocation}
              onRetry={requestLocation}
            />
          </PopoverContent>
        </Popover>
      </WidgetWrapper>
    )
  }

  if (!aqi) return (
    <WidgetWrapper>
      <Wind className="size-3.5 shrink-0 animate-pulse text-muted-foreground/20" />
      <span className="font-mono text-xs text-muted-foreground/20">AQI --</span>
    </WidgetWrapper>
  )

  return (
    <WidgetWrapper>
      <Popover onOpenChange={(open) => { if (!open) setChangingCity(false) }}>
        <PopoverTrigger asChild>
          <button className="flex items-center gap-1.5 transition-colors">
            <Wind className={cn("size-3.5 shrink-0", aqi.color)} />
            <span className="font-mono text-xs text-muted-foreground/50">AQI</span>
            <span className={cn("font-mono text-xs font-bold tabular-nums", aqi.color)}>{aqi.aqi}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent side="top" className="w-56">
          {changingCity ? (
            <CitySearchContent onBack={() => setChangingCity(false)} onSelect={handleCitySelect} onRequestLocation={() => { clearManualGeo(); requestLocation(); setChangingCity(false) }} />
          ) : (
            <>
              <div className="mb-2 flex items-center justify-between">
                <p className="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Air Quality
                </p>
                <button
                  onClick={() => setChangingCity(true)}
                  className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground/50 transition-colors hover:bg-muted/30 hover:text-muted-foreground"
                >
                  <MapPin className="size-2.5" />
                  Change
                </button>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">AQI</span>
                  <span className={cn("font-bold", aqi.color)}>{aqi.aqi} - {aqi.label}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">PM2.5</span>
                  <span>{aqi.pm25} ug/m3</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">PM10</span>
                  <span>{aqi.pm10} ug/m3</span>
                </div>
              </div>
            </>
          )}
        </PopoverContent>
      </Popover>
    </WidgetWrapper>
  )
}

// ── Pomodoro Widget ─────────────────────────────────────────────────────────

const POMO_WORK = 25 * 60 // 25 minutes
const POMO_BREAK = 5 * 60 // 5 minutes

type PomoPhase = "idle" | "work" | "break"

function PomodoroWidgetInner() {
  const { push: pushNotif } = useNotifications()
  const [phase, setPhase] = useState<PomoPhase>("idle")
  const [remaining, setRemaining] = useState(POMO_WORK)
  const [sessions, setSessions] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const cleanup = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  useEffect(() => cleanup, [cleanup])

  const startWork = useCallback(() => {
    cleanup()
    setPhase("work")
    setRemaining(POMO_WORK)
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          cleanup()
          setSessions((s) => s + 1)
          pushNotif("timer", "Focus session complete", {
            body: "Time for a break",
            ttl: 30_000,
          })
          setPhase("break")
          setRemaining(POMO_BREAK)
          intervalRef.current = setInterval(() => {
            setRemaining((br) => {
              if (br <= 1) {
                cleanup()
                pushNotif("timer", "Break over", {
                  body: "Ready for another session?",
                  ttl: 15_000,
                })
                setPhase("idle")
                setRemaining(POMO_WORK)
                return POMO_WORK
              }
              return br - 1
            })
          }, 1000)
          return POMO_BREAK
        }
        return r - 1
      })
    }, 1000)
  }, [cleanup, pushNotif])

  const stop = useCallback(() => {
    cleanup()
    setPhase("idle")
    setRemaining(POMO_WORK)
  }, [cleanup])

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0")
  const ss = String(remaining % 60).padStart(2, "0")

  if (phase === "idle") {
    return (
      <WidgetWrapper>
        <button onClick={startWork} className="text-muted-foreground/40 transition-colors hover:text-primary" title="Start Pomodoro">
          <CircleDot className="size-3.5" />
        </button>
      </WidgetWrapper>
    )
  }

  const isBreak = phase === "break"

  return (
    <WidgetWrapper>
      {isBreak ? (
        <Coffee className="size-3.5 text-emerald-400" />
      ) : (
        <CircleDot className="size-3.5 text-primary" />
      )}
      <span className={cn("font-mono text-xs font-bold tabular-nums", isBreak ? "text-emerald-400" : "text-primary")}>
        {mm}:{ss}
      </span>
      {sessions > 0 && (
        <span className="font-mono text-xs text-muted-foreground/40">x{sessions}</span>
      )}
      <button onClick={stop} className="text-muted-foreground/30 transition-colors hover:text-muted-foreground" title="Stop">
        <X className="size-3" />
      </button>
    </WidgetWrapper>
  )
}

// ── Timer Widget ───────────────────────────────────────────────────────────

function TimerWidgetInner() {
  const [seconds, setSeconds] = useState(0)
  const [running, setRunning] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const start = useCallback(() => {
    if (running) return
    setRunning(true)
    intervalRef.current = setInterval(() => {
      setSeconds((s) => s + 1)
    }, 1000)
  }, [running])

  const pause = useCallback(() => {
    setRunning(false)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const reset = useCallback(() => {
    pause()
    setSeconds(0)
  }, [pause])

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0")
  const ss = String(seconds % 60).padStart(2, "0")

  return (
    <WidgetWrapper>
      {(running || seconds > 0) && (
        <span className={cn("font-mono text-xs tabular-nums", running ? "text-primary" : "text-muted-foreground")}>
          {mm}:{ss}
        </span>
      )}
      {!running ? (
        <button onClick={start} className="text-muted-foreground/50 transition-colors hover:text-primary" title="Start stopwatch">
          {seconds > 0 ? <Play className="size-3.5" /> : <Timer className="size-3.5" />}
        </button>
      ) : (
        <button onClick={pause} className="text-primary transition-colors" title="Pause">
          <Pause className="size-3.5" />
        </button>
      )}
      {seconds > 0 && (
        <button onClick={reset} className="text-muted-foreground/30 transition-colors hover:text-muted-foreground" title="Reset">
          <RotateCcw className="size-3" />
        </button>
      )}
    </WidgetWrapper>
  )
}

// ── Countdown Timer Widget ────────────────────────────────────────────────

const TIMER_PRESETS = [
  { label: "1m", value: 1 },
  { label: "5m", value: 5 },
  { label: "10m", value: 10 },
  { label: "30m", value: 30 },
  { label: "1h", value: 60 },
] as const

function CountdownWidgetInner() {
  const { timer, start, cancel } = useCountdownTimer()
  const [minutes, setMinutes] = useState(5)
  const [customMode, setCustomMode] = useState(false)
  const [customInput, setCustomInput] = useState("")
  const customRef = useRef<HTMLInputElement>(null)

  const increment = useCallback(() => setMinutes((m) => Math.min(m + 1, 120)), [])
  const decrement = useCallback(() => setMinutes((m) => Math.max(m - 1, 1)), [])

  const handleStart = useCallback(() => {
    start(minutes * 60)
  }, [minutes, start])

  if (!timer) {
    return (
      <WidgetWrapper>
        <Popover>
          <PopoverTrigger asChild>
            <button className="text-muted-foreground/40 transition-colors hover:text-primary" title="Start countdown timer">
              <Hourglass className="size-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" className="w-48 p-3">
            <p className="mb-2 font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Timer
            </p>

            {/* +/- control */}
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={decrement}
                disabled={minutes <= 1}
                className="flex size-8 items-center justify-center rounded-lg border border-border/20 text-muted-foreground transition-colors hover:bg-muted/20 hover:text-foreground disabled:opacity-20"
              >
                <Minus className="size-3.5" />
              </button>
              <div className="flex items-baseline gap-0.5">
                <span className="font-mono text-2xl font-bold tabular-nums text-foreground">{minutes}</span>
                <span className="font-mono text-xs text-muted-foreground/50">min</span>
              </div>
              <button
                onClick={increment}
                disabled={minutes >= 120}
                className="flex size-8 items-center justify-center rounded-lg border border-border/20 text-muted-foreground transition-colors hover:bg-muted/20 hover:text-foreground disabled:opacity-20"
              >
                <Plus className="size-3.5" />
              </button>
            </div>

            {/* Quick presets */}
            <div className="mt-2 flex flex-wrap justify-center gap-1">
              {TIMER_PRESETS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => { setMinutes(p.value); setCustomMode(false) }}
                  className={cn(
                    "rounded-md px-2 py-1 font-mono text-xs transition-colors",
                    !customMode && minutes === p.value
                      ? "bg-primary/15 font-bold text-primary"
                      : "text-muted-foreground/50 hover:bg-muted/20 hover:text-foreground",
                  )}
                >
                  {p.label}
                </button>
              ))}
              <button
                onClick={() => {
                  setCustomMode(true)
                  setCustomInput(String(minutes))
                  setTimeout(() => customRef.current?.focus(), 50)
                }}
                className={cn(
                  "rounded-md px-2 py-1 font-mono text-xs transition-colors",
                  customMode
                    ? "bg-primary/15 font-bold text-primary"
                    : "text-muted-foreground/50 hover:bg-muted/20 hover:text-foreground",
                )}
              >
                Custom
              </button>
            </div>

            {/* Custom input */}
            {customMode && (
              <div className="mt-2 flex items-center justify-center gap-1.5">
                <input
                  ref={customRef}
                  type="number"
                  min="1"
                  max="480"
                  value={customInput}
                  onChange={(e) => {
                    setCustomInput(e.target.value)
                    const v = parseInt(e.target.value, 10)
                    if (!isNaN(v) && v >= 1 && v <= 480) setMinutes(v)
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter") handleStart() }}
                  className="w-16 rounded-md border border-border/20 bg-muted/10 px-2 py-1 text-center font-mono text-xs text-foreground outline-none focus:border-primary/30"
                />
                <span className="font-mono text-xs text-muted-foreground/40">min</span>
              </div>
            )}

            {/* Start button */}
            <button
              onClick={handleStart}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary/15 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/25"
            >
              <Play className="size-3" />
              Start
            </button>
          </PopoverContent>
        </Popover>
      </WidgetWrapper>
    )
  }

  // Active timer -- show countdown
  const mm = String(Math.floor(timer.remaining / 60)).padStart(2, "0")
  const ss = String(timer.remaining % 60).padStart(2, "0")

  return (
    <WidgetWrapper>
      <Hourglass className="size-3.5 text-amber-400" />
      <span className="font-mono text-xs font-bold tabular-nums text-amber-400">
        {mm}:{ss}
      </span>
      <button onClick={cancel} className="text-muted-foreground/30 transition-colors hover:text-muted-foreground" title="Cancel timer">
        <X className="size-3" />
      </button>
    </WidgetWrapper>
  )
}

// ── Battery Widget ─────────────────────────────────────────────────────────

interface BatteryManager extends EventTarget {
  charging: boolean
  level: number
  addEventListener(type: "levelchange" | "chargingchange", listener: () => void): void
  removeEventListener(type: "levelchange" | "chargingchange", listener: () => void): void
}

function BatteryWidgetInner() {
  const [battery, setBattery] = useState<{ level: number; charging: boolean } | null>(null)

  useEffect(() => {
    let mgr: BatteryManager | null = null
    const nav = navigator as Navigator & { getBattery?: () => Promise<BatteryManager> }
    if (!nav.getBattery) return

    const update = () => {
      if (mgr) setBattery({ level: Math.round(mgr.level * 100), charging: mgr.charging })
    }

    nav.getBattery().then((b) => {
      mgr = b
      update()
      b.addEventListener("levelchange", update)
      b.addEventListener("chargingchange", update)
    }).catch(() => {})

    return () => {
      if (mgr) {
        mgr.removeEventListener("levelchange", update)
        mgr.removeEventListener("chargingchange", update)
      }
    }
  }, [])

  if (!battery) return (
    <WidgetWrapper>
      <BatteryFull className="size-3.5 text-muted-foreground/30" />
      <span className="font-mono text-xs text-muted-foreground/30">--%</span>
    </WidgetWrapper>
  )

  const Icon = battery.charging
    ? BatteryCharging
    : battery.level > 60
      ? BatteryFull
      : battery.level > 30
        ? BatteryMedium
        : battery.level > 15
          ? BatteryLow
          : BatteryWarning

  const color = battery.charging
    ? "text-emerald-400"
    : battery.level > 30
      ? "text-emerald-400/70"
      : battery.level > 15
        ? "text-amber-400"
        : "text-red-400"

  return (
    <WidgetWrapper>
      <Icon className={cn("size-3.5", color)} />
      <span className={cn("font-mono text-xs font-bold tabular-nums", color)}>
        {battery.level}%
      </span>
    </WidgetWrapper>
  )
}

// ── Network Widget ────────────────────────────────────────────────────────

// ── Sunrise/Sunset Widget ─────────────────────────────────────────────────

function SunriseSunsetWidgetInner() {
  const [data, setData] = useState<{ sunrise: string; sunset: string; isDay: boolean } | null>(null)

  const fetchSun = useCallback(async () => {
    const geo = await getGeo()
    if (!geo) return
    try {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${geo.latitude}&longitude=${geo.longitude}&daily=sunrise,sunset&timezone=auto&forecast_days=1`
      )
      if (!res.ok) return
      const json = await res.json() as { daily: { sunrise: string[]; sunset: string[] } }
      const now = new Date()
      const rise = new Date(json.daily.sunrise[0])
      const set = new Date(json.daily.sunset[0])
      setData({
        sunrise: rise.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
        sunset: set.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
        isDay: now >= rise && now < set,
      })
    } catch {}
  }, [])

  useEffect(() => {
    fetchSun()
    const interval = setInterval(fetchSun, 10 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchSun])

  useGeoChange(fetchSun)

  if (!data) return (
    <WidgetWrapper>
      <Sunrise className="size-3.5 animate-pulse text-amber-400/30" />
      <span className="font-mono text-xs text-muted-foreground/20">--:--</span>
    </WidgetWrapper>
  )

  const Icon = data.isDay ? Sunset : Sunrise
  const label = data.isDay ? data.sunset : data.sunrise
  const hint = data.isDay ? "Sunset" : "Sunrise"

  return (
    <WidgetWrapper>
      <Popover>
        <PopoverTrigger asChild>
          <button className="flex items-center gap-1.5 transition-colors">
            <Icon className="size-3.5 text-amber-400/70" />
            <span className="font-mono text-xs tabular-nums text-foreground/80">{label}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent side="top" className="w-40">
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Sunrise className="size-3 text-amber-400/60" />
                Sunrise
              </div>
              <span>{data.sunrise}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Sunset className="size-3 text-orange-400/60" />
                Sunset
              </div>
              <span>{data.sunset}</span>
            </div>
            <p className="pt-1 text-center text-xs text-muted-foreground/40">
              {data.isDay ? `${hint} at ${label}` : `${hint} at ${label}`}
            </p>
          </div>
        </PopoverContent>
      </Popover>
    </WidgetWrapper>
  )
}

// ── Humidity Widget ───────────────────────────────────────────────────────

function HumidityWidgetInner() {
  const [humidity, setHumidity] = useState<number | null>(null)

  const fetchHumidity = useCallback(async () => {
    const geo = await getGeo()
    if (!geo) return
    try {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${geo.latitude}&longitude=${geo.longitude}&current=relative_humidity_2m`
      )
      if (!res.ok) return
      const json = await res.json() as { current: { relative_humidity_2m: number } }
      setHumidity(json.current.relative_humidity_2m)
    } catch {}
  }, [])

  useEffect(() => {
    fetchHumidity()
    const interval = setInterval(fetchHumidity, 10 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchHumidity])

  useGeoChange(fetchHumidity)

  return (
    <WidgetWrapper>
      <Droplets className={cn("size-3.5", humidity !== null ? "text-cyan-400/70" : "animate-pulse text-cyan-400/30")} />
      <span className={cn("font-mono text-xs tabular-nums", humidity !== null ? "font-bold text-foreground/80" : "text-muted-foreground/20")}>
        {humidity !== null ? `${humidity}%` : "--%"}
      </span>
    </WidgetWrapper>
  )
}

// ── Day Progress Widget ───────────────────────────────────────────────────

function DayProgressWidgetInner() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const calc = () => {
      const now = new Date()
      const elapsed = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()
      setProgress(Math.round((elapsed / 86400) * 100))
    }
    calc()
    const id = setInterval(calc, 30_000)
    return () => clearInterval(id)
  }, [])

  return (
    <WidgetWrapper>
      <Hourglass className="size-3.5 text-muted-foreground/40" />
      <span className="font-mono text-xs tabular-nums text-muted-foreground/60">{progress}%</span>
    </WidgetWrapper>
  )
}

// ── Uptime Widget ─────────────────────────────────────────────────────────

function UptimeWidgetInner() {
  const startRef = useRef(Date.now())
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [])

  const hours = Math.floor(elapsed / 3600)
  const mins = Math.floor((elapsed % 3600) / 60)
  const display = hours > 0
    ? `${hours}h ${String(mins).padStart(2, "0")}m`
    : `${mins}m`

  return (
    <WidgetWrapper>
      <Thermometer className="size-3.5 text-muted-foreground/40" />
      <span className="font-mono text-xs tabular-nums text-muted-foreground/60">{display}</span>
    </WidgetWrapper>
  )
}

// ── Widget Registry (must come after component definitions) ────────────────

const WIDGET_REGISTRY: WidgetDef[] = [
  { id: "time", label: "Time", icon: Clock, component: TimeWidgetInner },
  { id: "date", label: "Date", icon: Calendar, component: DateWidgetInner },
  { id: "weather", label: "Weather", icon: Sun, component: WeatherWidgetInner },
  { id: "aqi", label: "Air Quality", icon: Wind, component: AirQualityWidgetInner },
  { id: "sunrise-sunset", label: "Sunrise / Sunset", icon: Sunrise, component: SunriseSunsetWidgetInner },
  { id: "humidity", label: "Humidity", icon: Droplets, component: HumidityWidgetInner },
  { id: "battery", label: "Battery", icon: BatteryFull, component: BatteryWidgetInner },
  { id: "day-progress", label: "Day Progress", icon: Hourglass, component: DayProgressWidgetInner },
  { id: "uptime", label: "Session Uptime", icon: Thermometer, component: UptimeWidgetInner },
  { id: "pomodoro", label: "Pomodoro", icon: CircleDot, component: PomodoroWidgetInner },
  { id: "timer", label: "Stopwatch", icon: Timer, component: TimerWidgetInner },
  { id: "countdown", label: "Countdown Timer", icon: Hourglass, component: CountdownWidgetInner },
]

// ── Dashboard Tabs ─────────────────────────────────────────────────────────

import { createPortal } from "react-dom"
import { useDashboard } from "@/components/dashboard/DashboardContext"

function DashboardTabs() {
  const {
    dashboards,
    activeDashboardId,
    switchDashboard,
    createDashboard,
    renameDashboard,
    deleteDashboard,
    canCreateMore,
  } = useDashboard()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [contextId, setContextId] = useState<string | null>(null)
  const [menuPos, setMenuPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const contextRef = useRef<HTMLDivElement>(null)

  // Close context menu on outside click
  useEffect(() => {
    if (!contextId) return
    const handler = (e: PointerEvent) => {
      if (contextRef.current && !contextRef.current.contains(e.target as Node)) {
        setContextId(null)
      }
    }
    document.addEventListener("pointerdown", handler)
    return () => document.removeEventListener("pointerdown", handler)
  }, [contextId])

  // Only show tabs if there's more than 1 dashboard
  if (dashboards.length <= 1 && !canCreateMore) return null

  return (
    <div className="flex items-center gap-0.5">
      {dashboards.map((d) => (
        <div key={d.id}>
          {editingId === d.id ? (
            <input
              autoFocus
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={() => {
                if (editName.trim()) renameDashboard(d.id, editName.trim())
                setEditingId(null)
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (editName.trim()) renameDashboard(d.id, editName.trim())
                  setEditingId(null)
                }
                if (e.key === "Escape") setEditingId(null)
              }}
              className="h-6 w-20 rounded bg-muted/50 px-1.5 text-xs font-medium outline-none ring-1 ring-primary/30 font-[family-name:var(--font-mono)]"
            />
          ) : (
            <button
              onClick={() => switchDashboard(d.id)}
              onContextMenu={(e) => {
                e.preventDefault()
                const rect = e.currentTarget.getBoundingClientRect()
                setMenuPos({ x: rect.left, y: rect.top })
                setContextId(contextId === d.id ? null : d.id)
              }}
              className={cn(
                "h-6 rounded px-2 text-xs font-medium transition-colors font-[family-name:var(--font-mono)]",
                d.id === activeDashboardId
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/30"
              )}
            >
              {d.name}
            </button>
          )}
        </div>
      ))}
      {canCreateMore && (
        <button
          onClick={() => createDashboard(`Dashboard ${dashboards.length + 1}`)}
          className="flex size-6 items-center justify-center rounded text-muted-foreground/30 transition-colors hover:bg-muted/30 hover:text-muted-foreground/60"
          title="New dashboard"
        >
          <Plus className="size-3" />
        </button>
      )}
      {/* Portal-rendered context menu */}
      {contextId && typeof document !== "undefined" && createPortal(
        <div
          ref={contextRef}
          className="fixed z-[9999] w-32 overflow-hidden rounded-lg border border-border/30 bg-card/95 py-1 shadow-xl backdrop-blur-md"
          style={{ left: menuPos.x, top: menuPos.y - 4, transform: "translateY(-100%)" }}
        >
          <button
            onClick={() => {
              const d = dashboards.find((dd) => dd.id === contextId)
              if (d) {
                setEditName(d.name)
                setEditingId(d.id)
              }
              setContextId(null)
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-foreground/70 hover:bg-muted/30"
          >
            <Pencil className="size-3" />
            Rename
          </button>
          {dashboards.length > 1 && (
            <button
              onClick={() => {
                deleteDashboard(contextId)
                setContextId(null)
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-destructive hover:bg-muted/30"
            >
              <Trash2 className="size-3" />
              Delete
            </button>
          )}
        </div>,
        document.body
      )}
    </div>
  )
}

// ── Connect service button (used in notification popover) ───────────────────

function ConnectServiceButton({ service, label, icon, scopes }: {
  service: "gmail" | "chat"
  label: string
  icon: React.ReactNode
  scopes: string
}) {
  const [clientId, setClientId] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/google-services?action=client-id")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        const data = d as { clientId?: string } | null
        if (data?.clientId) setClientId(data.clientId)
      })
      .catch(() => {})
  }, [])

  const connect = async () => {
    if (!clientId) return
    const { codeVerifier, codeChallenge } = await generatePKCE()
    const redirectUri = `${window.location.origin}/api/google-services/callback`
    const state = btoa(JSON.stringify({ v: codeVerifier, r: redirectUri, s: service }))

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: scopes,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      state,
      access_type: "offline",
      prompt: "consent",
    })

    window.open(
      `${GOOGLE_AUTH_URL}?${params}`,
      `google-${service}-auth`,
      "width=500,height=700,left=200,top=100"
    )
  }

  return (
    <button
      onClick={connect}
      disabled={!clientId}
      className="flex w-full items-center gap-2 rounded-lg border border-border/20 px-3 py-2 text-xs transition-colors hover:border-border/30 hover:bg-muted/20 active:scale-[0.98] disabled:opacity-40"
    >
      {icon}
      <span className="text-foreground/80">{label}</span>
      <span className="ml-auto font-mono text-xs text-primary">Connect</span>
    </button>
  )
}

// ── Notification Ticker ─────────────────────────────────────────────────────

function NotificationTicker() {
  const { notifications, dismiss, activeCount } = useNotifications()
  const { unread, hasGmail, hasChat } = useGoogleNotifications()
  const active = notifications.filter((n) => !n.dismissed)

  const hasUnread = unread.gmail > 0 || unread.chat > 0
  const hasActive = active.length > 0
  const needsConnect = !hasGmail || !hasChat

  return (
    <div className="flex items-center gap-2 overflow-hidden">
      {/* Connect prompt for unlinked accounts */}
      {needsConnect && (
        <Popover>
          <PopoverTrigger asChild>
            <button className="flex items-center gap-1.5 rounded-full border border-border/20 bg-muted/10 px-2.5 py-1 text-xs text-muted-foreground/50 transition-colors hover:border-border/30 hover:bg-muted/20 hover:text-muted-foreground">
              <Bell className="size-3" />
              <span>Connect</span>
              {!hasGmail && <Mail className="size-2.5 text-violet-400/50" />}
              {!hasChat && <MessageSquare className="size-2.5 text-cyan-400/50" />}
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" className="w-56">
            <p className="mb-2 font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Notifications
            </p>
            <p className="mb-3 text-xs text-muted-foreground/60">
              Connect your accounts to receive notifications for new emails and messages.
            </p>
            <div className="space-y-1.5">
              {!hasGmail && (
                <ConnectServiceButton service="gmail" label="Gmail" icon={<Mail className="size-3 text-violet-400" />} scopes={GMAIL_SCOPES} />
              )}
              {!hasChat && (
                <ConnectServiceButton service="chat" label="Google Chat" icon={<MessageSquare className="size-3 text-cyan-400" />} scopes={CHAT_SCOPES} />
              )}
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Unread count badges */}
      {hasUnread && (
        <div className="flex items-center gap-1.5">
          {unread.gmail > 0 && (
            <div className="flex items-center gap-1 rounded-full border border-violet-400/20 bg-violet-400/10 px-2 py-0.5">
              <Mail className="size-2.5 text-violet-400" />
              <span className="font-mono text-xs font-bold tabular-nums text-violet-400">
                {unread.gmail}
              </span>
            </div>
          )}
          {unread.chat > 0 && (
            <div className="flex items-center gap-1 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-0.5">
              <MessageSquare className="size-2.5 text-cyan-400" />
              <span className="font-mono text-xs font-bold tabular-nums text-cyan-400">
                {unread.chat}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Active notification count + pills */}
      {hasActive && (
        <>
          <div className="flex items-center gap-1">
            <Bell className="size-3 text-primary" />
            <span className="font-mono text-xs font-bold text-primary">
              {activeCount}
            </span>
          </div>

          <div className="flex items-center gap-1.5 overflow-hidden">
            {active.slice(0, 5).map((notif) => {
              const Icon = NOTIF_ICONS[notif.type]
              const color = NOTIF_COLORS[notif.type]

              return (
                <div
                  key={notif.id}
                  className={cn(
                    "group flex items-center gap-1.5 rounded-full border border-border/30 bg-muted/20 px-2 py-0.5 transition-all",
                    notif.dismissed && "scale-95 opacity-0"
                  )}
                >
                  <Icon className={cn("size-2.5 shrink-0", color)} />
                  <span className="max-w-[140px] truncate text-xs text-foreground/80">
                    {notif.title}
                  </span>
                  {notif.body && (
                    <span className="max-w-[80px] truncate text-xs text-muted-foreground/50">
                      {notif.body}
                    </span>
                  )}
                  <button
                    onClick={() => dismiss(notif.id)}
                    className="shrink-0 size-11 flex items-center justify-center"
                  >
                    <X className="size-2.5 text-muted-foreground/30 hover:text-foreground" />
                  </button>
                </div>
              )
            })}
            {active.length > 5 && (
              <span className="shrink-0 font-mono text-xs text-muted-foreground/40">
                +{active.length - 5}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  )
}
