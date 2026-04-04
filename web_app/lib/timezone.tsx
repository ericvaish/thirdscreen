"use client"

import { createContext, useCallback, useContext, useEffect, useState } from "react"
import { getSettings, setSetting } from "./data-layer"

const SETTINGS_KEY = "timezoneOverride"

interface TimezoneCtx {
  /** The effective timezone (override or auto-detected) */
  timezone: string
  /** The browser's auto-detected timezone */
  detected: string
  /** The user's override, or null if auto-detect */
  override: string | null
  /** Set a manual override, or null to revert to auto-detect */
  setOverride: (tz: string | null) => void
}

const TimezoneContext = createContext<TimezoneCtx>({
  timezone: "UTC",
  detected: "UTC",
  override: null,
  setOverride: () => {},
})

export function TimezoneProvider({ children }: { children: React.ReactNode }) {
  const [detected] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone)
  const [override, setOverrideRaw] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    getSettings()
      .then((s) => {
        const settings = s as Record<string, unknown>
        if (typeof settings[SETTINGS_KEY] === "string") {
          setOverrideRaw(settings[SETTINGS_KEY] as string)
        }
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [])

  const setOverride = useCallback((tz: string | null) => {
    setOverrideRaw(tz)
    if (tz) {
      setSetting(SETTINGS_KEY, tz).catch(() => {})
    } else {
      setSetting(SETTINGS_KEY, null).catch(() => {})
    }
  }, [])

  const timezone = override ?? detected

  if (!loaded) {
    // Render children immediately with detected timezone — override will apply after load
  }

  return (
    <TimezoneContext.Provider value={{ timezone, detected, override, setOverride }}>
      {children}
    </TimezoneContext.Provider>
  )
}

export function useTimezone() {
  return useContext(TimezoneContext)
}

/** Common IANA timezone list for the override picker */
export const TIMEZONE_LIST = [
  "Pacific/Midway",
  "Pacific/Honolulu",
  "America/Anchorage",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Caracas",
  "America/Halifax",
  "America/St_Johns",
  "America/Sao_Paulo",
  "America/Argentina/Buenos_Aires",
  "Atlantic/South_Georgia",
  "Atlantic/Azores",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Helsinki",
  "Europe/Istanbul",
  "Africa/Cairo",
  "Europe/Moscow",
  "Asia/Dubai",
  "Asia/Kabul",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Kathmandu",
  "Asia/Dhaka",
  "Asia/Yangon",
  "Asia/Bangkok",
  "Asia/Shanghai",
  "Asia/Hong_Kong",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Adelaide",
  "Australia/Sydney",
  "Pacific/Noumea",
  "Pacific/Auckland",
  "Pacific/Fiji",
  "Pacific/Tongatapu",
]
