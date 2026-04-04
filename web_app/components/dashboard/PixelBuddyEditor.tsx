"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Pencil,
  Eraser,
  Pipette,
  Copy,
  RotateCcw,
  RotateCw,
  Download,
  FlipHorizontal,
  Grid3X3,
  Play,
  Pause,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Import,
  Eye,
  Save,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import type { MascotState, MascotCharacter } from "@/lib/mascot"
import { MASCOT_CHARACTERS, isBuiltinCharacter } from "@/lib/mascot"
import { CHARACTER_FRAMES, PALETTES } from "@/lib/mascot-characters"
import { findEyeRegions, renderFrameWithEyes } from "@/lib/mascot-eyes"
import type { PupilPos } from "@/lib/mascot-eyes"
import { useTheme } from "next-themes"
import { listCustomCharacters, saveCustomCharacter, deleteCustomCharacter } from "@/lib/data-layer"
import type { LocalCustomCharacter } from "@/lib/data-layer"
import { useMascot } from "@/lib/mascot"
import { toast } from "sonner"

// ── Palette ──────────────────────────────────────────────────────────────────

const PALETTE_KEYS = [
  { key: ".", label: "Empty", color: null },
  { key: "O", label: "Outline", color: "#1a1a2e" },
  { key: "M", label: "Main", color: "#ff9800" },
  { key: "m", label: "Highlight", color: "#ffb74d" },
  { key: "D", label: "Dark", color: "#e65100" },
  { key: "d", label: "Darker", color: "#bf360c" },
  { key: "W", label: "Eye White", color: "#ffffff" },
  { key: "K", label: "Pupil", color: "#111111" },
  { key: "R", label: "Accent 1", color: "#e91e63" },
  { key: "r", label: "Accent 1 Lt", color: "#f48fb1" },
  { key: "A", label: "Alt 1", color: "#ff9800" },
  { key: "a", label: "Alt 1 Lt", color: "#ffcc80" },
  { key: "S", label: "Special 1", color: "#ffd54f" },
  { key: "s", label: "Special 1 Lt", color: "#fff9c4" },
  { key: "G", label: "Green", color: "#66bb6a" },
  { key: "g", label: "Green Lt", color: "#a5d6a7" },
  { key: "B", label: "Base Dark", color: "#e65100" },
  { key: "L", label: "Light Fill", color: "#ffe0b2" },
  { key: "Y", label: "Yellow", color: "#ffcc80" },
  { key: "T", label: "Tint", color: "#f48fb1" },
  { key: "Z", label: "Sleep", color: "#78909c" },
  { key: "z", label: "Sleep Lt", color: "#b0bec5" },
]

const GRID_SIZE = 32
const STATES: MascotState[] = ["idle", "drink", "eat", "celebrate", "sleep", "wave"]

type Tool = "draw" | "erase" | "pick"

function createEmptyGrid(): string[][] {
  return Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill("."))
}

function cloneGrid(grid: string[][]): string[][] {
  return grid.map((row) => [...row])
}

// ── Main Component ───────────────────────────────────────────────────────────

