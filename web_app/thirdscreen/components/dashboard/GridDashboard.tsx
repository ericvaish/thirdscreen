"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Minus, Plus } from "lucide-react"
import { GridLayout } from "react-grid-layout"
import "react-grid-layout/css/styles.css"
import "react-resizable/css/styles.css"

import { TimelineZone } from "@/components/zones/TimelineZone"
import { VitalsZone } from "@/components/zones/VitalsZone"
import { TasksZone } from "@/components/zones/TasksZone"
import { NotesZone } from "@/components/zones/NotesZone"
import { MediaZone } from "@/components/zones/MediaZone"

import {
  GRID_COLS,
  GRID_ROWS,
  ZONE_MIN_SIZES,
  dashboardLayoutToRGL,
  rglToDashboardLayout,
  type DashboardLayout,
  type RGLLayoutItem,
  type ZoneId,
} from "@/lib/grid-layout"

// Map zone IDs to their React components
const ZONE_COMPONENTS: Record<ZoneId, React.FC> = {
  timeline: TimelineZone,
  tasks: TasksZone,
  notes: NotesZone,
  vitals: VitalsZone,
  media: MediaZone,
}

export type MinSizes = Record<string, { minW: number; minH: number }>

interface GridDashboardProps {
  editMode: boolean
  layout: DashboardLayout
  onLayoutChange: (layout: DashboardLayout) => void
  minSizes: MinSizes
  onMinSizesChange: (minSizes: MinSizes) => void
}

export function GridDashboard({
  editMode,
  layout,
  onLayoutChange,
  minSizes,
  onMinSizesChange,
}: GridDashboardProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerHeight, setContainerHeight] = useState(600)
  const [containerWidth, setContainerWidth] = useState(1200)

  const adjustMin = useCallback((zoneId: string, dim: "minW" | "minH", delta: number) => {
    const current = minSizes[zoneId] ?? ZONE_MIN_SIZES[zoneId as ZoneId]
    const updated = {
      ...minSizes,
      [zoneId]: {
        ...current,
        [dim]: Math.max(1, (current[dim] ?? 1) + delta),
      },
    }
    onMinSizesChange(updated)
  }, [minSizes, onMinSizesChange])

  // Track container size for dynamic row height
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      setContainerHeight(entry.contentRect.height)
      setContainerWidth(entry.contentRect.width)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const margin: [number, number] = [2, 2]
  const rowHeight = containerHeight > 0
    ? (containerHeight - margin[1] * (GRID_ROWS - 1)) / GRID_ROWS
    : 40

  const rglLayout = useMemo(() => {
    const items = dashboardLayoutToRGL(layout)
    // Apply adjusted min sizes
    const withMins = items.map((item) => {
      const override = minSizes[item.i]
      if (override) {
        return { ...item, minW: override.minW, minH: override.minH }
      }
      return item
    })
    if (!editMode) {
      return withMins.map((item) => ({ ...item, static: true }))
    }
    return withMins
  }, [layout, editMode, minSizes])

  // Track whether user is actively dragging/resizing to avoid
  // infinite loops from RGL's compaction-triggered onLayoutChange
  const interactingRef = useRef(false)

  const handleLayoutChange = useCallback(
    (newLayout: RGLLayoutItem[]) => {
      if (!interactingRef.current) return
      console.log("[GridDashboard] Layout change from RGL (interacting)")
      onLayoutChange(rglToDashboardLayout(newLayout))
    },
    [onLayoutChange],
  )

  const handleDragStart = useCallback(() => {
    interactingRef.current = true
  }, [])

  const handleDragStop = useCallback(
    (newLayout: RGLLayoutItem[]) => {
      interactingRef.current = false
      console.log("[GridDashboard] Drag stop - saving layout")
      onLayoutChange(rglToDashboardLayout(newLayout))
    },
    [onLayoutChange],
  )

  const handleResizeStart = useCallback(() => {
    interactingRef.current = true
  }, [])

  const handleResizeStop = useCallback(
    (newLayout: RGLLayoutItem[]) => {
      interactingRef.current = false
      console.log("[GridDashboard] Resize stop - saving layout")
      onLayoutChange(rglToDashboardLayout(newLayout))
    },
    [onLayoutChange],
  )

  return (
    <div
      ref={containerRef}
      className={`relative min-h-0 flex-1 overflow-auto ${editMode ? "edit-mode" : ""}`}
      style={editMode ? {
        backgroundImage: "radial-gradient(circle, oklch(0.6 0.1 200 / 0.2) 1px, transparent 1px)",
        backgroundSize: "20px 20px",
      } : undefined}
    >
      {/* Edit mode dot grid -- applied to the scrollable container itself */}

      <GridLayout
        layout={rglLayout}
        cols={GRID_COLS}
        rowHeight={rowHeight}
        width={containerWidth}
        margin={margin}
        containerPadding={[0, 0]}
        isDraggable={editMode}
        isResizable={editMode}
        compactType="vertical"
        useCSSTransforms
        draggableHandle=".zone-drag-handle"
        onLayoutChange={handleLayoutChange}
        onDragStart={handleDragStart}
        onDragStop={handleDragStop}
        onResizeStart={handleResizeStart}
        onResizeStop={handleResizeStop}
      >
        {rglLayout.map((item) => {
          const ZoneComponent = ZONE_COMPONENTS[item.i as ZoneId]
          const mins = minSizes[item.i] ?? ZONE_MIN_SIZES[item.i as ZoneId]
          return (
            <div key={item.i} className="h-full overflow-visible">
              <div className="h-full overflow-hidden rounded-lg">
                <ZoneComponent />
              </div>
              {editMode && (
                <div className="absolute bottom-1 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-border/30 bg-background/90 px-2 py-1 shadow-lg backdrop-blur-sm">
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-[0.5rem] text-muted-foreground/50">W</span>
                    <button onClick={() => adjustMin(item.i, "minW", -1)} className="flex size-6 items-center justify-center rounded text-muted-foreground/50 hover:bg-muted/30 hover:text-foreground">
                      <Minus className="size-2.5" />
                    </button>
                    <span className="w-4 text-center font-mono text-[0.625rem] font-bold text-foreground/70">{mins.minW}</span>
                    <button onClick={() => adjustMin(item.i, "minW", 1)} className="flex size-6 items-center justify-center rounded text-muted-foreground/50 hover:bg-muted/30 hover:text-foreground">
                      <Plus className="size-2.5" />
                    </button>
                  </div>
                  <div className="h-3 w-px bg-border/20" />
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-[0.5rem] text-muted-foreground/50">H</span>
                    <button onClick={() => adjustMin(item.i, "minH", -1)} className="flex size-6 items-center justify-center rounded text-muted-foreground/50 hover:bg-muted/30 hover:text-foreground">
                      <Minus className="size-2.5" />
                    </button>
                    <span className="w-4 text-center font-mono text-[0.625rem] font-bold text-foreground/70">{mins.minH}</span>
                    <button onClick={() => adjustMin(item.i, "minH", 1)} className="flex size-6 items-center justify-center rounded text-muted-foreground/50 hover:bg-muted/30 hover:text-foreground">
                      <Plus className="size-2.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </GridLayout>
    </div>
  )
}
