"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragOverlay,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  useSortable,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

import { AdaptiveSurface } from "@/components/AdaptiveSurface"

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
  CELL_SIZE_PX,
  MIN_GRID_COLS,
  WIDGET_SIZES,
  WIDGET_SIZE_LABELS,
  ZONE_ALLOWED_SIZES,
  packLayout,
  getPackedRows,
  setZoneSize,
  type DashboardLayout,
  type ZoneId,
  type WidgetSize,
  type ZonePosition,
} from "@/lib/grid-layout"
import { useDashboard } from "./DashboardContext"
import { Maximize2, ChevronRight } from "lucide-react"
import {
  ZoneActionsProvider,
  useZoneActionsRegistry,
  type ZoneAction,
} from "@/lib/zone-actions"

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

// Kept for prop-compat with Dashboard.tsx (legacy MinSizes prop).
export type MinSizes = Record<string, { minW: number; minH: number }>

interface GridDashboardProps {
  editMode: boolean
  layout: DashboardLayout
  onLayoutChange: (layout: DashboardLayout) => void
  minSizes?: MinSizes
  onMinSizesChange?: (minSizes: MinSizes) => void
}

export function GridDashboard(props: GridDashboardProps) {
  return (
    <ZoneActionsProvider>
      <GridDashboardInner {...props} />
    </ZoneActionsProvider>
  )
}

