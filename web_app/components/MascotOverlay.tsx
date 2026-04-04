"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useMascot, isBuiltinCharacter } from "@/lib/mascot"
import { PALETTES, CHARACTER_FRAMES } from "@/lib/mascot-characters"
import { ChatPopover } from "@/components/AIChatBubble"
import { renderFrameWithEyes, cursorToPupilPos } from "@/lib/mascot-eyes"
import type { PupilPos } from "@/lib/mascot-eyes"
import { listCustomCharacters } from "@/lib/data-layer"

const GRID = 32
const PX = 3
const MASCOT_SIZE = GRID * PX * 2 // 192px display size
const CORNER_INSET = { x: 16, bottom: 48, top: 72 } // offset from viewport edge

const SPEED: Record<string, number> = {
  idle: 600,
  drink: 600,
  eat: 300,
  celebrate: 250,
  sleep: 900,
  wave: 350,
}

type Corner = "bottom-right" | "bottom-left" | "top-right" | "top-left"

const CORNER_POSITIONS: Record<Corner, { top?: string; bottom?: string; left?: string; right?: string }> = {
  "bottom-right": { bottom: `${CORNER_INSET.bottom}px`, right: `${CORNER_INSET.x}px` },
  "bottom-left": { bottom: `${CORNER_INSET.bottom}px`, left: `${CORNER_INSET.x}px` },
  "top-right": { top: `${CORNER_INSET.top}px`, right: `${CORNER_INSET.x}px` },
  "top-left": { top: `${CORNER_INSET.top}px`, left: `${CORNER_INSET.x}px` },
}

function getStoredCorner(): Corner {
  if (typeof window === "undefined") return "bottom-right"
  const stored = localStorage.getItem("mascot-corner")
  if (stored && stored in CORNER_POSITIONS) return stored as Corner
  return "bottom-right"
}

function nearestCorner(x: number, y: number): Corner {
  const cx = x + MASCOT_SIZE / 2
  const cy = y + MASCOT_SIZE / 2
  const midX = window.innerWidth / 2
  const midY = window.innerHeight / 2
  const isRight = cx >= midX
  const isBottom = cy >= midY
  if (isBottom && isRight) return "bottom-right"
  if (isBottom && !isRight) return "bottom-left"
  if (!isBottom && isRight) return "top-right"
  return "top-left"
}

