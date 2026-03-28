"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useMascot } from "@/lib/mascot"
import { PALETTES, CHARACTER_FRAMES } from "@/lib/mascot-characters"

const GRID = 32
const PX = 3
const MASCOT_SIZE = GRID * PX * 2 // 192px display size
const CORNER_INSET = { x: 16, y: 48 } // offset from viewport edge

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
  "bottom-right": { bottom: `${CORNER_INSET.y}px`, right: `${CORNER_INSET.x}px` },
  "bottom-left": { bottom: `${CORNER_INSET.y}px`, left: `${CORNER_INSET.x}px` },
  "top-right": { top: `${CORNER_INSET.y}px`, right: `${CORNER_INSET.x}px` },
  "top-left": { top: `${CORNER_INSET.y}px`, left: `${CORNER_INSET.x}px` },
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

// Eye tracking: scan the frame for K (pupil) pixels, find each eye's bounding box,
// then redraw the 2x2 pupil shifted within the surrounding W (white) region.

type PupilPos = "center" | "tl" | "tr" | "bl" | "br"

function cursorToPupilPos(mouseX: number, mouseY: number): PupilPos {
  const midX = window.innerWidth / 2
  const midY = window.innerHeight / 2
  const isRight = mouseX >= midX
  const isDown = mouseY >= midY
  if (isDown && isRight) return "br"
  if (isDown && !isRight) return "bl"
  if (!isDown && isRight) return "tr"
  return "tl"
}

// Find W (white) regions in the frame that are eye-shaped (at least 3 wide, 2 tall).
// Returns bounding boxes of each eye's white region.
function findEyeRegions(fr: string[][]): { wx: number; wy: number; ww: number; wh: number }[] {
  // Find all W pixel positions
  const wPixels: { x: number; y: number }[] = []
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (fr[y]?.[x] === "W") wPixels.push({ x, y })
    }
  }
  if (wPixels.length === 0) return []

  // Cluster W pixels into groups (split by horizontal gap > 1)
  wPixels.sort((a, b) => a.y - b.y || a.x - b.x)

  const groups: { x: number; y: number }[][] = []
  for (const p of wPixels) {
    // Try to add to an existing group if adjacent
    let added = false
    for (const g of groups) {
      if (g.some(gp => Math.abs(gp.x - p.x) <= 1 && Math.abs(gp.y - p.y) <= 1)) {
        g.push(p)
        added = true
        break
      }
    }
    if (!added) groups.push([p])
  }

  // Filter to eye-sized regions (at least 3 wide, 2 tall) and compute bounding boxes
  return groups
    .map(g => {
      const xs = g.map(p => p.x)
      const ys = g.map(p => p.y)
      return {
        wx: Math.min(...xs),
        wy: Math.min(...ys),
        ww: Math.max(...xs) - Math.min(...xs) + 1,
        wh: Math.max(...ys) - Math.min(...ys) + 1,
      }
    })
    .filter(r => r.ww >= 3 && r.wh >= 2)
}

function renderFrame(
  ctx: CanvasRenderingContext2D,
  fr: string[][],
  palette: Record<string, string | null>,
  pupilPos?: PupilPos,
  isIdle?: boolean,
) {
  ctx.clearRect(0, 0, GRID * PX, GRID * PX)

  const trackEyes = isIdle && pupilPos !== undefined

  // Draw everything except pupils (K) when tracking
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const key = fr[y]?.[x]
      if (!key || key === ".") continue
      if (trackEyes && key === "K") continue
      const color = palette[key]
      if (!color) continue
      ctx.fillStyle = color
      ctx.fillRect(x * PX, y * PX, PX, PX)
    }
  }

  // Draw shifted 2x2 pupils
  if (trackEyes) {
    const eyeRegions = findEyeRegions(fr)
    const pupilColor = palette["K"]
    if (pupilColor && eyeRegions.length > 0) {
      ctx.fillStyle = pupilColor

      for (const eye of eyeRegions) {
        // Pupil is 2x2, can sit at corners or center of the W region
        const maxDx = Math.max(0, eye.ww - 2)
        const maxDy = Math.max(0, eye.wh - 2)

        let px: number, py: number
        switch (pupilPos) {
          case "tl": px = 0; py = 0; break
          case "tr": px = maxDx; py = 0; break
          case "bl": px = 0; py = maxDy; break
          case "br": px = maxDx; py = maxDy; break
          default:   px = Math.floor(maxDx / 2); py = Math.floor(maxDy / 2); break
        }

        const ax = eye.wx + px
        const ay = eye.wy + py
        ctx.fillRect(ax * PX, ay * PX, PX, PX)
        ctx.fillRect((ax + 1) * PX, ay * PX, PX, PX)
        ctx.fillRect(ax * PX, (ay + 1) * PX, PX, PX)
        ctx.fillRect((ax + 1) * PX, (ay + 1) * PX, PX, PX)
      }
    }
  }
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
        const frames = CHARACTER_FRAMES[character][state]
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
      const frames = CHARACTER_FRAMES[character][state]
      const fr = frames[frameIndex % frames.length]
      const palette = PALETTES[character]

      let pupilPos: PupilPos | undefined
      if (isIdle) {
        pupilPos = cursorToPupilPos(mouseRef.current.x, mouseRef.current.y)
      }

      renderFrame(ctx, fr, palette, pupilPos, isIdle)
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
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const start = dragStartRef.current
    if (!start || !dragging) return
    const dx = e.clientX - start.pointerX
    const dy = e.clientY - start.pointerY
    setDragPos({
      x: Math.max(0, Math.min(window.innerWidth - MASCOT_SIZE, start.elX + dx)),
      y: Math.max(0, Math.min(window.innerHeight - MASCOT_SIZE, start.elY + dy)),
    })
  }, [dragging])

  const onPointerUp = useCallback(() => {
    if (!dragging || !dragPos) {
      setDragging(false)
      setDragPos(null)
      dragStartRef.current = null
      return
    }

    const newCorner = nearestCorner(dragPos.x, dragPos.y)
    setCorner(newCorner)
    localStorage.setItem("mascot-corner", newCorner)
    setDragging(false)
    setDragPos(null)
    dragStartRef.current = null
  }, [dragging, dragPos])

  // Context menu
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })

  const onContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setMenuPos({ x: e.clientX, y: e.clientY })
    setMenuOpen(true)
  }, [])

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

      {/* Right-click context menu */}
      {menuOpen && (
        <div
          className="fixed z-[60] min-w-[180px] rounded-xl border border-border/30 bg-card p-1.5 shadow-xl"
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