function GridDashboardInner({
  editMode,
  layout,
  onLayoutChange,
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

  const cellSize = CELL_SIZE_PX
  const cols = Math.max(MIN_GRID_COLS, Math.floor(containerWidth / cellSize))

  // Pack the layout into grid-cell positions.
  const positions = useMemo(
    () => packLayout(layout, cols, hiddenZones),
    [layout, cols, hiddenZones],
  )
  const packedRows = useMemo(() => getPackedRows(positions), [positions])

  // Actual horizontal extent used by packed widgets — typically less than `cols`
  // when widget widths don't sum to the full column count. Centering the grid
  // by this value (rather than `cols * cellSize`) keeps left/right wallpaper
  // margins symmetric instead of letting trailing empty cells push everything
  // visually leftward.
  const usedCols = useMemo(() => {
    let max = 0
    for (const id in positions) {
      const p = positions[id]
      if (p.x + p.w > max) max = p.x + p.w
    }
    return max || cols
  }, [positions, cols])

  // Use Math.floor so the gap-fill row count never exceeds the available
  // viewport height (Math.ceil would round 10.06 → 11 rows = 80px of phantom
  // overflow that triggers a scrollbar even when the cards perfectly fit).
  const minRowsToFill = containerHeight > 0 ? Math.floor(containerHeight / cellSize) : 0
  const totalRows = Math.max(packedRows, minRowsToFill, 1)
  // Clamp the rendered grid height to the visible area whenever the packed
  // content fits — only let it grow taller (and become scrollable) when there
  // are genuinely more cards than fit on screen.
  const containerHeightPx =
    packedRows <= minRowsToFill && containerHeight > 0
      ? containerHeight
      : totalRows * cellSize

  // ── dnd-kit setup ────────────────────────────────────────────────────────

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const [activeId, setActiveId] = useState<ZoneId | null>(null)
  const [overId, setOverId] = useState<ZoneId | null>(null)

  const visibleIds = useMemo(
    () => layout.zones.filter((z) => !hiddenZones.includes(z.id)).map((z) => z.id),
    [layout.zones, hiddenZones],
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as ZoneId)
    setOverId(event.active.id as ZoneId)
    if (typeof window !== "undefined") {
      window.getSelection()?.removeAllRanges()
    }
  }, [])

  // Track which sortable the cursor is over, for snap-preview only. We do
  // NOT mutate the layout here — that would trigger pack/measure feedback
  // loops. Layout commit happens in onDragEnd.
  const handleDragOver = useCallback((event: DragOverEvent) => {
    const next = (event.over?.id as ZoneId | undefined) ?? null
    setOverId((prev) => (prev === next ? prev : next))
  }, [])

  // Commit the reorder only on drag end. During the drag, dnd-kit applies
  // its own visual transforms to preview the new positions; mutating the
  // array mid-drag causes pack/measure feedback loops.
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      setActiveId(null)
      setOverId(null)
      if (!over || active.id === over.id) return
      const oldIndex = layout.zones.findIndex((z) => z.id === active.id)
      const newIndex = layout.zones.findIndex((z) => z.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return
      const nextZones = arrayMove(layout.zones, oldIndex, newIndex)
      onLayoutChange({ ...layout, zones: nextZones })
    },
    [layout, onLayoutChange],
  )

  const handleDragCancel = useCallback(() => {
    setActiveId(null)
    setOverId(null)
  }, [])

  // Simulate the in-progress reorder and re-pack the whole layout so every
  // widget knows where it would land. This drives the live preview AND the
  // visible widget positions during drag (replacing dnd-kit's flow-based
  // slide animations, which assume uniform sizes and cause overlaps with
  // mixed widget sizes + bin-packing).
  const previewPositions = useMemo(() => {
    if (!activeId || !overId || activeId === overId) return null
    const oldIndex = layout.zones.findIndex((z) => z.id === activeId)
    const newIndex = layout.zones.findIndex((z) => z.id === overId)
    if (oldIndex === -1 || newIndex === -1) return null
    const previewZones = arrayMove(layout.zones, oldIndex, newIndex)
    return packLayout({ ...layout, zones: previewZones }, cols, hiddenZones)
  }, [activeId, overId, layout, cols, hiddenZones])

  const previewPos = activeId && previewPositions ? previewPositions[activeId] ?? null : null

  // Effective positions: during a drag, render widgets at their simulated
  // packed slots. Otherwise use the committed packed positions.
  const effectivePositions = previewPositions ?? positions

  // While dragging, lock body-level text selection.
  useEffect(() => {
    if (!activeId) return
    const prevUserSelect = document.body.style.userSelect
    const prevWebkitUserSelect = document.body.style.webkitUserSelect
    document.body.style.userSelect = "none"
    document.body.style.webkitUserSelect = "none"
    return () => {
      document.body.style.userSelect = prevUserSelect
      document.body.style.webkitUserSelect = prevWebkitUserSelect
    }
  }, [activeId])

  // ── Right-click context menu state ──────────────────────────────────────

  const [contextMenu, setContextMenu] = useState<{ zoneId: ZoneId; x: number; y: number } | null>(null)

  const handleContextMenu = useCallback((zoneId: ZoneId, e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenu({ zoneId, x: e.clientX, y: e.clientY })
  }, [])

  useEffect(() => {
    if (!contextMenu) return
    const close = (e: PointerEvent) => {
      const target = e.target as HTMLElement
      if (target.closest?.("[data-context-menu]")) return
      setContextMenu(null)
    }
    const onScroll = () => setContextMenu(null)
    document.addEventListener("pointerdown", close)
    window.addEventListener("scroll", onScroll, true)
    return () => {
      document.removeEventListener("pointerdown", close)
      window.removeEventListener("scroll", onScroll, true)
    }
  }, [contextMenu])

  // ── Size picker state ────────────────────────────────────────────────────

  const [sizePickerFor, setSizePickerFor] = useState<ZoneId | null>(null)
  const sizePickerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!sizePickerFor) return
    const close = (e: PointerEvent) => {
      const target = e.target as Node
      if (sizePickerRef.current && sizePickerRef.current.contains(target)) return
      if ((target as HTMLElement).closest?.("[data-size-picker-popover]")) return
      setSizePickerFor(null)
    }
    document.addEventListener("pointerdown", close)
    return () => document.removeEventListener("pointerdown", close)
  }, [sizePickerFor])

  const changeSize = useCallback(
    (zoneId: ZoneId, size: WidgetSize) => {
      onLayoutChange(setZoneSize(layout, zoneId, size))
      setSizePickerFor(null)
    },
    [layout, onLayoutChange],
  )

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div
      ref={containerRef}
      className={`relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto ${editMode ? "edit-mode" : ""}`}
      style={{
        padding: "var(--grid-padding)",
        userSelect: "none",
        WebkitUserSelect: "none",
        cursor: activeId ? "grabbing" : undefined,
      }}
    >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext items={visibleIds} strategy={rectSortingStrategy}>
          <div
            className="relative"
            style={{
              width: usedCols * cellSize,
              height: containerHeightPx,
              marginInline: "auto",
            }}
          >
            {/* Snap-preview outline: shows where the dragged widget will land. */}
            {previewPos && (
              <div
                aria-hidden
                className="pointer-events-none absolute border-2 border-dashed"
                style={{
                  left: `calc(${previewPos.x * cellSize}px + var(--card-gap))`,
                  top: `calc(${previewPos.y * cellSize}px + var(--card-gap))`,
                  width: `calc(${previewPos.w * cellSize}px - 2 * var(--card-gap))`,
                  height: `calc(${previewPos.h * cellSize}px - 2 * var(--card-gap))`,
                  borderRadius: "var(--card-radius)",
                  borderColor: "color-mix(in oklch, var(--primary), transparent 50%)",
                  backgroundColor: "color-mix(in oklch, var(--primary), transparent 90%)",
                  zIndex: 0,
                  transition: "left 0.18s ease, top 0.18s ease, width 0.18s ease, height 0.18s ease",
                }}
              />
            )}
            {layout.zones.map((entry) => {
              if (hiddenZones.includes(entry.id)) return null
              const pos = effectivePositions[entry.id]
              if (!pos) return null
              return (
                <SortableWidget
                  key={entry.id}
                  zoneId={entry.id}
                  size={entry.size}
                  pos={pos}
                  cellSize={cellSize}
                  editMode={editMode}
                  isActive={activeId === entry.id}
                  isAnyDragging={activeId !== null}
                  onContextMenu={handleContextMenu}
                  sizePickerOpen={sizePickerFor === entry.id}
                  onSizePickerOpen={() => setSizePickerFor(entry.id)}
                  onSizePickerClose={() => setSizePickerFor(null)}
                  onChangeSize={(size) => changeSize(entry.id, size)}
                  sizePickerRef={sizePickerFor === entry.id ? sizePickerRef : undefined}
                />
              )
            })}
          </div>
        </SortableContext>

        {/* Drag overlay — the floating ghost that follows the cursor.
            Portaled to body so it can't be clipped or mispositioned by the
            scrolling grid container or any transformed ancestor. */}
        {typeof document !== "undefined" &&
          createPortal(
            <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)" }}>
              {activeId && positions[activeId]
                ? (() => {
                    const pos = positions[activeId]
                    const ZoneComponent = ZONE_COMPONENTS[activeId]
                    return (
                      <div
                        style={{
                          width: pos.w * cellSize,
                          height: pos.h * cellSize,
                          padding: "var(--card-gap)",
                          cursor: "grabbing",
                          opacity: 0.92,
                          filter: "drop-shadow(0 12px 24px rgba(0,0,0,0.25))",
                        }}
                      >
                        <AdaptiveSurface
                          className="h-full w-full overflow-hidden"
                          style={{ borderRadius: "var(--card-radius)" }}
                        >
                          <ZoneComponent />
                        </AdaptiveSurface>
                      </div>
                    )
                  })()
                : null}
            </DragOverlay>,
            document.body,
          )}
      </DndContext>

      {contextMenu && typeof document !== "undefined" &&
        createPortal(
          <ContextMenuWithActions
            zoneId={contextMenu.zoneId}
            x={contextMenu.x}
            y={contextMenu.y}
            currentSize={layout.zones.find((z) => z.id === contextMenu.zoneId)?.size ?? "M"}
            onChange={(size) => {
              changeSize(contextMenu.zoneId, size)
              setContextMenu(null)
            }}
            onClose={() => setContextMenu(null)}
          />,
          document.body,
        )}
    </div>
  )
}