export function MascotOverlay() {
  const { state, enabled, soundEnabled, character, setEnabled, setSoundEnabled } = useMascot()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [frameIndex, setFrameIndex] = useState(0)
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const prevStateRef = useRef(state)
  const prevCharRef = useRef(character)

  const mouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

  // Track mouse position globally for eye tracking
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY }
    }
    window.addEventListener("mousemove", onMove, { passive: true })
    return () => window.removeEventListener("mousemove", onMove)
  }, [])

  const [corner, setCorner] = useState<Corner>("bottom-right")
  const [dragging, setDragging] = useState(false)
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null)
  const dragStartRef = useRef<{ pointerX: number; pointerY: number; elX: number; elY: number } | null>(null)
  const didDragRef = useRef(false)
  const [chatOpen, setChatOpen] = useState(false)

  // Load custom characters into the runtime registries
  useEffect(() => {
    listCustomCharacters().then((chars) => {
      for (const c of chars) {
        PALETTES[c.id] = c.palette
        CHARACTER_FRAMES[c.id] = c.frames
      }
    })
  }, [])

  // Load persisted corner on mount
  useEffect(() => {
    setCorner(getStoredCorner())
  }, [])

  // Reset frame on state or character change
  useEffect(() => {
    if (state !== prevStateRef.current || character !== prevCharRef.current) {
      setFrameIndex(0)
      prevStateRef.current = state
      prevCharRef.current = character
    }
  }, [state, character])

  // Animation ticker
  useEffect(() => {
    if (!enabled) return
    const speed = SPEED[state] ?? 600
    if (animRef.current) clearInterval(animRef.current)

    animRef.current = setInterval(() => {
      setFrameIndex((prev) => {
        const charFrames = CHARACTER_FRAMES[character]
        if (!charFrames) return prev
        const frames = charFrames[state]
        return (prev + 1) % frames.length
      })
    }, speed)

    return () => {
      if (animRef.current) clearInterval(animRef.current)
    }
  }, [state, enabled, character])

  // Render pixel art with eye tracking
  useEffect(() => {
    if (!enabled) return
    const ctx = canvasRef.current?.getContext("2d")
    if (!ctx) return

    const isIdle = state === "idle"

    const draw = () => {
      const charFrames = CHARACTER_FRAMES[character]
      if (!charFrames) return
      const frames = charFrames[state]
      const fr = frames[frameIndex % frames.length]
      const palette = PALETTES[character]

      let pupilPos: PupilPos | undefined
      if (isIdle) {
        pupilPos = cursorToPupilPos(mouseRef.current.x, mouseRef.current.y)
      }

      renderFrameWithEyes(ctx, fr, palette, PX, pupilPos, isIdle)
    }

    // For idle state, redraw frequently to track cursor
    if (isIdle) {
      draw()
      const id = setInterval(draw, 100) // 10fps eye tracking
      return () => clearInterval(id)
    } else {
      draw()
    }
  }, [state, frameIndex, enabled, character])

  // ── Drag handlers ────────────────────────────────────────────────────────

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const el = wrapperRef.current
    if (!el) return
    e.preventDefault()
    el.setPointerCapture(e.pointerId)

    const rect = el.getBoundingClientRect()
    dragStartRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      elX: rect.left,
      elY: rect.top,
    }
    setDragPos({ x: rect.left, y: rect.top })
    setDragging(true)
    didDragRef.current = false
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const start = dragStartRef.current
    if (!start || !dragging) return
    const dx = e.clientX - start.pointerX
    const dy = e.clientY - start.pointerY
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDragRef.current = true
    setDragPos({
      x: Math.max(0, Math.min(window.innerWidth - MASCOT_SIZE, start.elX + dx)),
      y: Math.max(0, Math.min(window.innerHeight - MASCOT_SIZE, start.elY + dy)),
    })
  }, [dragging])

  const onPointerUp = useCallback(() => {
    if (dragging && dragPos) {
      const newCorner = nearestCorner(dragPos.x, dragPos.y)
      setCorner(newCorner)
      localStorage.setItem("mascot-corner", newCorner)
    }
    // Tap (no drag) toggles chat
    if (!didDragRef.current) {
      setChatOpen((prev) => !prev)
    }
    setDragging(false)
    setDragPos(null)
    dragStartRef.current = null
  }, [dragging, dragPos])

  // Context menu
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const menuRef = useRef<HTMLDivElement>(null)

  const onContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setMenuPos({ x: e.clientX, y: e.clientY })
    setMenuOpen(true)
  }, [])

  // Clamp menu position to viewport after it renders
  useEffect(() => {
    if (!menuOpen || !menuRef.current) return
    const el = menuRef.current
    const rect = el.getBoundingClientRect()
    const pad = 8
    let { x, y } = menuPos
    if (rect.right > window.innerWidth - pad) x = window.innerWidth - rect.width - pad
    if (rect.bottom > window.innerHeight - pad) y = window.innerHeight - rect.height - pad
    if (x < pad) x = pad
    if (y < pad) y = pad
    if (x !== menuPos.x || y !== menuPos.y) setMenuPos({ x, y })
  }, [menuOpen, menuPos])

  // Close menu on click outside
  useEffect(() => {
    if (!menuOpen) return
    const close = () => setMenuOpen(false)
    window.addEventListener("pointerdown", close)
    return () => window.removeEventListener("pointerdown", close)
  }, [menuOpen])

  if (!enabled) return null

  // While dragging, use absolute pixel position. Otherwise, use corner CSS.
  const positionStyle: React.CSSProperties = dragging && dragPos
    ? { top: dragPos.y, left: dragPos.x, right: "auto", bottom: "auto", transition: "none" }
    : { ...CORNER_POSITIONS[corner], transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)" }

  return (
    <>
      <div
        ref={wrapperRef}
        className="fixed z-50 cursor-grab select-none active:cursor-grabbing"
        style={positionStyle}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onContextMenu={onContextMenu}
      >
        <canvas
          ref={canvasRef}
          width={GRID * PX}
          height={GRID * PX}
          style={{
            imageRendering: "pixelated",
            width: MASCOT_SIZE,
            height: MASCOT_SIZE,
            opacity: 1,
          }}
        />
      </div>

      {/* AI Chat popover (triggered by clicking mascot) */}
      <ChatPopover open={chatOpen} onClose={() => setChatOpen(false)} anchorCorner={corner} triggerSize={MASCOT_SIZE} />

      {/* Right-click context menu */}
      {menuOpen && (
        <div
          ref={menuRef}
          className="fixed z-[60] w-[180px] rounded-xl border border-border/30 bg-card p-1.5 shadow-xl"
          style={{ top: menuPos.y, left: menuPos.x }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              setEnabled(false)
              setMenuOpen(false)
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/40"
          >
            Turn Off
          </button>
          {soundEnabled && (
            <button
              onClick={() => {
                setSoundEnabled(false)
                setMenuOpen(false)
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/40"
            >
              Mute Sounds
            </button>
          )}
          {!soundEnabled && (
            <button
              onClick={() => {
                setSoundEnabled(true)
                setMenuOpen(false)
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/40"
            >
              Enable Sounds
            </button>
          )}
          <div className="my-1 h-px bg-border/20" />
          <p className="px-3 py-1.5 text-xs text-muted-foreground/50">
            You can turn it back on anytime in Settings.
          </p>
        </div>
      )}
    </>
  )
}
