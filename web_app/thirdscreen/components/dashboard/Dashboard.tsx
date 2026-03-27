"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { TimelineZone } from "@/components/zones/TimelineZone"
import { VitalsZone } from "@/components/zones/VitalsZone"
import { TasksZone } from "@/components/zones/TasksZone"
import { NotesZone } from "@/components/zones/NotesZone"
import { MediaZone } from "@/components/zones/MediaZone"
import { StatusBar } from "@/components/zones/StatusBar"
import { SettingsView } from "./SettingsView"
import { Button } from "@/components/ui/button"
import { LayoutGrid, Settings, ArrowLeft, Grid3x3, Sun, Moon, Monitor, Maximize, Minimize } from "lucide-react"
import { useTheme } from "next-themes"
import { useAuth, UserButton, SignInButton } from "@clerk/nextjs"
import { getSettings, setSetting } from "@/lib/data-layer"

// ── Grid layout config ──────────────────────────────────────────────────────

const GRID_COLS = 12
const GRID_ROWS = 9

interface GridLayout {
  timelineEnd: number
  sidebarStart: number
  taskEnd: number
  mediaEnd: number
}

const DEFAULT_LAYOUT: GridLayout = {
  timelineEnd: 2,
  sidebarStart: 9,
  taskEnd: 4,
  mediaEnd: 7,
}

type View = "dashboard" | "settings"

const THEME_CYCLE = ["dark", "light", "system"] as const
const THEME_ICON = { dark: Moon, light: Sun, system: Monitor }

// ── Dashboard ───────────────────────────────────────────────────────────────

