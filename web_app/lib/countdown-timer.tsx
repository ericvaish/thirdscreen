"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import { useNotifications } from "./notifications"
import { toast } from "sonner"

// ── Types ───────────────────────────────────────────────────────────────────

export interface CountdownTimer {
  /** Remaining seconds */
  remaining: number
  /** Total duration in seconds */
  total: number
  /** Timer label */
  label: string
  /** Whether the timer is actively counting */
  running: boolean
}

interface CountdownTimerContextType {
  timer: CountdownTimer | null
  /** Start a new countdown timer */
  start: (seconds: number, label?: string) => void
  /** Cancel the active timer */
  cancel: () => void
}

const CountdownTimerContext = createContext<CountdownTimerContextType>({
  timer: null,
  start: () => {},
  cancel: () => {},
})

// ── Provider ────────────────────────────────────────────────────────────────

export function CountdownTimerProvider({ children }: { children: React.ReactNode }) {
  const [timer, setTimer] = useState<CountdownTimer | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const { push: pushNotif } = useNotifications()

  const cleanup = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  useEffect(() => cleanup, [cleanup])

  const start = useCallback((seconds: number, label?: string) => {
    cleanup()
    const timerLabel = label || `${Math.ceil(seconds / 60)} min timer`
    setTimer({ remaining: seconds, total: seconds, label: timerLabel, running: true })

    const mins = Math.ceil(seconds / 60)
    const endTime = new Date(Date.now() + seconds * 1000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    toast(`Timer started: ${timerLabel}`, {
      description: `${mins} min — ends at ${endTime}`,
      duration: 4000,
    })

    intervalRef.current = setInterval(() => {
      setTimer((prev) => {
        if (!prev || prev.remaining <= 1) {
          cleanup()
          // Timer complete — notify
          toast.success(`${timerLabel} complete!`)
          pushNotif("timer", `${timerLabel} complete`, {
            body: "Your timer has finished!",
            ttl: 30_000,
          })
          // Play audio alert
          try {
            const ctx = new AudioContext()
            for (let i = 0; i < 3; i++) {
              const osc = ctx.createOscillator()
              const gain = ctx.createGain()
              osc.connect(gain)
              gain.connect(ctx.destination)
              osc.frequency.value = 880
              osc.type = "sine"
              gain.gain.value = 0.3
              const t = ctx.currentTime + i * 0.3
              osc.start(t)
              osc.stop(t + 0.15)
            }
          } catch {
            // Audio not available
          }
          return null
        }
        return { ...prev, remaining: prev.remaining - 1 }
      })
    }, 1000)
  }, [cleanup, pushNotif])

  const cancel = useCallback(() => {
    cleanup()
    setTimer(null)
  }, [cleanup])

  // Register global access for AI tools
  useEffect(() => {
    registerGlobalTimerStart(start)
    return () => unregisterGlobalTimerStart()
  }, [start])

  return (
    <CountdownTimerContext value={{ timer, start, cancel }}>
      {children}
    </CountdownTimerContext>
  )
}

export function useCountdownTimer() {
  return useContext(CountdownTimerContext)
}

// ── Global access for AI tools (non-React code) ─────────────────────────────

let globalStartTimer: ((seconds: number, label?: string) => void) | null = null

export function registerGlobalTimerStart(fn: (seconds: number, label?: string) => void) {
  globalStartTimer = fn
}

export function unregisterGlobalTimerStart() {
  globalStartTimer = null
}

/** Start a timer from non-React code (e.g., AI tool execution) */
export function startTimerGlobal(seconds: number, label?: string): boolean {
  if (!globalStartTimer) return false
  globalStartTimer(seconds, label)
  return true
}
