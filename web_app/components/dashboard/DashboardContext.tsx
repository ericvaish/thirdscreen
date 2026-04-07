"use client"

import { createContext, use } from "react"
import type { DashboardLayout, DashboardConfig, ZoneId } from "@/lib/grid-layout"

interface DashboardContextValue {
  editMode: boolean
  layout?: DashboardLayout
  onLayoutChange?: (layout: DashboardLayout) => void
  // Multi-dashboard
  activeDashboardId: string
  dashboards: DashboardConfig[]
  hiddenZones: ZoneId[]
  toggleZone: (zoneId: ZoneId) => void
  switchDashboard: (id: string) => void
  createDashboard: (name: string) => Promise<void>
  renameDashboard: (id: string, name: string) => Promise<void>
  deleteDashboard: (id: string) => Promise<void>
  canCreateMore: boolean
}

export const DashboardContext = createContext<DashboardContextValue>({
  editMode: false,
  activeDashboardId: "",
  dashboards: [],
  hiddenZones: [],
  toggleZone: () => {},
  switchDashboard: () => {},
  createDashboard: async () => {},
  renameDashboard: async () => {},
  deleteDashboard: async () => {},
  canCreateMore: false,
})

export function useDashboard() {
  return use(DashboardContext)
}