// ── Sortable widget ─────────────────────────────────────────────────────────

interface SortableWidgetProps {
  zoneId: ZoneId
  size: WidgetSize
  pos: ZonePosition
  cellSize: number
  editMode: boolean
  isActive: boolean
  isAnyDragging: boolean
  onContextMenu: (zoneId: ZoneId, e: React.MouseEvent) => void
  sizePickerOpen: boolean
  onSizePickerOpen: () => void
  onSizePickerClose: () => void
  onChangeSize: (size: WidgetSize) => void
  sizePickerRef?: React.RefObject<HTMLDivElement | null>
}

function SortableWidget({
  zoneId,
  size,
  pos,
  cellSize,
  editMode,
  isActive,
  isAnyDragging,
  onContextMenu,
  sizePickerOpen,
  onSizePickerOpen,
  onSizePickerClose,
  onChangeSize,
  sizePickerRef,
}: SortableWidgetProps) {
  const ZoneComponent = ZONE_COMPONENTS[zoneId]
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useSortable({ id: zoneId, disabled: !editMode })

  // Position via left/top so dnd-kit owns `transform`. While ANY drag is in
  // progress, ignore dnd-kit's flow-layout-based slide transform — those
  // assume uniform sizes and don't match our bin-packed layout, causing
  // overlaps with mixed widget sizes. Instead, we drive every widget's
  // position from the simulated packed layout (effectivePositions) and
  // animate left/top with CSS transitions.
  const useDndTransform = !isAnyDragging
  return (
    <div
      ref={setNodeRef}
      data-widget={zoneId}
      onContextMenu={(e) => onContextMenu(zoneId, e)}
      className="absolute"
      style={{
        left: pos.x * cellSize,
        top: pos.y * cellSize,
        width: pos.w * cellSize,
        height: pos.h * cellSize,
        transform: useDndTransform ? CSS.Translate.toString(transform) : undefined,
        // Hide the source while dragging — the DragOverlay shows the ghost.
        opacity: isActive || isDragging ? 0 : 1,
        zIndex: isActive ? 0 : 1,
        transition: isActive
          ? undefined
          : "left 0.22s ease, top 0.22s ease, width 0.22s ease, height 0.22s ease",
        padding: "var(--card-gap)",
      }}
    >
      <AdaptiveSurface
        className="relative h-full w-full overflow-hidden"
        style={{ borderRadius: "var(--card-radius)" }}
      >
        <ZoneComponent />
      </AdaptiveSurface>

      {/* Drag handle — header strip */}
      {editMode && (
        <div
          {...attributes}
          {...listeners}
          data-zone-drag-overlay
          className="absolute top-1 left-1 right-1 z-40 h-12 cursor-grab rounded-t-lg active:cursor-grabbing"
          style={{ touchAction: "none" }}
          aria-label={`Drag ${zoneId}`}
        />
      )}

      {/* Size picker button (bottom-right) */}
      {editMode && (
        <SizePickerButton
          zoneId={zoneId}
          current={size}
          open={sizePickerOpen}
          onOpen={onSizePickerOpen}
          onClose={onSizePickerClose}
          onChange={onChangeSize}
          containerRef={sizePickerRef}
        />
      )}
    </div>
  )
}

