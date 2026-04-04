"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import {
  playWaterSound,
  playFoodSound,
  playTaskSound,
  playMedicineSound,
  playEventSound,
  playCelebrateSound,
} from "./sounds"

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

export type BuiltinMascotCharacter = "robot" | "cat" | "ghost" | "cactus" | "octopus"
export type MascotCharacter = BuiltinMascotCharacter | (string & {})

export const BUILTIN_CHARACTERS: BuiltinMascotCharacter[] = ["robot", "cat", "ghost", "cactus", "octopus"]

export const MASCOT_CHARACTERS: { id: MascotCharacter; name: string; emoji: string }[] = [
  { id: "robot", name: "Bolt", emoji: "🤖" },
  { id: "cat", name: "Whiskers", emoji: "🐱" },
  { id: "ghost", name: "Boo", emoji: "👻" },
  { id: "cactus", name: "Spike", emoji: "🌵" },
  { id: "octopus", name: "Inky", emoji: "🐙" },
]

export function isBuiltinCharacter(id: string): id is BuiltinMascotCharacter {
  return BUILTIN_CHARACTERS.includes(id as BuiltinMascotCharacter)
}

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

const EVENT_SOUNDS: Record<MascotEvent, (() => void) | null> = {
  water: playWaterSound,
  food: playFoodSound,
  medicine: playMedicineSound,
  task_done: playTaskSound,
  event_added: playEventSound,
  celebrate: playCelebrateSound,
  greeting: null,
}

interface MascotContextType {
  state: MascotState
  enabled: boolean
  soundEnabled: boolean
  character: MascotCharacter
  setEnabled: (enabled: boolean) => void
  setSoundEnabled: (enabled: boolean) => void
  setCharacter: (character: MascotCharacter) => void
  trigger: (event: MascotEvent) => void
}

const MascotContext = createContext<MascotContextType>({
  state: "idle",
  enabled: true,
  soundEnabled: true,
  character: "cat",
  setEnabled: () => {},
  setSoundEnabled: () => {},
  setCharacter: () => {},
  trigger: () => {},
})

// ── Provider ─────────────────────────────────────────────────────────────────

export function MascotProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<MascotState>("idle")
  const [enabled, setEnabledRaw] = useState(true)
  const [soundEnabled, setSoundEnabledRaw] = useState(true)
  const [character, setCharacterRaw] = useState<MascotCharacter>("cat")
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const soundEnabledRef = useRef(true)

  useEffect(() => {
    const storedEnabled = localStorage.getItem("mascot-enabled")
    if (storedEnabled === "false") setEnabledRaw(false)
    const storedSound = localStorage.getItem("mascot-sound")
    if (storedSound === "false") {
      setSoundEnabledRaw(false)
      soundEnabledRef.current = false
    }
    const storedChar = localStorage.getItem("mascot-character")
    if (storedChar) {
      setCharacterRaw(storedChar)
    }
  }, [])

  const setEnabled = useCallback((val: boolean) => {
    setEnabledRaw(val)
    localStorage.setItem("mascot-enabled", String(val))
  }, [])

  const setSoundEnabled = useCallback((val: boolean) => {
    setSoundEnabledRaw(val)
    soundEnabledRef.current = val
    localStorage.setItem("mascot-sound", String(val))
  }, [])

  const setCharacter = useCallback((val: MascotCharacter) => {
    setCharacterRaw(val)
    localStorage.setItem("mascot-character", val)
  }, [])

  const trigger = useCallback((event: MascotEvent) => {
    const newState = EVENT_TO_STATE[event]
    if (!newState || newState === "idle") return

    setState(newState)

    // Play sound effect
    if (soundEnabledRef.current) {
      const soundFn = EVENT_SOUNDS[event]
      if (soundFn) soundFn()
    }

    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      setState("idle")
    }, 3000)
  }, [])

  return (
    <MascotContext value={{ state, enabled, soundEnabled, character, setEnabled, setSoundEnabled, setCharacter, trigger }}>
      {children}
    </MascotContext>
  )
}

export function useMascot() {
  return useContext(MascotContext)
}
