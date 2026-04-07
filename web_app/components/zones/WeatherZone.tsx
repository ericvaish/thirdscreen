"use client"

import { useCallback, useEffect, useState } from "react"
import {
  CloudSun, Sun, Cloud, CloudRain, CloudLightning, CloudSnow, CloudFog,
  CloudDrizzle, Droplets, Wind,
} from "lucide-react"
import { useDashboard } from "@/components/dashboard/DashboardContext"
import { ZoneDragHandle } from "@/components/dashboard/ZoneDragHandle"
import { ZoneLabel } from "@/components/dashboard/ZoneLabel"
import { getGeo, useGeoChange } from "./StatusBar"

// ── WMO code mapping (reused from StatusBar pattern) ───────────────────────

const WMO_ICONS: Record<string, typeof Sun> = {
  "01": Sun,
  "02": CloudSun,
  "03": Cloud,
  "04": Cloud,
  "09": CloudDrizzle,
  "10": CloudRain,
  "11": CloudLightning,
  "13": CloudSnow,
  "50": CloudFog,
}

function wmoToIcon(code: number): string {
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

function wmoToDescription(code: number): string {
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

// ── Types ──────────────────────────────────────────────────────────────────

interface WeatherForecast {
  city: string
  current: {
    temp: number
    feelsLike: number
    code: number
    humidity: number
    windSpeed: number
  }
  hourly: {
    time: string // HH:MM
    temp: number
    code: number
  }[]
  daily: {
    day: string // "Mon", "Tue", etc.
    date: string // "Apr 8"
    tempMax: number
    tempMin: number
    code: number
  }[]
}

// ── Component ──────────────────────────────────────────────────────────────

export function WeatherZone() {
  const { editMode } = useDashboard()
  const [forecast, setForecast] = useState<WeatherForecast | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  useGeoChange(useCallback(() => {
    setForecast(null)
    setRetryCount((c) => c + 1)
  }, []))

  useEffect(() => {
    let cancelled = false

    async function fetchForecast() {
      try {
        const geo = await getGeo()
        if (!geo) return

        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${geo.latitude}&longitude=${geo.longitude}` +
          `&current=temperature_2m,apparent_temperature,weather_code,relative_humidity_2m,wind_speed_10m` +
          `&hourly=temperature_2m,weather_code` +
          `&daily=temperature_2m_max,temperature_2m_min,weather_code` +
          `&temperature_unit=celsius&timezone=auto&forecast_days=6`
        )
        if (!res.ok || cancelled) return

        const data = await res.json()
        const c = data.current

        // Find the current hour index in hourly data
        const nowIso = c.time as string
        const nowHour = new Date(nowIso).getHours()
        const hourlyTimes = data.hourly.time as string[]
        let startIdx = hourlyTimes.findIndex((t: string) => new Date(t).getHours() === nowHour && new Date(t).getDate() === new Date(nowIso).getDate())
        if (startIdx < 0) startIdx = 0

        // Next 12 hours
        const hourly = hourlyTimes.slice(startIdx, startIdx + 12).map((t: string, i: number) => ({
          time: new Date(t).toLocaleTimeString(undefined, { hour: "numeric", hour12: true }).replace(" ", ""),
          temp: Math.round(data.hourly.temperature_2m[startIdx + i]),
          code: data.hourly.weather_code[startIdx + i],
        }))

        // Daily (skip today, show next 5 days)
        const daily = (data.daily.time as string[]).slice(1, 6).map((t: string, i: number) => {
          const d = new Date(t + "T12:00:00")
          return {
            day: d.toLocaleDateString(undefined, { weekday: "short" }),
            date: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
            tempMax: Math.round(data.daily.temperature_2m_max[i + 1]),
            tempMin: Math.round(data.daily.temperature_2m_min[i + 1]),
            code: data.daily.weather_code[i + 1],
          }
        })

        if (!cancelled) {
          setForecast({
            city: geo.city ?? "Unknown",
            current: {
              temp: Math.round(c.temperature_2m),
              feelsLike: Math.round(c.apparent_temperature),
              code: c.weather_code,
              humidity: c.relative_humidity_2m,
              windSpeed: Math.round(c.wind_speed_10m),
            },
            hourly,
            daily,
          })
        }
      } catch {}
    }

    fetchForecast()
    const interval = setInterval(fetchForecast, 10 * 60 * 1000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [retryCount])

  const CurrentIcon = forecast ? (WMO_ICONS[wmoToIcon(forecast.current.code)] ?? CloudSun) : Sun

  return (
    <div className="zone-surface zone-weather flex h-full flex-col">
      {/* Header */}
      <div className={`flex shrink-0 items-center justify-between px-4 py-1.5 ${editMode ? "zone-drag-handle" : ""}`}>
        <div className="flex items-center gap-1.5">
          <ZoneDragHandle />
          <ZoneLabel accentVar="--zone-weather-accent" icon={<CloudSun className="size-4" />}>
            Weather
          </ZoneLabel>
        </div>
        {forecast && (
          <span className="text-xs text-muted-foreground/50">{forecast.city}</span>
        )}
      </div>

      {!forecast ? (
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <Sun className="size-5 animate-pulse" style={{ color: "var(--zone-weather-accent)", opacity: 0.3 }} />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col px-4 pb-3">
          {/* Current conditions */}
          <div className="flex items-center gap-3 py-2">
            <CurrentIcon className="size-8 shrink-0" style={{ color: "var(--zone-weather-accent)" }} />
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-[family-name:var(--font-display)] text-2xl font-bold tabular-nums">
                  {forecast.current.temp}°
                </span>
                <span className="text-xs text-muted-foreground">
                  {wmoToDescription(forecast.current.code)}
                </span>
              </div>
              <div className="flex gap-3 text-xs text-muted-foreground/50">
                <span>Feels {forecast.current.feelsLike}°</span>
                <span className="flex items-center gap-0.5"><Droplets className="size-2.5" />{forecast.current.humidity}%</span>
                <span className="flex items-center gap-0.5"><Wind className="size-2.5" />{forecast.current.windSpeed}km/h</span>
              </div>
            </div>
          </div>

          {/* Hourly strip */}
          <div className="mt-1 flex gap-0 overflow-x-auto border-y border-border/10 py-2">
            {forecast.hourly.map((h, i) => {
              const HIcon = WMO_ICONS[wmoToIcon(h.code)] ?? Cloud
              return (
                <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-0.5">
                  <span className="font-mono text-xs text-muted-foreground/40">{i === 0 ? "Now" : h.time}</span>
                  <HIcon className="size-3.5 text-muted-foreground/60" />
                  <span className="font-mono text-xs font-medium tabular-nums">{h.temp}°</span>
                </div>
              )
            })}
          </div>

          {/* Daily forecast */}
          <div className="mt-2 flex flex-1 flex-col justify-evenly">
            {forecast.daily.map((d) => {
              const DIcon = WMO_ICONS[wmoToIcon(d.code)] ?? Cloud
              const range = forecast.daily.reduce(
                (acc, dd) => ({ min: Math.min(acc.min, dd.tempMin), max: Math.max(acc.max, dd.tempMax) }),
                { min: Infinity, max: -Infinity }
              )
              const totalSpan = range.max - range.min || 1
              const barLeft = ((d.tempMin - range.min) / totalSpan) * 100
              const barWidth = ((d.tempMax - d.tempMin) / totalSpan) * 100

              return (
                <div key={d.date} className="flex items-center gap-2 text-xs">
                  <span className="w-8 shrink-0 text-muted-foreground/60">{d.day}</span>
                  <DIcon className="size-3.5 shrink-0 text-muted-foreground/50" />
                  <span className="w-7 shrink-0 text-right font-mono tabular-nums text-muted-foreground/40">{d.tempMin}°</span>
                  <div className="relative mx-1 h-1.5 min-w-0 flex-1 rounded-full bg-muted/20">
                    <div
                      className="absolute inset-y-0 rounded-full"
                      style={{
                        left: `${barLeft}%`,
                        width: `${Math.max(barWidth, 8)}%`,
                        background: "linear-gradient(to right, var(--zone-weather-accent), oklch(0.8 0.15 50))",
                        opacity: 0.7,
                      }}
                    />
                  </div>
                  <span className="w-7 shrink-0 font-mono tabular-nums">{d.tempMax}°</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
