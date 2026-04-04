"use client"

import { createContext, useCallback, useContext, useEffect, useState } from "react"
import { getSettings, setSetting } from "@/lib/data-layer"

const SCALE_PRESETS = [
  { label: "Compact", value: 14 },
  { label: "Small", value: 16 },
  { label: "Default", value: 20 },
  { label: "TV / Far", value: 26 },
  { label: "Kiosk", value: 34 },
] as const

type ScaleContextType = {
  scale: number
  setScale: (value: number) => void
  presets: typeof SCALE_PRESETS
}

const ScaleContext = createContext<ScaleContextType>({
  scale: 20,
  setScale: () => {},
  presets: SCALE_PRESETS,
})

export function ScaleProvider({ children }: { children: React.ReactNode }) {
  const [scale, setScaleState] = useState(20)

  // Load from storage on mount
  useEffect(() => {
    getSettings()
      .then((s) => {
        const settings = s as Record<string, unknown>
        if (typeof settings.uiScale === "number") {
          setScaleState(settings.uiScale)
          document.documentElement.style.setProperty("--ui-scale", `${settings.uiScale}px`)
        }
      })
      .catch(() => {})
  }, [])

  const setScale = useCallback((value: number) => {
    setScaleState(value)
    document.documentElement.style.setProperty("--ui-scale", `${value}px`)
    setSetting("uiScale", value).catch(() => {})
  }, [])

  return (
    <ScaleContext value={{ scale, setScale, presets: SCALE_PRESETS }}>
      {children}
    </ScaleContext>
  )
}

export function useScale() {
  return useContext(ScaleContext)
}

export { SCALE_PRESETS }
