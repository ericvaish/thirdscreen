"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { setSetting, getSettings } from "./data-layer"

// ── Types ──────────────────────────────────────────────────────────────────

export const ZONE_KEYS = ["timeline", "clock", "tasks", "notes", "vitals", "media", "habits", "smarthome", "status"] as const
export type ThemeZone = (typeof ZONE_KEYS)[number]

export type GradientStyle = "glow" | "border" | "flat"
export type CardBackground = "default" | "oled" | "lighter" | "tinted"
export type ZoneLabelStyle = "line" | "icon" | "hidden"

export interface ThemeCustomization {
  zoneAccents: Partial<Record<ThemeZone, number | null>> // OKLCH hue 0-360
  cardBackground: CardBackground
  zoneGradients: Partial<Record<ThemeZone, GradientStyle>>
  zoneLabelStyle: ZoneLabelStyle
  preset: string | null
}

export const DEFAULT_THEME: ThemeCustomization = {
  zoneAccents: {},
  cardBackground: "default",
  zoneGradients: {},
  zoneLabelStyle: "hidden",
  preset: null,
}

// ── Zone metadata ──────────────────────────────────────────────────────────

export const ZONE_META: Record<ThemeZone, { label: string; defaultHue: { light: number; dark: number }; defaultAccent: { light: string; dark: string } }> = {
  timeline: { label: "Schedule", defaultHue: { light: 220, dark: 210 }, defaultAccent: { light: "oklch(0.45 0.16 220)", dark: "oklch(0.72 0.17 210)" } },
  clock:    { label: "Clock",    defaultHue: { light: 195, dark: 195 }, defaultAccent: { light: "oklch(0.45 0.16 195)", dark: "oklch(0.74 0.17 195)" } },
  tasks:    { label: "Tasks",    defaultHue: { light: 85, dark: 80 },   defaultAccent: { light: "oklch(0.5 0.14 85)",  dark: "oklch(0.82 0.16 80)" } },
  notes:    { label: "Notes",    defaultHue: { light: 300, dark: 300 }, defaultAccent: { light: "oklch(0.45 0.16 300)", dark: "oklch(0.74 0.18 300)" } },
  vitals:   { label: "Vitals",   defaultHue: { light: 160, dark: 160 }, defaultAccent: { light: "oklch(0.45 0.16 160)", dark: "oklch(0.74 0.17 160)" } },
  media:    { label: "Media",    defaultHue: { light: 30, dark: 20 },   defaultAccent: { light: "oklch(0.5 0.16 30)",  dark: "oklch(0.75 0.18 20)" } },
  habits:    { label: "Habits",     defaultHue: { light: 140, dark: 140 }, defaultAccent: { light: "oklch(0.45 0.16 140)", dark: "oklch(0.7 0.15 140)" } },
  smarthome: { label: "Smart Home", defaultHue: { light: 50, dark: 50 },   defaultAccent: { light: "oklch(0.5 0.16 50)",  dark: "oklch(0.78 0.16 50)" } },
  status:    { label: "Status",     defaultHue: { light: 260, dark: 270 }, defaultAccent: { light: "oklch(0.45 0.04 260)", dark: "oklch(0.6 0.03 270)" } },
}

// ── Preset color swatches (hue values) ─────────────────────────────────────

export const HUE_SWATCHES = [
  { hue: 210, label: "Blue" },
  { hue: 195, label: "Cyan" },
  { hue: 160, label: "Teal" },
  { hue: 140, label: "Green" },
  { hue: 80,  label: "Gold" },
  { hue: 55,  label: "Amber" },
  { hue: 30,  label: "Orange" },
  { hue: 15,  label: "Coral" },
  { hue: 350, label: "Rose" },
  { hue: 300, label: "Purple" },
  { hue: 270, label: "Violet" },
  { hue: 240, label: "Indigo" },
]

// ── Presets ─────────────────────────────────────────────────────────────────

