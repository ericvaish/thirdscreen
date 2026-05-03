"use client"

import { useEffect, useState, useCallback } from "react"

const STORAGE_KEY = "ts_page_padding"
const DEFAULT_PX = 24
const MIN_PX = 0
const MAX_PX = 80
const EVT = "ts:page-padding-changed"

function clamp(v: number) {
  return Math.max(MIN_PX, Math.min(MAX_PX, Math.round(v)))
}

function readStored(): number {
  if (typeof window === "undefined") return DEFAULT_PX
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return DEFAULT_PX
  const n = Number(raw)
  return Number.isFinite(n) ? clamp(n) : DEFAULT_PX
}

function applyToRoot(px: number) {
  if (typeof document === "undefined") return
  document.documentElement.style.setProperty("--page-padding", `${px}px`)
}

/**
 * Page-edge padding (the gap between the browser viewport and the dashboard
 * shell) — applied on all four sides via the `--page-padding` CSS variable.
 * The header/main wrapper reads this variable instead of hard-coded paddings.
 */
export function usePagePadding() {
  const [padding, setPaddingState] = useState<number>(DEFAULT_PX)

  useEffect(() => {
    const initial = readStored()
    setPaddingState(initial)
    applyToRoot(initial)
    const onChange = (e: Event) => {
      const next = (e as CustomEvent<number>).detail
      if (typeof next === "number") {
        setPaddingState(next)
        applyToRoot(next)
      }
    }
    window.addEventListener(EVT, onChange)
    return () => window.removeEventListener(EVT, onChange)
  }, [])

  const setPadding = useCallback((next: number) => {
    const v = clamp(next)
    localStorage.setItem(STORAGE_KEY, String(v))
    applyToRoot(v)
    setPaddingState(v)
    window.dispatchEvent(new CustomEvent(EVT, { detail: v }))
  }, [])

  return { padding, setPadding, min: MIN_PX, max: MAX_PX, defaultPx: DEFAULT_PX }
}
