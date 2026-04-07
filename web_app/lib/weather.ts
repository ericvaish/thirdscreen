"use client"

// ── Shared weather data service ────────────────────────────────────────────
// Single fetch every 30 minutes, shared across all weather consumers
// (WeatherZone, StatusBar weather/humidity/sunrise, ClockZone)

import { getGeo } from "@/components/zones/StatusBar"

export interface WeatherState {
  temp: number
  feelsLike: number
  humidity: number
  windSpeed: number
  weatherCode: number
  // Hourly (next 24h)
  hourly: { time: string; temp: number; code: number }[]
  // Daily (6 days including today)
  daily: { date: string; tempMax: number; tempMin: number; code: number; sunrise: string; sunset: string }[]
  // Meta
  city: string
  fetchedAt: number
}

const REFRESH_INTERVAL = 30 * 60 * 1000 // 30 minutes
const listeners = new Set<() => void>()

let weatherState: WeatherState | null = null
let fetchPromise: Promise<void> | null = null
let intervalId: ReturnType<typeof setInterval> | null = null

function notify() {
  for (const cb of listeners) cb()
}

async function doFetch() {
  try {
    const geo = await getGeo()
    if (!geo) return

    // Single API call with all needed parameters
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${geo.latitude}&longitude=${geo.longitude}` +
      `&current=temperature_2m,apparent_temperature,weather_code,relative_humidity_2m,wind_speed_10m` +
      `&hourly=temperature_2m,weather_code` +
      `&daily=temperature_2m_max,temperature_2m_min,weather_code,sunrise,sunset` +
      `&temperature_unit=celsius&timezone=auto&forecast_days=6`
    )
    if (!res.ok) return

    const data = await res.json()
    const c = data.current

    // Find current hour index
    const nowIso = c.time as string
    const nowDate = new Date(nowIso)
    const hourlyTimes = data.hourly.time as string[]
    let startIdx = hourlyTimes.findIndex(
      (t: string) => new Date(t).getHours() === nowDate.getHours() && new Date(t).getDate() === nowDate.getDate()
    )
    if (startIdx < 0) startIdx = 0

    const hourly = hourlyTimes.slice(startIdx, startIdx + 24).map((t: string, i: number) => ({
      time: t,
      temp: Math.round(data.hourly.temperature_2m[startIdx + i]),
      code: data.hourly.weather_code[startIdx + i] as number,
    }))

    const daily = (data.daily.time as string[]).map((t: string, i: number) => ({
      date: t,
      tempMax: Math.round(data.daily.temperature_2m_max[i]),
      tempMin: Math.round(data.daily.temperature_2m_min[i]),
      code: data.daily.weather_code[i] as number,
      sunrise: data.daily.sunrise[i] as string,
      sunset: data.daily.sunset[i] as string,
    }))

    weatherState = {
      temp: Math.round(c.temperature_2m),
      feelsLike: Math.round(c.apparent_temperature),
      humidity: c.relative_humidity_2m,
      windSpeed: Math.round(c.wind_speed_10m),
      weatherCode: c.weather_code,
      hourly,
      daily,
      city: geo.city ?? "",
      fetchedAt: Date.now(),
    }
    notify()
  } catch {
    // Silently fail — keep stale data
  }
}

/** Start the shared weather fetch loop (idempotent) */
export function ensureWeatherLoop() {
  if (intervalId) return
  if (!fetchPromise) {
    fetchPromise = doFetch().finally(() => { fetchPromise = null })
  }
  intervalId = setInterval(() => {
    if (!fetchPromise) {
      fetchPromise = doFetch().finally(() => { fetchPromise = null })
    }
  }, REFRESH_INTERVAL)
}

/** Force a re-fetch (e.g. after location change) */
export function refreshWeather() {
  weatherState = null
  notify()
  if (!fetchPromise) {
    fetchPromise = doFetch().finally(() => { fetchPromise = null })
  }
}

/** Get the current cached weather state (may be null if not yet fetched) */
export function getWeatherState(): WeatherState | null {
  return weatherState
}

/** Subscribe to weather updates. Returns unsubscribe function. */
export function onWeatherChange(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

// ── React hook ─────────────────────────────────────────────────────────────

import { useEffect, useState } from "react"

export function useWeather(): WeatherState | null {
  const [state, setState] = useState<WeatherState | null>(weatherState)

  useEffect(() => {
    ensureWeatherLoop()
    // Sync immediately in case data arrived before mount
    setState(weatherState)
    return onWeatherChange(() => setState(weatherState))
  }, [])

  return state
}

// ── WMO code helpers (shared) ──────────────────────────────────────────────

export function wmoToDescription(code: number): string {
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

export function wmoToIconCode(code: number): string {
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