export const PRESETS: Record<string, { label: string; theme: ThemeCustomization }> = {
  default: {
    label: "Default",
    theme: { ...DEFAULT_THEME, zoneLabelStyle: "line", preset: "default" },
  },
  oled: {
    label: "OLED",
    theme: {
      zoneAccents: {},
      cardBackground: "oled",
      zoneGradients: {
        timeline: "flat", clock: "flat", tasks: "flat", notes: "flat",
        vitals: "flat", media: "flat", habits: "flat", smarthome: "flat", status: "flat",
      },
      zoneLabelStyle: "line",
      preset: "oled",
    },
  },
  neon: {
    label: "Neon",
    theme: {
      zoneAccents: {
        timeline: 195, clock: 170, tasks: 140, notes: 300,
        vitals: 160, media: 15, habits: 80, smarthome: 30, status: 270,
      },
      cardBackground: "oled",
      zoneGradients: {},
      zoneLabelStyle: "line",
      preset: "neon",
    },
  },
  pastel: {
    label: "Pastel",
    theme: {
      zoneAccents: {
        timeline: 210, clock: 190, tasks: 55, notes: 300,
        vitals: 160, media: 350, habits: 140, smarthome: 50, status: 240,
      },
      cardBackground: "lighter",
      zoneGradients: {},
      zoneLabelStyle: "line",
      preset: "pastel",
    },
  },
  mono: {
    label: "Mono",
    theme: {
      zoneAccents: {
        timeline: 260, clock: 260, tasks: 260, notes: 260,
        vitals: 260, media: 260, habits: 260, smarthome: 260, status: 260,
      },
      cardBackground: "default",
      zoneGradients: {
        timeline: "flat", clock: "flat", tasks: "flat", notes: "flat",
        vitals: "flat", media: "flat", habits: "flat", smarthome: "flat", status: "flat",
      },
      zoneLabelStyle: "line",
      preset: "mono",
    },
  },
}

// ── OKLCH color helpers ────────────────────────────────────────────────────

function accentFromHue(hue: number, isDark: boolean): string {
  // Dark mode: lighter, more saturated. Light mode: darker, slightly less saturated.
  const l = isDark ? 0.74 : 0.48
  const c = isDark ? 0.17 : 0.16
  return `oklch(${l} ${c} ${hue})`
}

function zoneBgFromHue(hue: number, isDark: boolean): string {
  if (isDark) return `oklch(0.13 0.01 ${hue})`
  return `oklch(0.97 0.012 ${hue})`
}

function gradientFromHue(hue: number, isDark: boolean): string {
  const l = isDark ? 0.74 : 0.6
  const c = isDark ? 0.17 : 0.15
  return `radial-gradient(circle 200px at 0% 0%, oklch(${l} ${c} ${hue} / 18%), transparent)`
}

// ── Apply theme to DOM ─────────────────────────────────────────────────────

