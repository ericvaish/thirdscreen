"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { TimelineZone } from "@/components/zones/TimelineZone"
import { VitalsZone } from "@/components/zones/VitalsZone"
import { TasksZone } from "@/components/zones/TasksZone"
import { NotesZone } from "@/components/zones/NotesZone"
import { MediaZone } from "@/components/zones/MediaZone"
import { ClockZone } from "@/components/zones/ClockZone"
import { HabitsZone } from "@/components/zones/HabitsZone"
import { SmartHomeZone } from "@/components/zones/SmartHomeZone"
import { WeatherZone } from "@/components/zones/WeatherZone"
import { NewsZone } from "@/components/zones/NewsZone"

import {
  ZONE_IDS,
  ZONE_MIN_SIZES,
  DEFAULT_DASHBOARD_LAYOUT,
  getDefaultLayout,
  snapLayout,
  type DashboardLayout,
  type ZoneId,
  type ZonePosition,
} from "@/lib/grid-layout"
import { useDashboard } from "./DashboardContext"

const ZONE_COMPONENTS: Record<ZoneId, React.FC> = {
  timeline: TimelineZone,
  clock: ClockZone,
  tasks: TasksZone,
  notes: NotesZone,
  vitals: VitalsZone,
  media: MediaZone,
  habits: HabitsZone,
  smarthome: SmartHomeZone,
  weather: WeatherZone,
  news: NewsZone,
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
}: GridDashboardProps) {
  const { hiddenZones } = useDashboard()
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(1200)
  const [containerHeight, setContainerHeight] = useState(800)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width)
      setContainerHeight(entry.contentRect.height)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Target ~50px snap step on any screen. Compute percentage from actual container size.
  const TARGET_SNAP_PX = 50
  const SNAP_W = containerWidth > 0 ? Math.max(1, Math.round((TARGET_SNAP_PX / containerWidth) * 100)) : 3
  const SNAP_H = containerHeight > 0 ? Math.max(1, Math.round((TARGET_SNAP_PX / containerHeight) * 100)) : 5

  const snapW = (v: number) => Math.round(v / SNAP_W) * SNAP_W
  const snapH = (v: number) => Math.round(v / SNAP_H) * SNAP_H

  // Convert pixel deltas to percentage deltas
  const pxToW = useCallback((px: number) => (px / containerWidth) * 100, [containerWidth])
  const pxToH = useCallback((px: number) => (px / containerHeight) * 100, [containerHeight])

  const hasCustomized = useRef(false)
  const effectiveLayout = useMemo(() => {
    const isDefault = JSON.stringify(layout) === JSON.stringify(DEFAULT_DASHBOARD_LAYOUT)
    if (hasCustomized.current || !isDefault) return layout
    // Snap the default layout to the 50px-based grid
    return snapLayout(getDefaultLayout(), SNAP_W, SNAP_H)
  }, [layout, SNAP_W, SNAP_H])

  // When reset is triggered (layout becomes default again), clear customized flag
  useEffect(() => {
    if (JSON.stringify(layout) === JSON.stringify(DEFAULT_DASHBOARD_LAYOUT)) {
      hasCustomized.current = false
    }
  }, [layout])

  // Drag state
  const [dragging, setDragging] = useState<{
    zoneId: ZoneId
    startX: number
    startY: number
    startPos: ZonePosition
  } | null>(null)

  // Resize state
  const [resizing, setResizing] = useState<{
    zoneId: ZoneId
    corner: string
    startX: number
    startY: number
    startPos: ZonePosition
  } | null>(null)

  const handleDragStart = useCallback(
    (zoneId: ZoneId, e: React.PointerEvent) => {
      if (!editMode) return
      hasCustomized.current = true
      const pos = effectiveLayout[zoneId]
      setDragging({ zoneId, startX: e.clientX, startY: e.clientY, startPos: { ...pos } })
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    },
    [editMode, effectiveLayout],
  )

  const handleResizeStart = useCallback(
    (zoneId: ZoneId, corner: string, e: React.PointerEvent) => {
      if (!editMode) return
      e.stopPropagation()
      hasCustomized.current = true
      const pos = effectiveLayout[zoneId]
      setResizing({ zoneId, corner, startX: e.clientX, startY: e.clientY, startPos: { ...pos } })
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    },
    [editMode, effectiveLayout],
  )

  // Check if two rects overlap
  const overlaps = useCallback((a: ZonePosition, b: ZonePosition) => {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  }, [])

  // Check if a zone collides with any other zone
  const hasCollision = useCallback((zoneId: ZoneId, pos: ZonePosition, layout: DashboardLayout) => {
    return ZONE_IDS.some((id) => id !== zoneId && layout[id] && overlaps(pos, layout[id]))
  }, [overlaps])

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (dragging) {
        const dx = pxToW(e.clientX - dragging.startX)
        const dy = pxToH(e.clientY - dragging.startY)
        const rawX = dragging.startPos.x + dx
        const rawY = dragging.startPos.y + dy
        const newPos = {
          ...dragging.startPos,
          x: snapW(Math.max(0, Math.min(100 - dragging.startPos.w, rawX))),
          y: snapH(Math.max(0, Math.min(100 - dragging.startPos.h, rawY))),
        }
        const testLayout = { ...effectiveLayout, [dragging.zoneId]: newPos }
        if (!hasCollision(dragging.zoneId, newPos, testLayout)) {
          onLayoutChange(testLayout)
        }
      }
      if (resizing) {
        const dx = pxToW(e.clientX - resizing.startX)
        const dy = pxToH(e.clientY - resizing.startY)
        const mins = minSizes[resizing.zoneId] ?? ZONE_MIN_SIZES[resizing.zoneId]
        const pos = resizing.startPos
        const newLayout = { ...effectiveLayout }
        let newPos = { ...pos }

        const { corner } = resizing
        if (corner === "se") {
          newPos.w = snapW(Math.max(mins.minW, Math.min(100 - pos.x, pos.w + dx)))
          newPos.h = snapH(Math.max(mins.minH, Math.min(100 - pos.y, pos.h + dy)))
        } else if (corner === "sw") {
          const newW = snapW(Math.max(mins.minW, pos.w - dx))
          const newX = snapW(Math.max(0, pos.x + (pos.w - newW)))
          newPos.x = newX
          newPos.w = snapW(Math.min(100 - newX, newW))
          newPos.h = snapH(Math.max(mins.minH, Math.min(100 - pos.y, pos.h + dy)))
        } else if (corner === "ne") {
          newPos.w = snapW(Math.max(mins.minW, Math.min(100 - pos.x, pos.w + dx)))
          const newH = snapH(Math.max(mins.minH, pos.h - dy))
          const newY = snapH(Math.max(0, pos.y + (pos.h - newH)))
          newPos.y = newY
          newPos.h = snapH(Math.min(100 - newY, newH))
        } else if (corner === "nw") {
          const newW = snapW(Math.max(mins.minW, pos.w - dx))
          const newX = snapW(Math.max(0, pos.x + (pos.w - newW)))
          newPos.x = newX
          newPos.w = snapW(Math.min(100 - newX, newW))
          const newH = snapH(Math.max(mins.minH, pos.h - dy))
          const newY = snapH(Math.max(0, pos.y + (pos.h - newH)))
          newPos.y = newY
          newPos.h = snapH(Math.min(100 - newY, newH))
        }

        const testLayout = { ...effectiveLayout, [resizing.zoneId]: newPos }
        if (!hasCollision(resizing.zoneId, newPos, testLayout)) {
          onLayoutChange(testLayout)
        }
      }
    },
    [dragging, resizing, effectiveLayout, onLayoutChange, minSizes, pxToW, pxToH, hasCollision],
  )

  const handlePointerUp = useCallback(() => {
    setDragging(null)
    setResizing(null)
  }, [])

  const corners = ["nw", "ne", "sw", "se"]

  return (
    <div
      ref={containerRef}
      className={`relative min-h-0 flex-1 overflow-auto px-1 py-1 ${editMode ? "edit-mode" : ""}`}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {ZONE_IDS.map((zoneId) => {
        if (hiddenZones.includes(zoneId)) return null
        const pos = effectiveLayout[zoneId]
        if (!pos) return null
        const ZoneComponent = ZONE_COMPONENTS[zoneId]
        const isDragging = dragging?.zoneId === zoneId
        const isResizing = resizing?.zoneId === zoneId

        return (
          <div
            key={zoneId}
            className="absolute"
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              width: `${pos.w}%`,
              height: `${pos.h}%`,
              zIndex: isDragging || isResizing ? 50 : 1,
              opacity: isDragging ? 0.9 : 1,
              transition: isDragging || isResizing ? "none" : "left 0.15s, top 0.15s, width 0.15s, height 0.15s",
              padding: 2,
            }}
          >
            <div className="h-full overflow-hidden rounded-lg">
              <ZoneComponent />
            </div>

            {/* Drag handle -- covers the header area */}
            {editMode && (
              <div
                className="absolute top-0 left-0 right-0 z-40 h-12 cursor-grab active:cursor-grabbing"
                style={{ touchAction: "none" }}
                onPointerDown={(e) => handleDragStart(zoneId, e)}
              />
            )}

            {/* Corner resize handles */}
            {editMode && corners.map((corner) => (
              <div
                key={corner}
                onPointerDown={(e) => handleResizeStart(zoneId, corner, e)}
                className="absolute z-50"
                style={{
                  width: 44,
                  height: 44,
                  cursor: corner === "nw" || corner === "se" ? "nwse-resize" : "nesw-resize",
                  touchAction: "none",
                  ...(corner.includes("n") ? { top: 0 } : { bottom: 0 }),
                  ...(corner.includes("w") ? { left: 0 } : { right: 0 }),
                }}
              >
                <div
                  className="absolute"
                  style={{
                    width: 18,
                    height: 18,
                    borderStyle: "solid",
                    borderColor: "oklch(0.75 0.15 200 / 0.85)",
                    ...(corner === "se" ? { right: 4, bottom: 4, borderWidth: "0 3px 3px 0", borderRadius: "0 0 6px 0" } : {}),
                    ...(corner === "sw" ? { left: 4, bottom: 4, borderWidth: "0 0 3px 3px", borderRadius: "0 0 0 6px" } : {}),
                    ...(corner === "ne" ? { right: 4, top: 4, borderWidth: "3px 3px 0 0", borderRadius: "0 6px 0 0" } : {}),
                    ...(corner === "nw" ? { left: 4, top: 4, borderWidth: "3px 0 0 3px", borderRadius: "6px 0 0 0" } : {}),
                  }}
                />
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
