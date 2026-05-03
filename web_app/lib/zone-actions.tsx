"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import type { ZoneId } from "./grid-layout"

// ── Zone action types ───────────────────────────────────────────────────────

/**
 * A single action registered by a zone for its right-click context menu.
 * Actions are how zones expose their per-card configuration without
 * cluttering the dashboard surface itself.
 */
export interface ZoneAction {
  /** Stable ID across renders so the menu key is stable. */
  id: string
  label: string
  icon?: ReactNode
  /** Optional. If present, the action is rendered as a submenu trigger and
   *  `onSelect` is ignored. */
  options?: ZoneActionOption[]
  onSelect?: () => void
  disabled?: boolean
  /** "destructive" gets a red treatment in the menu. */
  variant?: "default" | "destructive"
}

export interface ZoneActionOption {
  id: string
  label: string
  active?: boolean
  onSelect: () => void
}

// ── Context ─────────────────────────────────────────────────────────────────

interface ZoneActionsContextValue {
  /** Map of zoneId → list of actions. */
  actions: Record<string, ZoneAction[]>
  /** Replace all actions for a zone. Called by `useRegisterZoneActions`. */
  setZoneActions: (zoneId: ZoneId, actions: ZoneAction[]) => void
  /** Clear actions for a zone (on unmount). */
  clearZoneActions: (zoneId: ZoneId) => void
}

const ZoneActionsContext = createContext<ZoneActionsContextValue | null>(null)

export function ZoneActionsProvider({ children }: { children: ReactNode }) {
  const [actions, setActions] = useState<Record<string, ZoneAction[]>>({})

  const setZoneActions = useCallback((zoneId: ZoneId, next: ZoneAction[]) => {
    setActions((prev) => {
      const cur = prev[zoneId]
      // Skip the update when nothing identity-meaningful changed — prevents
      // re-render loops between zones that re-register on every render.
      if (
        cur &&
        cur.length === next.length &&
        cur.every((a, i) => a === next[i])
      ) {
        return prev
      }
      return { ...prev, [zoneId]: next }
    })
  }, [])

  const clearZoneActions = useCallback((zoneId: ZoneId) => {
    setActions((prev) => {
      if (!(zoneId in prev)) return prev
      const next = { ...prev }
      delete next[zoneId]
      return next
    })
  }, [])

  const value = useMemo(
    () => ({ actions, setZoneActions, clearZoneActions }),
    [actions, setZoneActions, clearZoneActions],
  )
  return <ZoneActionsContext.Provider value={value}>{children}</ZoneActionsContext.Provider>
}

export function useZoneActionsRegistry() {
  const ctx = useContext(ZoneActionsContext)
  return ctx
}

/**
 * Register a list of actions for a zone. The list is identity-stable across
 * re-renders as long as `actions` reference doesn't change.
 *
 * Call inside the zone component:
 *
 *   useRegisterZoneActions("notes", useMemo(() => [
 *     { id: "add", label: "Add note", onSelect: addNote },
 *     ...
 *   ], [addNote]))
 */
export function useRegisterZoneActions(zoneId: ZoneId, actions: ZoneAction[]) {
  const ctx = useContext(ZoneActionsContext)
  const lastRef = useRef<ZoneAction[] | null>(null)

  useEffect(() => {
    if (!ctx) return
    lastRef.current = actions
    ctx.setZoneActions(zoneId, actions)
  }, [ctx, zoneId, actions])

  useEffect(() => {
    if (!ctx) return
    return () => ctx.clearZoneActions(zoneId)
    // Only run cleanup on unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
