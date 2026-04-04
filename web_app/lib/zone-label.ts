"use client"

import type { ZoneId } from "./grid-layout"

/**
 * Returns the current zone label style from the DOM.
 * Reads the data-zone-label attribute set by the theme customizer.
 */
export function getZoneLabelStyle(): "line" | "icon" {
  if (typeof document === "undefined") return "line"
  return (document.documentElement.getAttribute("data-zone-label") as "line" | "icon") ?? "line"
}

/** Lucide icon name for each zone (used when label style is "icon") */
export const ZONE_ICONS: Record<ZoneId, string> = {
  timeline:  "CalendarDays",
  clock:     "Clock",
  tasks:     "ListChecks",
  notes:     "StickyNote",
  vitals:    "Heart",
  media:     "Music",
  habits:    "Target",
  smarthome: "Home",
}
