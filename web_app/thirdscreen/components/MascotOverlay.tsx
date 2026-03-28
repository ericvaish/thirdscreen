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

function renderFrame(
  ctx: CanvasRenderingContext2D,
  fr: string[][],
  palette: Record<string, string | null>
) {
  ctx.clearRect(0, 0, GRID * PX, GRID * PX)
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const key = fr[y]?.[x]
      if (!key || key === ".") continue
      const color = palette[key]
      if (!color) continue
      ctx.fillStyle = color
      ctx.fillRect(x * PX, y * PX, PX, PX)
    }
  }
}

export function MascotOverlay() {
  const { state, enabled, character } = useMascot()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [frameIndex, setFrameIndex] = useState(0)
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const prevStateRef = useRef(state)
  const prevCharRef = useRef(character)

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

  // Render pixel art
  useEffect(() => {
    if (!enabled) return
    const ctx = canvasRef.current?.getContext("2d")
    if (!ctx) return
    const frames = CHARACTER_FRAMES[character][state]
    const fr = frames[frameIndex % frames.length]
    const palette = PALETTES[character]
    renderFrame(ctx, fr, palette)
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

  if (!enabled) return null

  // While dragging, use absolute pixel position. Otherwise, use corner CSS.
  const positionStyle: React.CSSProperties = dragging && dragPos
    ? { top: dragPos.y, left: dragPos.x, right: "auto", bottom: "auto", transition: "none" }
    : { ...CORNER_POSITIONS[corner], transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)" }

  return (
    <div
      ref={wrapperRef}
      className="fixed z-50 cursor-grab select-none active:cursor-grabbing"
      style={positionStyle}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
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
  )
}
