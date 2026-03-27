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
  CircleDot,
  Coffee,
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

const NOTIF_ICONS: Record<NotificationType, typeof Bell> = {
  timer: Timer,
  alarm: Clock,
  meeting: CalendarDays,
  email: Mail,
  info: Info,
}

const NOTIF_COLORS: Record<NotificationType, string> = {
  timer: "text-emerald-400",
  alarm: "text-amber-400",
  meeting: "text-blue-400",
  email: "text-violet-400",
  info: "text-muted-foreground",
}

export function StatusBar() {
  return (
    <div className="zone-surface zone-status flex h-full items-center justify-between gap-3 px-4">
      {/* Left cluster: clock + weather + air quality */}
      <div className="flex items-center gap-4">
        <ClockDisplay />
        <WeatherWidget />
        <AirQualityWidget />
      </div>

      {/* Center */}
      <NotificationTicker />

      {/* Right cluster: pomodoro + timer */}
      <div className="flex items-center gap-3">
        <PomodoroWidget />
        <TimerWidget />
      </div>
    </div>
  )
}

// ── Clock ───────────────────────────────────────────────────────────────────

function ClockDisplay() {
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
    <div className="flex items-baseline gap-1">
      <span className="font-[family-name:var(--font-display)] text-xl font-bold tabular-nums tracking-tight text-foreground">
        {display}
      </span>
      <span className="font-mono text-[0.5625rem] font-medium text-muted-foreground/60">
        {ampm}
      </span>
      <span className="ml-3 font-mono text-[0.625rem] tracking-wide text-muted-foreground/40">
        {time.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        })}
      </span>
    </div>
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

function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchWeather() {
      try {
        // Get location via IP geolocation (no permission needed)
        const geoRes = await fetch("https://ipapi.co/json/")
        if (!geoRes.ok) return
        const geo = await geoRes.json()
        const { latitude, longitude, city } = geo

        // Open-Meteo (free, no API key)
        const weatherRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&temperature_unit=celsius`
        )
        if (!weatherRes.ok) return
        const data = await weatherRes.json()
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
        }
      } catch {}
    }

    fetchWeather()
    const interval = setInterval(fetchWeather, 10 * 60 * 1000) // refresh every 10 min
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  if (!weather) return null

  const WeatherIcon = WEATHER_ICONS[weather.icon] ?? CloudSun

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1.5 rounded-md px-1.5 py-0.5 transition-colors hover:bg-foreground/[0.05]">
          <WeatherIcon className="size-3.5 text-amber-400/80" />
          <span className="font-[family-name:var(--font-display)] text-sm font-bold tabular-nums text-foreground">
            {weather.temp}°
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" className="w-48">
        <p className="mb-2 font-mono text-[0.625rem] font-medium uppercase tracking-wider text-muted-foreground">
          {weather.city}
        </p>
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
      </PopoverContent>
    </Popover>
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

function AirQualityWidget() {
  const [aqi, setAqi] = useState<AQIData | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchAQI() {
      try {
        const geoRes = await fetch("https://ipapi.co/json/")
        if (!geoRes.ok) return
        const geo = await geoRes.json()
        const { latitude, longitude } = geo

        // Open-Meteo Air Quality API (free, no key)
        const res = await fetch(
          `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latitude}&longitude=${longitude}&current=us_aqi,pm2_5,pm10`
        )
        if (!res.ok) return
        const data = await res.json()
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
        }
      } catch {}
    }

    fetchAQI()
    const interval = setInterval(fetchAQI, 15 * 60 * 1000) // refresh every 15 min
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  if (!aqi) return null

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1 rounded-md px-1.5 py-0.5 transition-colors hover:bg-foreground/[0.05]">
          <Wind className={cn("size-3", aqi.color)} />
          <span className={cn("font-mono text-[0.625rem] font-bold tabular-nums", aqi.color)}>
            {aqi.aqi}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" className="w-44">
        <p className="mb-2 font-mono text-[0.625rem] font-medium uppercase tracking-wider text-muted-foreground">
          Air Quality
        </p>
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
      </PopoverContent>
    </Popover>
  )
}

// ── Pomodoro Widget ─────────────────────────────────────────────────────────

const POMO_WORK = 25 * 60 // 25 minutes
const POMO_BREAK = 5 * 60 // 5 minutes

type PomoPhase = "idle" | "work" | "break"

function PomodoroWidget() {
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
          // Auto-start break
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
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={startWork}
        className="text-muted-foreground/40 hover:text-primary"
        title="Start Pomodoro"
      >
        <CircleDot className="size-3.5" />
      </Button>
    )
  }

  const isBreak = phase === "break"

  return (
    <div className="flex items-center gap-1.5">
      {isBreak ? (
        <Coffee className="size-3 text-emerald-400" />
      ) : (
        <CircleDot className="size-3 text-primary" />
      )}
      <span
        className={cn(
          "font-mono text-[0.625rem] font-bold tabular-nums",
          isBreak ? "text-emerald-400" : "text-primary"
        )}
      >
        {mm}:{ss}
      </span>
      {sessions > 0 && (
        <span className="font-mono text-[0.5rem] text-muted-foreground/40">
          x{sessions}
        </span>
      )}
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={stop}
        className="text-muted-foreground/30 hover:text-muted-foreground"
        title="Stop Pomodoro"
      >
        <X className="size-2.5" />
      </Button>
    </div>
  )
}

// ── Notification Ticker ─────────────────────────────────────────────────────

function NotificationTicker() {
  const { notifications, dismiss, activeCount } = useNotifications()
  const active = notifications.filter((n) => !n.dismissed)

  if (active.length === 0) return null

  return (
    <div className="flex items-center gap-2 overflow-hidden">
      <div className="flex items-center gap-1">
        <Bell className="size-3 text-primary" />
        <span className="font-mono text-[0.5625rem] font-bold text-primary">
          {activeCount}
        </span>
      </div>

      <div className="flex items-center gap-1.5 overflow-hidden">
        {active.slice(0, 3).map((notif) => {
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
              <span className="max-w-[140px] truncate text-[0.5625rem] text-foreground/80">
                {notif.title}
              </span>
              {notif.body && (
                <span className="max-w-[80px] truncate text-[0.5rem] text-muted-foreground/50">
                  {notif.body}
                </span>
              )}
              <button
                onClick={() => dismiss(notif.id)}
                className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X className="size-2.5 text-muted-foreground/30 hover:text-foreground" />
              </button>
            </div>
          )
        })}
        {active.length > 3 && (
          <span className="shrink-0 font-mono text-[0.5rem] text-muted-foreground/40">
            +{active.length - 3}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Timer ───────────────────────────────────────────────────────────────────

function TimerWidget() {
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
    <div className="flex items-center gap-2">
      {(running || seconds > 0) && (
        <span
          className={cn(
            "font-mono text-sm tabular-nums",
            running ? "text-primary" : "text-muted-foreground"
          )}
        >
          {mm}:{ss}
        </span>
      )}
      <div className="flex items-center gap-0.5">
        {!running ? (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={start}
            className="text-muted-foreground/50 hover:text-primary"
          >
            {seconds > 0 ? (
              <Play className="size-3" />
            ) : (
              <Timer className="size-3" />
            )}
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={pause}
            className="text-primary"
          >
            <Pause className="size-3" />
          </Button>
        )}
        {seconds > 0 && (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={reset}
            className="text-muted-foreground/30 hover:text-muted-foreground"
          >
            <RotateCcw className="size-2.5" />
          </Button>
        )}
      </div>
    </div>
  )
}
