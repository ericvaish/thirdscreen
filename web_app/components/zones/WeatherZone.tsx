"use client"

import {
  CloudSun, Sun, Cloud, CloudRain, CloudLightning, CloudSnow, CloudFog,
  CloudDrizzle, Droplets, Wind,
} from "lucide-react"
import { useDashboard } from "@/components/dashboard/DashboardContext"
import { ZoneDragHandle } from "@/components/dashboard/ZoneDragHandle"
import { ZoneLabel } from "@/components/dashboard/ZoneLabel"
import { useWeather, wmoToDescription, wmoToIconCode } from "@/lib/weather"

const WMO_ICONS: Record<string, typeof Sun> = {
  "01": Sun, "02": CloudSun, "03": Cloud, "04": Cloud,
  "09": CloudDrizzle, "10": CloudRain, "11": CloudLightning,
  "13": CloudSnow, "50": CloudFog,
}

export function WeatherZone() {
  const { editMode } = useDashboard()
  const weather = useWeather()

  const CurrentIcon = weather ? (WMO_ICONS[wmoToIconCode(weather.weatherCode)] ?? CloudSun) : Sun

  const hourly = weather?.hourly.slice(0, 12).map((h, i) => ({
    time: i === 0 ? "Now" : new Date(h.time).toLocaleTimeString(undefined, { hour: "numeric", hour12: true }).replace(" ", ""),
    temp: h.temp,
    code: h.code,
  })) ?? []

  const daily = weather?.daily.slice(1, 6).map((d) => {
    const date = new Date(d.date + "T12:00:00")
    return {
      day: date.toLocaleDateString(undefined, { weekday: "short" }),
      dateStr: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      tempMax: d.tempMax,
      tempMin: d.tempMin,
      code: d.code,
    }
  }) ?? []

  const dailyRange = daily.reduce(
    (acc, d) => ({ min: Math.min(acc.min, d.tempMin), max: Math.max(acc.max, d.tempMax) }),
    { min: Infinity, max: -Infinity }
  )

  return (
    <div className="zone-surface zone-weather flex h-full flex-col">
      <div className={`flex shrink-0 items-center justify-between px-4 py-1.5 ${editMode ? "zone-drag-handle" : ""}`}>
        <div className="flex items-center gap-1.5">
          <ZoneDragHandle />
          <ZoneLabel accentVar="--zone-weather-accent" icon={<CloudSun className="size-4" />}>
            Weather
          </ZoneLabel>
        </div>
        {weather && (
          <span className="text-xs text-muted-foreground/50">{weather.city}</span>
        )}
      </div>

      {!weather ? (
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <CloudSun className="size-8" style={{ color: "var(--zone-weather-accent)", opacity: 0.2 }} />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col px-4 pb-3">
          <div className="flex items-center gap-3 py-2">
            <CurrentIcon className="size-8 shrink-0" style={{ color: "var(--zone-weather-accent)" }} />
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-[family-name:var(--font-display)] text-2xl font-bold tabular-nums">
                  {weather.temp}°
                </span>
                <span className="text-xs text-muted-foreground">
                  {wmoToDescription(weather.weatherCode)}
                </span>
              </div>
              <div className="flex gap-3 text-xs text-muted-foreground/50">
                <span>Feels {weather.feelsLike}°</span>
                <span className="flex items-center gap-0.5"><Droplets className="size-2.5" />{weather.humidity}%</span>
                <span className="flex items-center gap-0.5"><Wind className="size-2.5" />{weather.windSpeed}km/h</span>
              </div>
            </div>
          </div>

          <div className="mt-1 flex gap-0 overflow-x-auto border-y border-border/10 py-2">
            {hourly.map((h, i) => {
              const HIcon = WMO_ICONS[wmoToIconCode(h.code)] ?? Cloud
              return (
                <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-0.5">
                  <span className="font-mono text-xs text-muted-foreground/40">{h.time}</span>
                  <HIcon className="size-3.5 text-muted-foreground/60" />
                  <span className="font-mono text-xs font-medium tabular-nums">{h.temp}°</span>
                </div>
              )
            })}
          </div>

          <div className="mt-2 flex flex-1 flex-col justify-evenly">
            {daily.map((d) => {
              const DIcon = WMO_ICONS[wmoToIconCode(d.code)] ?? Cloud
              const totalSpan = dailyRange.max - dailyRange.min || 1
              const barLeft = ((d.tempMin - dailyRange.min) / totalSpan) * 100
              const barWidth = ((d.tempMax - d.tempMin) / totalSpan) * 100

              return (
                <div key={d.dateStr} className="flex items-center gap-2 text-xs">
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
