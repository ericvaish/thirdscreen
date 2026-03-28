"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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

interface GridDashboardProps {
  editMode: boolean
  layout: DashboardLayout
  onLayoutChange: (layout: DashboardLayout) => void
}

export function GridDashboard({
  editMode,
  layout,
  onLayoutChange,
}: GridDashboardProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerHeight, setContainerHeight] = useState(600)
  const [containerWidth, setContainerWidth] = useState(1200)

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

  // Square cells: use the smaller of col width / row height so cells fit both dimensions
  const margin: [number, number] = [2, 2]
  const cellFromWidth = containerWidth > 0
    ? (containerWidth - margin[0] * (GRID_COLS - 1)) / GRID_COLS
    : 40
  const cellFromHeight = containerHeight > 0
    ? (containerHeight - margin[1] * (GRID_ROWS - 1)) / GRID_ROWS
    : 40
  const rowHeight = Math.min(cellFromWidth, cellFromHeight)

  const rglLayout = useMemo(() => dashboardLayoutToRGL(layout), [layout])

  // Track whether user is actively dragging/resizing to avoid
  // infinite loops from RGL's compaction-triggered onLayoutChange
  const interactingRef = useRef(false)

  const handleLayoutChange = useCallback(
    (newLayout: RGLLayoutItem[]) => {
      if (!interactingRef.current) return

      // Clamp all items to fit within the grid bounds
      const clamped = newLayout.map((item) => {
        const h = Math.min(item.h, GRID_ROWS - item.y)
        const y = Math.min(item.y, GRID_ROWS - 1)
        return { ...item, y, h: Math.max(h, 1) }
      })

      const allFit = clamped.every((item) => item.y + item.h <= GRID_ROWS)
      if (!allFit) return

      onLayoutChange(rglToDashboardLayout(clamped))
    },
    [onLayoutChange],
  )

  const handleDragStart = useCallback(() => {
    interactingRef.current = true
  }, [])

  const handleDragStop = useCallback(
    (newLayout: RGLLayoutItem[]) => {
      interactingRef.current = false
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
      onLayoutChange(rglToDashboardLayout(newLayout))
    },
    [onLayoutChange],
  )

  return (
    <div
      ref={containerRef}
      className={`relative min-h-0 flex-1 overflow-hidden ${editMode ? "edit-mode" : ""}`}
    >
      {/* Edit mode grid lines -- aligned to RGL snap grid */}
      {editMode && containerWidth > 0 && (() => {
        const rglColWidth = (containerWidth - margin[0] * (GRID_COLS - 1)) / GRID_COLS
        const stepX = rglColWidth + margin[0]
        const stepY = rowHeight + margin[1]

        return (
          <div
            className="pointer-events-none absolute inset-0 z-0"
            style={{
              backgroundImage: `
                linear-gradient(to right, oklch(0.6 0.1 200 / 0.12) 1px, transparent 1px),
                linear-gradient(to bottom, oklch(0.6 0.1 200 / 0.12) 1px, transparent 1px)
              `,
              backgroundSize: `${stepX}px ${stepY}px`,
            }}
          />
        )
      })()}

      <GridLayout
        layout={rglLayout}
        cols={GRID_COLS}
        maxRows={GRID_ROWS}
        rowHeight={rowHeight}
        width={containerWidth}
        margin={margin}
        containerPadding={[0, 0]}
        autoSize={false}
        isDraggable={editMode}
        isResizable={editMode}
        isBounded
        compactType="vertical"
        useCSSTransforms
        draggableHandle=".zone-drag-handle"
        onLayoutChange={handleLayoutChange}
        onDragStart={handleDragStart}
        onDragStop={handleDragStop}
        onResizeStart={handleResizeStart}
        onResize={(_layout, _oldItem, newItem) => {
          if (newItem.y + newItem.h > GRID_ROWS) {
            newItem.h = GRID_ROWS - newItem.y
          }
        }}
        onResizeStop={handleResizeStop}
        style={{ height: containerHeight }}
      >
        {rglLayout.map((item) => {
          const ZoneComponent = ZONE_COMPONENTS[item.i as ZoneId]
          return (
            <div key={item.i} className="h-full overflow-visible">
              <div className="h-full overflow-hidden rounded-lg">
                <ZoneComponent />
              </div>
            </div>
          )
        })}
      </GridLayout>
    </div>
  )
}
