"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"

// ── Mascot event types ───────────────────────────────────────────────────────

export type MascotEvent =
  | "water"
  | "food"
  | "medicine"
  | "task_done"
  | "event_added"
  | "celebrate"
  | "greeting"

export type MascotState = "idle" | "drink" | "eat" | "celebrate" | "sleep" | "wave"

export type MascotCharacter = "robot" | "cat" | "ghost" | "cactus" | "octopus"

export const MASCOT_CHARACTERS: { id: MascotCharacter; name: string; emoji: string }[] = [
  { id: "robot", name: "Bolt", emoji: "🤖" },
  { id: "cat", name: "Whiskers", emoji: "🐱" },
  { id: "ghost", name: "Boo", emoji: "👻" },
  { id: "cactus", name: "Spike", emoji: "🌵" },
  { id: "octopus", name: "Inky", emoji: "🐙" },
]

const EVENT_TO_STATE: Record<MascotEvent, MascotState> = {
  water: "drink",
  food: "eat",
  medicine: "celebrate",
  task_done: "celebrate",
  event_added: "wave",
  celebrate: "celebrate",
  greeting: "wave",
}

// ── Context ──────────────────────────────────────────────────────────────────

interface MascotContextType {
  state: MascotState
  enabled: boolean
  character: MascotCharacter
  setEnabled: (enabled: boolean) => void
  setCharacter: (character: MascotCharacter) => void
  trigger: (event: MascotEvent) => void
}

const MascotContext = createContext<MascotContextType>({
  state: "idle",
  enabled: true,
  character: "robot",
  setEnabled: () => {},
  setCharacter: () => {},
  trigger: () => {},
})

// ── Provider ─────────────────────────────────────────────────────────────────

export function MascotProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<MascotState>("idle")
  const [enabled, setEnabledRaw] = useState(true)
  const [character, setCharacterRaw] = useState<MascotCharacter>("robot")
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const storedEnabled = localStorage.getItem("mascot-enabled")
    if (storedEnabled === "false") setEnabledRaw(false)
    const storedChar = localStorage.getItem("mascot-character") as MascotCharacter | null
    if (storedChar && MASCOT_CHARACTERS.some((c) => c.id === storedChar)) {
      setCharacterRaw(storedChar)
    }
  }, [])

  const setEnabled = useCallback((val: boolean) => {
    setEnabledRaw(val)
    localStorage.setItem("mascot-enabled", String(val))
  }, [])

  const setCharacter = useCallback((val: MascotCharacter) => {
    setCharacterRaw(val)
    localStorage.setItem("mascot-character", val)
  }, [])

  const trigger = useCallback((event: MascotEvent) => {
    const newState = EVENT_TO_STATE[event]
    if (!newState || newState === "idle") return

    setState(newState)

    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      setState("idle")
    }, 3000)
  }, [])

  return (
    <MascotContext value={{ state, enabled, character, setEnabled, setCharacter, trigger }}>
      {children}
    </MascotContext>
  )
}

export function useMascot() {
  return useContext(MascotContext)
}