// ── Right-click context menu ────────────────────────────────────────────────

interface ContextMenuProps {
  zoneId: ZoneId
  x: number
  y: number
  currentSize: WidgetSize
  onChange: (size: WidgetSize) => void
  onClose: () => void
}

function ContextMenuWithActions({ zoneId, x, y, currentSize, onChange, onClose }: ContextMenuProps) {
  const registry = useZoneActionsRegistry()
  const zoneActions = registry?.actions[zoneId] ?? []
  const allowed = ZONE_ALLOWED_SIZES[zoneId]
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const [submenuFor, setSubmenuFor] = useState<string | null>(null)

  useEffect(() => {
    const update = () => {
      const el = ref.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const MARGIN = 8
      const left = Math.max(
        MARGIN,
        Math.min(window.innerWidth - rect.width - MARGIN, x),
      )
      const top = Math.max(
        MARGIN,
        Math.min(window.innerHeight - rect.height - MARGIN, y),
      )
      setPos({ top, left })
    }
    update()
    const raf = requestAnimationFrame(update)
    return () => cancelAnimationFrame(raf)
  }, [x, y])

  return (
    <div
      ref={ref}
      data-context-menu
      className="fixed z-[300] w-52 max-w-[calc(100vw-1rem)] rounded-lg border border-border/30 bg-background/95 p-1.5 shadow-xl backdrop-blur-xl"
      style={{
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        visibility: pos ? "visible" : "hidden",
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Zone-registered actions */}
      {zoneActions.length > 0 && (
        <>
          {zoneActions.map((action) => (
            <ZoneActionItem
              key={action.id}
              action={action}
              expanded={submenuFor === action.id}
              onToggleExpand={() =>
                setSubmenuFor((cur) => (cur === action.id ? null : action.id))
              }
              onClose={onClose}
            />
          ))}
          <div className="my-1.5 border-t border-border/20" />
        </>
      )}

      {/* Resize section */}
      <div className="px-3 py-1.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground/60">
        Resize widget
      </div>
      {allowed.map((size) => {
        const dims = WIDGET_SIZES[size]
        const isCurrent = size === currentSize
        return (
          <button
            key={size}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onChange(size)}
            className={`flex w-full items-center justify-between rounded-full px-4 py-2 text-xs transition-colors ${
              isCurrent
                ? "bg-primary/10 font-semibold text-foreground"
                : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
            }`}
          >
            <span>{WIDGET_SIZE_LABELS[size]}</span>
            <span className="font-mono text-xs text-muted-foreground/60">
              {dims.w}×{dims.h}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function ZoneActionItem({
  action,
  expanded,
  onToggleExpand,
  onClose,
}: {
  action: ZoneAction
  expanded: boolean
  onToggleExpand: () => void
  onClose: () => void
}) {
  const hasSubmenu = action.options && action.options.length > 0
  const baseClasses = `flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-xs transition-colors ${
    action.disabled
      ? "cursor-not-allowed text-muted-foreground/40"
      : action.variant === "destructive"
        ? "text-destructive hover:bg-destructive/10"
        : "text-foreground/80 hover:bg-muted/30 hover:text-foreground"
  }`

  if (hasSubmenu) {
    return (
      <>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            if (!action.disabled) onToggleExpand()
          }}
          disabled={action.disabled}
          className={baseClasses}
        >
          <span className="flex items-center gap-2">
            {action.icon && <span className="flex size-3.5 items-center justify-center">{action.icon}</span>}
            <span>{action.label}</span>
          </span>
          <ChevronRight className={`size-3.5 transition-transform ${expanded ? "rotate-90" : ""}`} />
        </button>
        {expanded && action.options && (
          <div className="ml-5 mr-1 mb-1 mt-0.5 space-y-0.5 border-l border-border/30 pl-1.5">
            {action.options.map((opt) => (
              <button
                key={opt.id}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => {
                  opt.onSelect()
                  onClose()
                }}
                className={`flex w-full items-center justify-between rounded-full px-4 py-1.5 text-xs transition-colors ${
                  opt.active
                    ? "bg-primary/10 font-semibold text-foreground"
                    : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                }`}
              >
                <span>{opt.label}</span>
                {opt.active && <span className="text-primary">●</span>}
              </button>
            ))}
          </div>
        )}
      </>
    )
  }

  return (
    <button
      onPointerDown={(e) => e.stopPropagation()}
      onClick={() => {
        if (action.disabled) return
        action.onSelect?.()
        onClose()
      }}
      disabled={action.disabled}
      className={baseClasses}
    >
      <span className="flex items-center gap-2">
        {action.icon && <span className="flex size-3.5 items-center justify-center">{action.icon}</span>}
        <span>{action.label}</span>
      </span>
    </button>
  )
}

// ── Size picker ─────────────────────────────────────────────────────────────

interface SizePickerButtonProps {
  zoneId: ZoneId
  current: WidgetSize
  open: boolean
  onOpen: () => void
  onClose: () => void
  onChange: (size: WidgetSize) => void
  containerRef?: React.RefObject<HTMLDivElement | null>
}

function SizePickerButton({
  zoneId,
  current,
  open,
  onOpen,
  onClose,
  onChange,
  containerRef,
}: SizePickerButtonProps) {
  const allowed = ZONE_ALLOWED_SIZES[zoneId]
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => {
    if (!open) {
      setPopoverPos(null)
      return
    }
    const MARGIN = 8
    const updatePos = () => {
      const btn = buttonRef.current?.getBoundingClientRect()
      if (!btn) return
      // Measure the popover if it's already rendered; otherwise estimate.
      const pop = popoverRef.current?.getBoundingClientRect()
      const popW = pop?.width ?? 192
      const popH = pop?.height ?? Math.min(allowed.length * 40 + 36, 320)

      const spaceBelow = window.innerHeight - btn.bottom
      const openUp = spaceBelow < popH + MARGIN && btn.top > popH + MARGIN
      const rawTop = openUp ? btn.top - popH - MARGIN : btn.bottom + MARGIN
      const rawLeft = btn.right - popW

      const top = Math.max(
        MARGIN,
        Math.min(window.innerHeight - popH - MARGIN, rawTop),
      )
      const left = Math.max(
        MARGIN,
        Math.min(window.innerWidth - popW - MARGIN, rawLeft),
      )
      setPopoverPos({ top, left })
    }
    updatePos()
    // Re-measure on next frame once the popover has rendered with real size.
    const raf = requestAnimationFrame(updatePos)
    window.addEventListener("resize", updatePos)
    window.addEventListener("scroll", updatePos, true)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("resize", updatePos)
      window.removeEventListener("scroll", updatePos, true)
    }
  }, [open, allowed.length])

  return (
    <div ref={containerRef} className="absolute bottom-2 right-2 z-50">
      <button
        ref={buttonRef}
        onPointerDown={(e) => {
          e.stopPropagation()
          if (open) onClose()
          else onOpen()
        }}
        style={{ borderRadius: "var(--card-radius)" }}
        className="flex size-11 items-center justify-center border border-border/40 bg-background/90 text-muted-foreground shadow-md backdrop-blur-md hover:text-foreground"
        title="Change size"
        aria-label="Change widget size"
      >
        <Maximize2 className="size-4" />
      </button>
      {open && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popoverRef}
            data-size-picker-popover
            className="fixed z-[200] w-48 max-w-[calc(100vw-1rem)] rounded-lg border border-border/30 bg-background/95 p-1.5 shadow-xl backdrop-blur-xl"
            style={{
              top: popoverPos?.top ?? -9999,
              left: popoverPos?.left ?? -9999,
              visibility: popoverPos ? "visible" : "hidden",
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {allowed.map((size) => {
              const dims = WIDGET_SIZES[size]
              const isCurrent = size === current
              return (
                <button
                  key={size}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => onChange(size)}
                  className={`flex w-full items-center justify-between rounded-full px-4 py-2 text-xs transition-colors ${
                    isCurrent
                      ? "bg-primary/10 font-semibold text-foreground"
                      : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                  }`}
                >
                  <span>{WIDGET_SIZE_LABELS[size]}</span>
                  <span className="font-mono text-xs text-muted-foreground/60">
                    {dims.w}×{dims.h}
                  </span>
                </button>
              )
            })}
          </div>,
          document.body,
        )}
    </div>
  )
}