export function PixelBuddyEditor() {
  // State management for all animation frames
  const [currentState, setCurrentState] = useState<MascotState>("idle")
  const [frames, setFrames] = useState<Record<MascotState, string[][][]>>(() => {
    const init: Record<string, string[][][]> = {}
    for (const s of STATES) {
      init[s] = [createEmptyGrid()]
    }
    return init as Record<MascotState, string[][][]>
  })
  const [currentFrameIdx, setCurrentFrameIdx] = useState(0)
  const [tool, setTool] = useState<Tool>("draw")
  const [activeKey, setActiveKey] = useState("O")
  const [showGrid, setShowGrid] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)
  const [undoStack, setUndoStack] = useState<string[][][]>([])
  const [redoStack, setRedoStack] = useState<string[][][]>([])
  const [activePalette, setActivePalette] = useState<MascotCharacter>("cat")
  const [customCharacters, setCustomCharacters] = useState<LocalCustomCharacter[]>([])
  const [editingCharacterId, setEditingCharacterId] = useState<string | null>(null)
  const [characterName, setCharacterName] = useState("")
  const [characterEmoji, setCharacterEmoji] = useState("🎨")
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme !== "light"
  const { setCharacter: setMascotCharacter } = useMascot()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const previewCanvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawingRef = useRef(false)

  const currentFrames = frames[currentState]
  const grid = currentFrames[currentFrameIdx] ?? createEmptyGrid()

  // ── Load saved custom characters ────────────────────────────────────────

  useEffect(() => {
    listCustomCharacters().then(setCustomCharacters)
  }, [])

  // ── Save / Load custom characters ───────────────────────────────────────

  const saveCharacter = async () => {
    const name = characterName.trim()
    if (!name) {
      toast.error("Enter a name for your character")
      return
    }

    const palette = { ...PALETTES[activePalette] }
    const saved = await saveCustomCharacter({
      id: editingCharacterId ?? undefined,
      name,
      emoji: characterEmoji || "🎨",
      palette,
      frames,
    })

    // Register into runtime registries so MascotOverlay can use it immediately
    PALETTES[saved.id] = saved.palette
    CHARACTER_FRAMES[saved.id] = saved.frames

    setEditingCharacterId(saved.id)
    setCustomCharacters(await listCustomCharacters())
    toast.success(`Saved "${name}"`)
  }

  const loadCustomCharacter = (c: LocalCustomCharacter) => {
    const imported: Record<string, string[][][]> = {}
    for (const s of STATES) {
      imported[s] = c.frames[s].map((f) => f.map((row) => [...row]))
    }
    setFrames(imported as Record<MascotState, string[][][]>)
    setCurrentState("idle")
    setCurrentFrameIdx(0)
    setUndoStack([])
    setRedoStack([])
    setIsPlaying(false)
    setEditingCharacterId(c.id)
    setCharacterName(c.name)
    setCharacterEmoji(c.emoji)
    // Find best matching palette
    if (!isBuiltinCharacter(activePalette)) {
      setActivePalette("cat")
    }
  }

  const deleteChar = async (id: string) => {
    await deleteCustomCharacter(id)
    delete PALETTES[id]
    delete CHARACTER_FRAMES[id]
    setCustomCharacters(await listCustomCharacters())
    if (editingCharacterId === id) {
      setEditingCharacterId(null)
      setCharacterName("")
    }
    toast.success("Character deleted")
  }

  const useAsActive = (id: string) => {
    setMascotCharacter(id)
    toast.success("Pixel buddy updated!")
  }

  // ── Drawing ──────────────────────────────────────────────────────────────

  const drawPixel = useCallback(
    (x: number, y: number) => {
      setFrames((prev) => {
        const updated = { ...prev }
        const stateFrames = [...updated[currentState]]
        const g = cloneGrid(stateFrames[currentFrameIdx])
        if (tool === "erase") {
          g[y][x] = "."
        } else if (tool === "pick") {
          setActiveKey(g[y][x])
          setTool("draw")
          return prev
        } else {
          g[y][x] = activeKey
        }
        stateFrames[currentFrameIdx] = g
        updated[currentState] = stateFrames
        return updated
      })
    },
    [currentState, currentFrameIdx, tool, activeKey]
  )

  const getGridCoords = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = Math.floor(((e.clientX - rect.left) * scaleX) / (canvas.width / GRID_SIZE))
    const y = Math.floor(((e.clientY - rect.top) * scaleY) / (canvas.height / GRID_SIZE))
    if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) return { x, y }
    return null
  }, [])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      // Save undo state and clear redo
      setUndoStack((prev) => [...prev.slice(-19), cloneGrid(grid)])
      setRedoStack([])
      isDrawingRef.current = true
      const coords = getGridCoords(e)
      if (coords) drawPixel(coords.x, coords.y)
    },
    [getGridCoords, drawPixel, grid]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawingRef.current) return
      const coords = getGridCoords(e)
      if (coords) drawPixel(coords.x, coords.y)
    },
    [getGridCoords, drawPixel]
  )

  const handleMouseUp = useCallback(() => {
    isDrawingRef.current = false
  }, [])

  // ── Canvas rendering ─────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const cellSize = canvas.width / GRID_SIZE
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Checkerboard background for transparency
    const cb1 = isDark ? "#1a1a2e" : "#e8e8ec"
    const cb2 = isDark ? "#16162a" : "#dddde2"
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const isEven = (x + y) % 2 === 0
        ctx.fillStyle = isEven ? cb1 : cb2
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize)
      }
    }

    // Draw pixels using active palette
    const palette = PALETTES[activePalette]
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const key = grid[y]?.[x]
        if (!key || key === ".") continue
        const color = palette[key]
        if (color) {
          ctx.fillStyle = color
          ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize)
        }
      }
    }

    // Grid lines
    if (showGrid) {
      ctx.strokeStyle = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)"
      ctx.lineWidth = 0.5
      for (let i = 0; i <= GRID_SIZE; i++) {
        ctx.beginPath()
        ctx.moveTo(i * cellSize, 0)
        ctx.lineTo(i * cellSize, canvas.height)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(0, i * cellSize)
        ctx.lineTo(canvas.width, i * cellSize)
        ctx.stroke()
      }
    }

    // Eye region overlays — dashed cyan border around detected eye regions
    const eyeRegions = findEyeRegions(grid)
    if (eyeRegions.length > 0) {
      ctx.strokeStyle = "rgba(0, 200, 255, 0.6)"
      ctx.lineWidth = 2
      ctx.setLineDash([4, 3])
      for (const eye of eyeRegions) {
        ctx.strokeRect(
          eye.wx * cellSize - 1,
          eye.wy * cellSize - 1,
          eye.ww * cellSize + 2,
          eye.wh * cellSize + 2,
        )
      }
      ctx.setLineDash([])
    }
  }, [grid, showGrid, activePalette, isDark])

  // ── Preview animation with eye tracking ──────────────────────────────────

  const previewMouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      previewMouseRef.current = { x: e.clientX, y: e.clientY }
    }
    window.addEventListener("mousemove", onMove, { passive: true })
    return () => window.removeEventListener("mousemove", onMove)
  }, [])

  useEffect(() => {
    const canvas = previewCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const palette = PALETTES[activePalette]
    const px = canvas.width / GRID_SIZE // pixel size
    let frameIdx = isPlaying ? 0 : currentFrameIdx
    const isIdle = currentState === "idle"

    const draw = () => {
      const f = currentFrames[frameIdx]
      if (!f) return
      const midX = window.innerWidth / 2
      const midY = window.innerHeight / 2
      const m = previewMouseRef.current
      const isRight = m.x >= midX
      const isDown = m.y >= midY
      let pupilPos: PupilPos = "center"
      if (isDown && isRight) pupilPos = "br"
      else if (isDown) pupilPos = "bl"
      else if (isRight) pupilPos = "tr"
      else pupilPos = "tl"

      renderFrameWithEyes(ctx, f, palette, px, pupilPos, isIdle)
    }

    if (isPlaying && currentFrames.length > 1) {
      draw()
      const interval = setInterval(() => {
        frameIdx = (frameIdx + 1) % currentFrames.length
        draw()
      }, 400)
      // Also track eyes at 10fps during playback in idle state
      if (isIdle) {
        const eyeInterval = setInterval(draw, 100)
        return () => { clearInterval(interval); clearInterval(eyeInterval) }
      }
      return () => clearInterval(interval)
    } else {
      draw()
      // Track eyes at 10fps for static frame preview in idle state
      if (isIdle) {
        const eyeInterval = setInterval(draw, 100)
        return () => clearInterval(eyeInterval)
      }
    }
  }, [isPlaying, currentFrames, currentFrameIdx, activePalette, currentState])

  // ── Frame operations ─────────────────────────────────────────────────────

  const addFrame = () => {
    setFrames((prev) => {
      const updated = { ...prev }
      updated[currentState] = [...updated[currentState], createEmptyGrid()]
      return updated
    })
    setCurrentFrameIdx(currentFrames.length)
  }

  const duplicateFrame = () => {
    setFrames((prev) => {
      const updated = { ...prev }
      updated[currentState] = [
        ...updated[currentState],
        cloneGrid(updated[currentState][currentFrameIdx]),
      ]
      return updated
    })
    setCurrentFrameIdx(currentFrames.length)
  }

  const deleteFrame = () => {
    if (currentFrames.length <= 1) return
    setFrames((prev) => {
      const updated = { ...prev }
      updated[currentState] = updated[currentState].filter(
        (_, i) => i !== currentFrameIdx
      )
      return updated
    })
    setCurrentFrameIdx(Math.max(0, currentFrameIdx - 1))
  }

  const clearFrame = () => {
    setUndoStack((prev) => [...prev.slice(-19), cloneGrid(grid)])
    setRedoStack([])
    setFrames((prev) => {
      const updated = { ...prev }
      const stateFrames = [...updated[currentState]]
      stateFrames[currentFrameIdx] = createEmptyGrid()
      updated[currentState] = stateFrames
      return updated
    })
  }

  const flipHorizontal = () => {
    setUndoStack((prev) => [...prev.slice(-19), cloneGrid(grid)])
    setRedoStack([])
    setFrames((prev) => {
      const updated = { ...prev }
      const stateFrames = [...updated[currentState]]
      stateFrames[currentFrameIdx] = stateFrames[currentFrameIdx].map((row) => [...row].reverse())
      updated[currentState] = stateFrames
      return updated
    })
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const undo = useCallback(() => {
    if (undoStack.length === 0) return
    const prev = undoStack[undoStack.length - 1]
    setRedoStack((s) => [...s.slice(-19), cloneGrid(grid)])
    setUndoStack((s) => s.slice(0, -1))
    setFrames((f) => {
      const updated = { ...f }
      const stateFrames = [...updated[currentState]]
      stateFrames[currentFrameIdx] = prev
      updated[currentState] = stateFrames
      return updated
    })
  }, [undoStack, currentState, currentFrameIdx, grid])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const redo = useCallback(() => {
    if (redoStack.length === 0) return
    const next = redoStack[redoStack.length - 1]
    setUndoStack((s) => [...s.slice(-19), cloneGrid(grid)])
    setRedoStack((s) => s.slice(0, -1))
    setFrames((f) => {
      const updated = { ...f }
      const stateFrames = [...updated[currentState]]
      stateFrames[currentFrameIdx] = next
      updated[currentState] = stateFrames
      return updated
    })
  }, [redoStack, currentState, currentFrameIdx, grid])

  // ── Import existing character ─────────────────────────────────────────────

  const importCharacter = (characterId: MascotCharacter) => {
    const charFrames = CHARACTER_FRAMES[characterId]
    const imported: Record<string, string[][][]> = {}
    for (const s of STATES) {
      imported[s] = charFrames[s].map((f) => f.map((row) => [...row]))
    }
    setFrames(imported as Record<MascotState, string[][][]>)
    setActivePalette(characterId)
    setCurrentState("idle")
    setCurrentFrameIdx(0)
    setUndoStack([])
    setIsPlaying(false)
  }

  // ── Export ────────────────────────────────────────────────────────────────

  const exportFrameData = () => {
    let output = "// Pixel Buddy - Custom Character Frame Data\n"
    output += "// Paste this into lib/mascot-characters.ts\n\n"

    for (const state of STATES) {
      const stateFrames = frames[state]
      stateFrames.forEach((f, fi) => {
        output += `const CUSTOM_${state.toUpperCase()}_${fi} = frame([\n`
        for (let y = 0; y < GRID_SIZE; y += 2) {
          const row1 = `"${f[y].join("")}"`
          const row2 = y + 1 < GRID_SIZE ? `, "${f[y + 1].join("")}"` : ""
          const comma = y + 2 < GRID_SIZE ? "," : ","
          output += `  ${row1}${row2}${comma}\n`
        }
        output += `])\n\n`
      })
    }

    output += `// Add to CHARACTER_FRAMES:\n`
    output += `// custom: {\n`
    for (const state of STATES) {
      const refs = frames[state]
        .map((_, i) => `CUSTOM_${state.toUpperCase()}_${i}`)
        .join(", ")
      output += `//   ${state}: [${refs}],\n`
    }
    output += `// },\n`

    // Copy to clipboard
    navigator.clipboard.writeText(output).then(() => {
      alert("Frame data copied to clipboard!")
    })
  }

  // ── Keyboard shortcuts ───────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      switch (e.key) {
        case "b": case "d": if (e.key === "d" && !e.ctrlKey) return; setTool("draw"); break
        case "e": setTool("erase"); break
        case "i": setTool("pick"); break
        case "g": setShowGrid((p) => !p); break
        case "z": if ((e.metaKey || e.ctrlKey) && e.shiftKey) { e.preventDefault(); redo() } else if (e.metaKey || e.ctrlKey) { e.preventDefault(); undo() } break
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [undo, redo])

  // Resolve a palette key to the active palette's color
  const paletteColor = (key: string): string | null => PALETTES[activePalette][key] ?? null

  return (
    <div className="space-y-5">
      {/* Import from existing character */}
      <div>
        <Label className="mb-2 block font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
          Start from existing
        </Label>
        <div className="flex flex-wrap gap-1.5">
          {MASCOT_CHARACTERS.map((c) => (
            <button
              key={c.id}
              onClick={() => importCharacter(c.id)}
              className="flex items-center gap-1.5 rounded-lg border border-border/50 px-3 py-2 text-xs transition-all hover:border-border hover:bg-muted/20"
            >
              <Import className="size-3 text-muted-foreground" />
              <span className="text-lg leading-none">{c.emoji}</span>
              <span className="font-medium">{c.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Palette selector */}
      <div>
        <Label className="mb-2 block font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
          Color Palette
        </Label>
        <div className="flex flex-wrap gap-1.5">
          {MASCOT_CHARACTERS.map((c) => (
            <button
              key={c.id}
              onClick={() => setActivePalette(c.id)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition-all ${
                activePalette === c.id
                  ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-400"
                  : "border-border/50 text-muted-foreground hover:border-border hover:bg-muted/20"
              }`}
            >
              <span className="text-lg leading-none">{c.emoji}</span>
              <span className="font-medium">{c.name}</span>
            </button>
          ))}
        </div>
      </div>

      <Separator className="bg-border/20" />

      {/* State selector */}
      <div>
        <Label className="mb-2 block font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
          Animation State
        </Label>
        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
          {STATES.map((s) => (
            <button
              key={s}
              onClick={() => { setCurrentState(s); setCurrentFrameIdx(0); setIsPlaying(false) }}
              className={`rounded-lg border px-2 py-2 font-mono text-xs font-medium transition-all ${
                currentState === s
                  ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-400 shadow-sm shadow-cyan-500/10"
                  : "border-border/50 text-muted-foreground hover:border-border hover:bg-muted/20"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Main editor area */}
      <div className="flex flex-col gap-5 lg:flex-row">
        {/* Canvas + tools */}
        <div className="flex-1 space-y-3">
          {/* Toolbar */}
          <div className="flex items-center gap-1.5">
            <div className="flex gap-1 rounded-lg border border-border/50 bg-muted/20 p-1">
              {([
                { t: "draw" as Tool, icon: Pencil, label: "Draw (B)" },
                { t: "erase" as Tool, icon: Eraser, label: "Erase (E)" },
                { t: "pick" as Tool, icon: Pipette, label: "Pick (I)" },
              ]).map(({ t, icon: Icon, label }) => (
                <button
                  key={t}
                  onClick={() => setTool(t)}
                  title={label}
                  className={`flex size-9 items-center justify-center rounded-md transition-all ${
                    tool === t
                      ? "bg-white/10 text-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  }`}
                >
                  <Icon className="size-4" />
                </button>
              ))}
            </div>

            <div className="h-5 w-px bg-border/30" />

            <button onClick={flipHorizontal} title="Flip horizontal" className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-all hover:bg-muted/30 hover:text-foreground">
              <FlipHorizontal className="size-4" />
            </button>
            <button onClick={undo} title="Undo (⌘Z)" className={`flex size-9 items-center justify-center rounded-md transition-all ${undoStack.length > 0 ? "text-muted-foreground hover:bg-muted/30 hover:text-foreground" : "text-muted-foreground/30"}`} disabled={undoStack.length === 0}>
              <RotateCcw className="size-4" />
            </button>
            <button onClick={redo} title="Redo (⌘⇧Z)" className={`flex size-9 items-center justify-center rounded-md transition-all ${redoStack.length > 0 ? "text-muted-foreground hover:bg-muted/30 hover:text-foreground" : "text-muted-foreground/30"}`} disabled={redoStack.length === 0}>
              <RotateCw className="size-4" />
            </button>
            <button onClick={() => setShowGrid((p) => !p)} title="Toggle grid (G)" className={`flex size-9 items-center justify-center rounded-md transition-all ${showGrid ? "bg-white/10 text-foreground" : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"}`}>
              <Grid3X3 className="size-4" />
            </button>
            <button onClick={clearFrame} title="Clear frame" className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-all hover:bg-red-500/20 hover:text-red-400">
              <Trash2 className="size-4" />
            </button>
          </div>

          {/* Canvas */}
          <div className={`relative overflow-hidden rounded-xl border border-border/50 ${isDark ? "bg-[#0d0d1a]" : "bg-[#f0f0f4]"}`}>
            <canvas
              ref={canvasRef}
              width={512}
              height={512}
              className="w-full cursor-crosshair"
              style={{ imageRendering: "pixelated" }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onContextMenu={(e) => e.preventDefault()}
            />
          </div>

          {/* Frame controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentFrameIdx(Math.max(0, currentFrameIdx - 1))}
              disabled={currentFrameIdx === 0}
              className="flex size-8 items-center justify-center rounded-md border border-border/50 text-muted-foreground transition-all hover:bg-muted/30 disabled:opacity-30"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="min-w-[80px] text-center font-mono text-xs text-muted-foreground">
              Frame {currentFrameIdx + 1} / {currentFrames.length}
            </span>
            <button
              onClick={() => setCurrentFrameIdx(Math.min(currentFrames.length - 1, currentFrameIdx + 1))}
              disabled={currentFrameIdx >= currentFrames.length - 1}
              className="flex size-8 items-center justify-center rounded-md border border-border/50 text-muted-foreground transition-all hover:bg-muted/30 disabled:opacity-30"
            >
              <ChevronRight className="size-4" />
            </button>

            <div className="h-5 w-px bg-border/30" />

            <button onClick={addFrame} className="rounded-md border border-border/50 px-2.5 py-1.5 font-mono text-xs text-muted-foreground transition-all hover:bg-muted/30 hover:text-foreground">
              + New
            </button>
            <button onClick={duplicateFrame} title="Duplicate frame" className="flex size-8 items-center justify-center rounded-md border border-border/50 text-muted-foreground transition-all hover:bg-muted/30 hover:text-foreground">
              <Copy className="size-3.5" />
            </button>
            {currentFrames.length > 1 && (
              <button onClick={deleteFrame} title="Delete frame" className="flex size-8 items-center justify-center rounded-md border border-border/50 text-muted-foreground transition-all hover:bg-red-500/20 hover:text-red-400">
                <Trash2 className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Right panel: palette + preview */}
        <div className="w-full space-y-4 lg:w-48">
          {/* Active color indicator */}
          <div className="flex items-center gap-2">
            <div
              className="size-8 rounded-md border border-border/50"
              style={{
                backgroundColor: paletteColor(activeKey) ?? "transparent",
                backgroundImage: activeKey === "." ? `repeating-conic-gradient(${isDark ? "#1a1a2e" : "#e8e8ec"} 0% 25%, ${isDark ? "#16162a" : "#dddde2"} 0% 50%) 50% / 8px 8px` : undefined,
              }}
            />
            <div>
              <p className="font-mono text-xs font-semibold text-foreground">
                {PALETTE_KEYS.find((p) => p.key === activeKey)?.label}
              </p>
              <p className="font-mono text-xs text-muted-foreground/50">key: {activeKey}</p>
            </div>
          </div>

          {/* Palette grid */}
          <div>
            <Label className="mb-1.5 block font-mono text-xs text-muted-foreground/60">
              Palette
            </Label>
            <div className="grid grid-cols-6 gap-1">
              {PALETTE_KEYS.map((p) => {
                const color = paletteColor(p.key)
                const isEyeKey = p.key === "W" || p.key === "K"
                return (
                  <button
                    key={p.key}
                    onClick={() => { setActiveKey(p.key); setTool("draw") }}
                    title={isEyeKey
                      ? p.key === "W"
                        ? "Eye White (W) — Paint eye regions with this. Pupils will track the cursor automatically. Min 3 wide, 2 tall."
                        : "Pupil (K) — Default pupil position. Dynamic tracking replaces these in idle state."
                      : `${p.label} (${p.key})`
                    }
                    className={`group relative size-7 rounded-md border transition-all ${
                      activeKey === p.key
                        ? "border-cyan-400/60 ring-1 ring-cyan-400/30 scale-110"
                        : isEyeKey
                          ? "border-cyan-400/30 hover:border-cyan-400/50 hover:scale-105"
                          : "border-border/40 hover:border-border hover:scale-105"
                    }`}
                    style={{
                      backgroundColor: color ?? "transparent",
                      backgroundImage: color === null ? `repeating-conic-gradient(${isDark ? "#1a1a2e" : "#e8e8ec"} 0% 25%, ${isDark ? "#16162a" : "#dddde2"} 0% 50%) 50% / 6px 6px` : undefined,
                    }}
                  >
                    {isEyeKey ? (
                      <Eye className="absolute inset-0 m-auto size-3 text-cyan-400/70 group-hover:text-cyan-300" style={{ mixBlendMode: p.key === "W" ? "difference" : "normal" }} />
                    ) : (
                      <span className="absolute inset-0 flex items-center justify-center font-mono text-xs font-bold opacity-0 mix-blend-difference group-hover:opacity-80" style={{ color: "#fff" }}>
                        {p.key}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            <p className="mt-1.5 flex items-start gap-1 text-xs text-muted-foreground/50">
              <Eye className="mt-0.5 size-3 shrink-0 text-cyan-400/50" />
              <span>Paint eyes with <strong className="text-cyan-400/70">W</strong> (white). Pupils follow the cursor in idle state. Min 3px wide, 2px tall.</span>
            </p>
          </div>

          <Separator className="bg-border/20" />

          {/* Preview */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label className="font-mono text-xs text-muted-foreground/60">
                Preview
              </Label>
              <button
                onClick={() => setIsPlaying((p) => !p)}
                disabled={currentFrames.length < 2}
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-all hover:bg-muted/30 hover:text-foreground disabled:opacity-30"
              >
                {isPlaying ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
              </button>
            </div>
            <div className={`flex justify-center rounded-xl border border-border/30 p-3 ${isDark ? "bg-[#0d0d1a]" : "bg-[#f0f0f4]"}`}>
              <canvas
                ref={previewCanvasRef}
                width={96}
                height={96}
                className="size-24"
                style={{ imageRendering: "pixelated" }}
              />
            </div>
          </div>

          <Separator className="bg-border/20" />

          {/* Save */}
          <div className="space-y-2">
            <Label className="font-mono text-xs text-muted-foreground/60">
              Save Character
            </Label>
            <div className="flex gap-1.5">
              <Input
                value={characterEmoji}
                onChange={(e) => setCharacterEmoji(e.target.value)}
                className="h-9 w-12 shrink-0 border-border/40 bg-transparent px-1 text-center text-lg"
                maxLength={2}
              />
              <Input
                value={characterName}
                onChange={(e) => setCharacterName(e.target.value)}
                placeholder="Character name..."
                className="h-9 border-border/40 bg-transparent text-xs"
              />
            </div>
            <Button
              onClick={saveCharacter}
              variant="outline"
              className="w-full gap-2 border-emerald-500/30 font-mono text-xs text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
            >
              <Save className="size-3.5" />
              {editingCharacterId ? "Update Character" : "Save Character"}
            </Button>
          </div>

          <Button
            onClick={exportFrameData}
            variant="outline"
            size="sm"
            className="w-full gap-2 border-border/30 font-mono text-xs text-muted-foreground hover:text-foreground"
          >
            <Download className="size-3.5" />
            Export Frame Data
          </Button>
        </div>
      </div>

      {/* Saved custom characters */}
      {customCharacters.length > 0 && (
        <>
          <Separator className="bg-border/20" />
          <div>
            <Label className="mb-2 block font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
              Saved Characters
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {customCharacters.map((c) => (
                <div
                  key={c.id}
                  className={`group flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition-all ${
                    editingCharacterId === c.id
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                      : "border-border/50 text-muted-foreground hover:border-border hover:bg-muted/20"
                  }`}
                >
                  <button
                    onClick={() => loadCustomCharacter(c)}
                    className="flex items-center gap-1.5"
                  >
                    <span className="text-lg leading-none">{c.emoji}</span>
                    <span className="font-medium">{c.name}</span>
                  </button>
                  <div className="flex gap-0.5">
                    <button
                      onClick={() => useAsActive(c.id)}
                      title="Use as active mascot"
                      className="flex size-7 items-center justify-center rounded-md text-muted-foreground/50 transition-all hover:bg-emerald-500/20 hover:text-emerald-400"
                    >
                      <Play className="size-3" />
                    </button>
                    <button
                      onClick={() => deleteChar(c.id)}
                      title="Delete character"
                      className="flex size-7 items-center justify-center rounded-md text-muted-foreground/50 transition-all hover:bg-red-500/20 hover:text-red-400"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