export function applyTheme(theme: ThemeCustomization) {
  const root = document.documentElement
  const isDark = root.classList.contains("dark")

  for (const zone of ZONE_KEYS) {
    const meta = ZONE_META[zone]
    const customHue = theme.zoneAccents[zone]
    const hue = customHue ?? meta.defaultHue[isDark ? "dark" : "light"]

    if (customHue != null) {
      // Override accent color
      root.style.setProperty(`--zone-${zone}-accent`, accentFromHue(hue, isDark))
      // Override zone background with tinted version if tinted mode
      if (theme.cardBackground === "tinted") {
        root.style.setProperty(`--zone-${zone}`, zoneBgFromHue(hue, isDark))
      }
    } else {
      // Remove overrides, fall back to CSS defaults
      root.style.removeProperty(`--zone-${zone}-accent`)
      if (theme.cardBackground !== "tinted") {
        root.style.removeProperty(`--zone-${zone}`)
      }
    }

    // Gradient style — applied via data attribute on root
    const gradientStyle = theme.zoneGradients[zone] ?? "glow"
    root.setAttribute(`data-gradient-${zone}`, gradientStyle)
  }

  // Zone label style (line vs icon)
  root.setAttribute("data-zone-label", theme.zoneLabelStyle ?? "hidden")

  // Card background mode
  switch (theme.cardBackground) {
    case "oled":
      root.style.setProperty("--zone-base", isDark ? "oklch(0.03 0 0)" : "oklch(1 0 0)")
      for (const zone of ZONE_KEYS) {
        if (theme.zoneAccents[zone] == null) {
          root.style.setProperty(`--zone-${zone}`, "var(--zone-base)")
        }
      }
      root.style.setProperty("--zone-status", isDark ? "oklch(0.02 0 0)" : "oklch(1 0 0)")
      break
    case "lighter":
      root.style.setProperty("--zone-base", isDark ? "oklch(0.18 0.012 260)" : "oklch(0.96 0.008 260)")
      for (const zone of ZONE_KEYS) {
        if (theme.zoneAccents[zone] == null) {
          root.style.setProperty(`--zone-${zone}`, "var(--zone-base)")
        }
      }
      root.style.setProperty("--zone-status", isDark ? "oklch(0.16 0.01 260)" : "oklch(0.965 0.005 260)")
      break
    case "tinted":
      for (const zone of ZONE_KEYS) {
        const customHue = theme.zoneAccents[zone]
        const hue = customHue ?? ZONE_META[zone].defaultHue[isDark ? "dark" : "light"]
        root.style.setProperty(`--zone-${zone}`, zoneBgFromHue(hue, isDark))
      }
      break
    default:
      // Remove all overrides — CSS defaults take over
      root.style.removeProperty("--zone-base")
      for (const zone of ZONE_KEYS) {
        if (theme.zoneAccents[zone] == null) {
          root.style.removeProperty(`--zone-${zone}`)
        }
      }
      root.style.removeProperty("--zone-status")
      break
  }
}

// ── Clear all theme overrides from DOM ─────────────────────────────────────

export function clearThemeOverrides() {
  const root = document.documentElement
  for (const zone of ZONE_KEYS) {
    root.style.removeProperty(`--zone-${zone}`)
    root.style.removeProperty(`--zone-${zone}-accent`)
    root.removeAttribute(`data-gradient-${zone}`)
  }
  root.style.removeProperty("--zone-base")
  root.removeAttribute("data-zone-label")
}

// ── Hook ───────────────────────────────────────────────────────────────────

const SETTINGS_KEY = "themeCustomization"

export function useThemeCustomizer() {
  const [theme, setThemeState] = useState<ThemeCustomization>(DEFAULT_THEME)
  const [loaded, setLoaded] = useState(false)
  const saveRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load on mount
  useEffect(() => {
    getSettings()
      .then((s) => {
        const settings = s as Record<string, unknown>
        if (settings[SETTINGS_KEY] && typeof settings[SETTINGS_KEY] === "object") {
          const saved = settings[SETTINGS_KEY] as ThemeCustomization
          setThemeState(saved)
          applyTheme(saved)
        }
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [])

  // Re-apply when dark/light mode changes
  useEffect(() => {
    if (!loaded) return
    const observer = new MutationObserver(() => {
      applyTheme(theme)
    })
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    })
    return () => observer.disconnect()
  }, [theme, loaded])

  const updateTheme = useCallback((updater: (prev: ThemeCustomization) => ThemeCustomization) => {
    setThemeState((prev) => {
      const next = updater(prev)
      applyTheme(next)

      // Debounced save
      if (saveRef.current) clearTimeout(saveRef.current)
      saveRef.current = setTimeout(() => {
        setSetting(SETTINGS_KEY, next).catch(() => {})
      }, 500)

      return next
    })
  }, [])

  const applyPreset = useCallback((presetId: string) => {
    const preset = PRESETS[presetId]
    if (!preset) return
    clearThemeOverrides()
    setThemeState(preset.theme)
    applyTheme(preset.theme)

    if (saveRef.current) clearTimeout(saveRef.current)
    saveRef.current = setTimeout(() => {
      setSetting(SETTINGS_KEY, preset.theme).catch(() => {})
    }, 500)
  }, [])

  const resetTheme = useCallback(() => {
    clearThemeOverrides()
    setThemeState(DEFAULT_THEME)
    applyTheme(DEFAULT_THEME)
    setSetting(SETTINGS_KEY, DEFAULT_THEME).catch(() => {})
  }, [])

  return { theme, loaded, updateTheme, applyPreset, resetTheme }
}