export function Dashboard() {
  const [view, setView] = useState<View>("dashboard")
  const { theme, setTheme } = useTheme()
  const [layout, setLayout] = useState<GridLayout>(DEFAULT_LAYOUT)
  const [editMode, setEditMode] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const gridRef = useRef<HTMLDivElement>(null)
  const { isSignedIn, isLoaded: authLoaded } = useAuth()
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener("fullscreenchange", onFsChange)
    return () => document.removeEventListener("fullscreenchange", onFsChange)
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      document.documentElement.requestFullscreen()
    }
  }, [])

  useEffect(() => {
    getSettings()
      .then((s) => {
        const settings = s as Record<string, unknown>
        if (settings.dashboardLayout && typeof settings.dashboardLayout === "object") {
          const saved = settings.dashboardLayout as Partial<GridLayout>
          setLayout((prev) => ({ ...prev, ...saved }))
        }
      })
      .catch(() => {})
  }, [])

  const persistLayout = useCallback((l: GridLayout) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      setSetting("dashboardLayout", l).catch(() => {})
    }, 300)
  }, [])

  const updateLayout = useCallback(
    (patch: Partial<GridLayout>) => {
      setLayout((prev) => {
        const next = { ...prev, ...patch }
        persistLayout(next)
        return next
      })
    },
    [persistLayout]
  )

  const gridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
    gridTemplateRows: `repeat(${GRID_ROWS}, 1fr) 2.25rem`,
    gap: "0.25rem",
    padding: "0.25rem",
    flex: 1,
    minHeight: 0,
  }

  const { timelineEnd, sidebarStart, taskEnd, mediaEnd } = layout

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      {/* Header */}
      <header className="h-12 shrink-0 bg-background/80 backdrop-blur-xl">
        <div className="flex h-full items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            {view !== "dashboard" ? (
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setView("dashboard")}
                className="text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="size-4" />
              </Button>
            ) : (
              <img src="/logo.png" alt="Third Screen" className="size-5 rounded dark:invert" />
            )}
            <h1 className="font-[family-name:var(--font-display)] text-sm font-bold tracking-tight">
              {view === "dashboard" ? "Third Screen" : "Settings"}
            </h1>
          </div>
          <div className="flex items-center gap-1">
            {view === "dashboard" && (
              <>
                {mounted && (() => {
                  const current = (theme ?? "system") as keyof typeof THEME_ICON
                  const ThemeIcon = THEME_ICON[current] ?? Monitor
                  const nextTheme = THEME_CYCLE[(THEME_CYCLE.indexOf(current as typeof THEME_CYCLE[number]) + 1) % THEME_CYCLE.length]
                  return (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => setTheme(nextTheme)}
                      className="text-muted-foreground hover:text-foreground"
                      title={`Theme: ${current}`}
                    >
                      <ThemeIcon className="size-4" />
                    </Button>
                  )
                })()}
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={toggleFullscreen}
                  className="text-muted-foreground hover:text-foreground"
                  title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                >
                  {isFullscreen ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
                </Button>
                <Button
                  variant={editMode ? "secondary" : "ghost"}
                  size="icon-xs"
                  onClick={() => setEditMode(!editMode)}
                  className={editMode ? "text-primary" : "text-muted-foreground hover:text-foreground"}
                  title="Edit layout"
                >
                  <Grid3x3 className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setView("settings")}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Settings className="size-4" />
                </Button>
              </>
            )}
            {mounted && authLoaded && (
              isSignedIn ? (
                <UserButton
                  appearance={{
                    elements: {
                      avatarBox: "size-6",
                    },
                  }}
                />
              ) : (
                <SignInButton mode="modal">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Sign in
                  </Button>
                </SignInButton>
              )
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      {view === "dashboard" ? (
        <div ref={gridRef} style={gridStyle} className="relative">
          {/* Grid overlay in edit mode */}
          {editMode && (
            <div
              className="pointer-events-none absolute inset-1 z-20"
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
                gridTemplateRows: `repeat(${GRID_ROWS}, 1fr) 2.25rem`,
                gap: "0.25rem",
              }}
            >
              {Array.from({ length: GRID_COLS * (GRID_ROWS + 1) }, (_, i) => (
                <div
                  key={i}
                  className="rounded border border-dashed border-primary/10"
                />
              ))}
            </div>
          )}

          {/* Timeline */}
          <div
            className="min-h-0 min-w-0 overflow-hidden"
            style={{
              gridColumn: `1 / ${GRID_COLS + 1}`,
              gridRow: `1 / ${timelineEnd + 1}`,
            }}
          >
            <TimelineZone />
          </div>

          {/* Tasks */}
          <div
            className="min-h-0 min-w-0 overflow-hidden"
            style={{
              gridColumn: `1 / ${sidebarStart}`,
              gridRow: `${timelineEnd + 1} / ${taskEnd + 1}`,
            }}
          >
            <TasksZone />
          </div>

          {/* Vitals */}
          <div
            className="min-h-0 min-w-0 overflow-hidden"
            style={{
              gridColumn: `${sidebarStart} / ${GRID_COLS + 1}`,
              gridRow: `${timelineEnd + 1} / ${GRID_ROWS + 1}`,
            }}
          >
            <VitalsZone />
          </div>

          {/* Media */}
          <div
            className="min-h-0 min-w-0 overflow-hidden"
            style={{
              gridColumn: `1 / ${sidebarStart}`,
              gridRow: `${taskEnd + 1} / ${mediaEnd + 1}`,
            }}
          >
            <MediaZone />
          </div>

          {/* Notes */}
          <div
            className="min-h-0 min-w-0 overflow-hidden"
            style={{
              gridColumn: `1 / ${sidebarStart}`,
              gridRow: `${mediaEnd + 1} / ${GRID_ROWS + 1}`,
            }}
          >
            <NotesZone />
          </div>

          {/* Status bar */}
          <div
            className="overflow-hidden"
            style={{
              gridColumn: `1 / ${GRID_COLS + 1}`,
              gridRow: `${GRID_ROWS + 1} / ${GRID_ROWS + 2}`,
            }}
          >
            <StatusBar />
          </div>

          {/* ── Drag handles (edit mode only) ─────────────────────────── */}
          {editMode && gridRef.current && (
            <>
              {/* Between timeline and tasks/vitals */}
              <DragHandle
                gridRef={gridRef}
                axis="row"
                value={timelineEnd}
                min={1}
                max={Math.min(4, taskEnd - 1)}
                gridTotal={GRID_ROWS}
                onChange={(v) => updateLayout({ timelineEnd: v })}
                style={{
                  gridColumn: `1 / ${GRID_COLS + 1}`,
                  gridRow: `${timelineEnd + 1} / ${timelineEnd + 1}`,
                  alignSelf: "start",
                }}
              />

              {/* Between tasks and media */}
              <DragHandle
                gridRef={gridRef}
                axis="row"
                value={taskEnd}
                min={timelineEnd + 1}
                max={mediaEnd - 1}
                gridTotal={GRID_ROWS}
                onChange={(v) => updateLayout({ taskEnd: v })}
                style={{
                  gridColumn: `1 / ${sidebarStart}`,
                  gridRow: `${taskEnd + 1} / ${taskEnd + 1}`,
                  alignSelf: "start",
                }}
              />

              {/* Between media and notes */}
              <DragHandle
                gridRef={gridRef}
                axis="row"
                value={mediaEnd}
                min={taskEnd + 1}
                max={GRID_ROWS - 1}
                gridTotal={GRID_ROWS}
                onChange={(v) => updateLayout({ mediaEnd: v })}
                style={{
                  gridColumn: `1 / ${sidebarStart}`,
                  gridRow: `${mediaEnd + 1} / ${mediaEnd + 1}`,
                  alignSelf: "start",
                }}
              />

              {/* Vertical: between main and sidebar */}
              <DragHandle
                gridRef={gridRef}
                axis="col"
                value={sidebarStart}
                min={6}
                max={11}
                gridTotal={GRID_COLS}
                onChange={(v) => updateLayout({ sidebarStart: v })}
                style={{
                  gridColumn: `${sidebarStart} / ${sidebarStart}`,
                  gridRow: `${timelineEnd + 1} / ${GRID_ROWS + 1}`,
                  justifySelf: "start",
                }}
              />
            </>
          )}
        </div>
      ) : (
        <SettingsView />
      )}
    </div>
  )
}

