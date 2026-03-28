"use client"

import { useEffect, useRef, useState } from "react"
import { useMascot } from "@/lib/mascot"
import { PALETTES, CHARACTER_FRAMES } from "@/lib/mascot-characters"

const GRID = 32
const PX = 3

const SPEED: Record<string, number> = {
  idle: 600,
  drink: 600,
  eat: 300,
  celebrate: 250,
  sleep: 900,
  wave: 350,
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
  const [frameIndex, setFrameIndex] = useState(0)
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const prevStateRef = useRef(state)
  const prevCharRef = useRef(character)

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

  // Render
  useEffect(() => {
    if (!enabled) return
    const ctx = canvasRef.current?.getContext("2d")
    if (!ctx) return
    const frames = CHARACTER_FRAMES[character][state]
    const fr = frames[frameIndex % frames.length]
    const palette = PALETTES[character]
    renderFrame(ctx, fr, palette)
  }, [state, frameIndex, enabled, character])

  if (!enabled) return null

  return (
    <div
      className="pointer-events-none fixed z-50"
      style={{ bottom: "3rem", right: "1rem" }}
    >
      <canvas
        ref={canvasRef}
        width={GRID * PX}
        height={GRID * PX}
        style={{
          imageRendering: "pixelated",
          width: GRID * PX * 2,
          height: GRID * PX * 2,
          opacity: 0.9,
        }}
      />
    </div>
  )
}
