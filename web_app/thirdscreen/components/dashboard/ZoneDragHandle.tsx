"use client"

import { GripVertical } from "lucide-react"
import { useDashboard } from "./DashboardContext"

/**
 * Renders a drag handle grip icon inside zone headers.
 * Only visible in edit mode. The parent element should have
 * className="zone-drag-handle" for react-grid-layout to detect it.
 */
export function ZoneDragHandle() {
  const { editMode } = useDashboard()
  if (!editMode) return null

  return (
    <GripVertical className="size-3.5 shrink-0 text-muted-foreground/30" />
  )
}