// ── Drag Handle ─────────────────────────────────────────────────────────────

interface DragHandleProps {
  gridRef: React.RefObject<HTMLDivElement | null>
  axis: "row" | "col"
  value: number
  min: number
  max: number
  gridTotal: number
  onChange: (value: number) => void
  style: React.CSSProperties
}

function DragHandle({
  gridRef,
  axis,
  value,
  min,
  max,
  gridTotal,
  onChange,
  style,
}: DragHandleProps) {
  const handleRef = useRef<HTMLDivElement>(null)

  const latestRef = useRef({ value, min, max })
  latestRef.current = { value, min, max }

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const el = handleRef.current
      if (!el || !gridRef.current) return

      el.setPointerCapture(e.pointerId)

      const gridRect = gridRef.current.getBoundingClientRect()
      const gap = 4
      const padding = 4
      const statusBarHeight = 36

      const onMove = (ev: PointerEvent) => {
        const { min: curMin, max: curMax } = latestRef.current

        if (axis === "row") {
          const totalHeight = gridRect.height - padding * 2 - statusBarHeight - gap
          const cellHeight = (totalHeight - gap * (gridTotal - 1)) / gridTotal
          const relY = ev.clientY - gridRect.top - padding
          const newRow = Math.round(relY / (cellHeight + gap))
          const clamped = Math.max(curMin, Math.min(curMax, newRow))
          onChange(clamped)
        } else {
          const totalWidth = gridRect.width - padding * 2
          const cellWidth = (totalWidth - gap * (GRID_COLS - 1)) / GRID_COLS
          const relX = ev.clientX - gridRect.left - padding
          const newCol = Math.round(relX / (cellWidth + gap)) + 1
          const clamped = Math.max(curMin, Math.min(curMax, newCol))
          onChange(clamped)
        }
      }

      const onUp = () => {
        el.removeEventListener("pointermove", onMove)
        el.removeEventListener("pointerup", onUp)
      }

      el.addEventListener("pointermove", onMove)
      el.addEventListener("pointerup", onUp)
    },
    [axis, gridRef, gridTotal, onChange]
  )

  const isRow = axis === "row"

  return (
    <div
      ref={handleRef}
      onPointerDown={onPointerDown}
      className={`z-30 flex items-center justify-center ${
        isRow
          ? "h-4 w-full cursor-row-resize -translate-y-1/2"
          : "h-full w-4 cursor-col-resize -translate-x-1/2"
      }`}
      style={style}
    >
      <div
        className={`flex items-center justify-center rounded-full border border-primary/30 bg-background transition-colors hover:border-primary/60 hover:bg-primary/10 ${
          isRow ? "h-5 w-10 flex-row gap-0.5" : "h-10 w-5 flex-col gap-0.5"
        }`}
      >
        <div className="size-1 rounded-full bg-primary/50" />
        <div className="size-1 rounded-full bg-primary/50" />
        <div className="size-1 rounded-full bg-primary/50" />
      </div>
    </div>
  )
}
