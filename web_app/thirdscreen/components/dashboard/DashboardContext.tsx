"use client"

import { createContext, use } from "react"
import type { DashboardLayout } from "@/lib/grid-layout"

interface DashboardContextValue {
  editMode: boolean
  layout?: DashboardLayout
  onLayoutChange?: (layout: DashboardLayout) => void
}

export const DashboardContext = createContext<DashboardContextValue>({
  editMode: false,
})

export function useDashboard() {
  return use(DashboardContext)
}
