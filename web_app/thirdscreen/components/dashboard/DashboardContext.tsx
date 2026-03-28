"use client"

import { createContext, use } from "react"

interface DashboardContextValue {
  editMode: boolean
}

export const DashboardContext = createContext<DashboardContextValue>({
  editMode: false,
})

export function useDashboard() {
  return use(DashboardContext)
}
