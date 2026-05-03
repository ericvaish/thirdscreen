"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import {
  LayoutGrid, List, Plus, Check, CalendarDays, Clock, ListChecks, StickyNote,
  Activity, Music, Target, Home, CloudSun, Rss,
} from "lucide-react"
import { useDashboard } from "./DashboardContext"
import { ZONE_IDS, type ZoneId } from "@/lib/grid-layout"

const ZONE_META: Record<ZoneId, { label: string; icon: typeof LayoutGrid; accent: string; description: string }> = {
  timeline:  { label: "Timeline",    icon: CalendarDays, accent: "var(--zone-timeline-accent)", description: "Schedule and calendar events" },
  clock:     { label: "Clock",       icon: Clock,        accent: "var(--zone-clock-accent)",    description: "Time, date, and temperature" },
  tasks:     { label: "Tasks",       icon: ListChecks,   accent: "var(--zone-tasks-accent)",    description: "To-do list and Jira issues" },
  notes:     { label: "Notes",       icon: StickyNote,   accent: "var(--zone-notes-accent)",    description: "Quick notes and bookmarks" },
  vitals:    { label: "Vitals",      icon: Activity,     accent: "var(--zone-vitals-accent)",   description: "Calories, water, medications" },
  media:     { label: "Now Playing", icon: Music,        accent: "var(--zone-media-accent)",    description: "Spotify playback and lyrics" },
  habits:    { label: "Habits",      icon: Target,       accent: "var(--zone-habits-accent)",   description: "Daily habit tracking" },
  smarthome: { label: "Smart Home",  icon: Home,         accent: "var(--zone-smarthome-accent)", description: "Home Assistant devices" },
  weather:   { label: "Weather",     icon: CloudSun,     accent: "var(--zone-weather-accent)",  description: "Forecast and conditions" },
  news:      { label: "News",        icon: Rss,          accent: "var(--zone-news-accent)",     description: "RSS feed headlines" },
}

type ViewMode = "list" | "grid"

export function ZonePicker() {
  const { hiddenZones, toggleZone } = useDashboard()
  const [viewMode, setViewMode] = useState<ViewMode>("grid")

  const visibleCount = ZONE_IDS.length - hiddenZones.length

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground hover:text-foreground"
          title="Add or remove zones"
        >
          <Plus className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="end" sideOffset={8} collisionPadding={16} className="w-80 max-h-[calc(100vh-5rem)] overflow-y-auto p-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/20 px-4 py-3">
          <div>
            <p className="text-sm font-medium">Zones</p>
            <p className="text-xs text-muted-foreground/50">{visibleCount} of {ZONE_IDS.length} visible</p>
          </div>
          <div className="flex gap-0.5 rounded-md border border-border/30 p-0.5">
            <button
              onClick={() => setViewMode("grid")}
              className={`rounded p-1 transition-colors ${viewMode === "grid" ? "bg-primary/10 text-primary" : "text-muted-foreground/40 hover:text-muted-foreground"}`}
            >
              <LayoutGrid className="size-3.5" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`rounded p-1 transition-colors ${viewMode === "list" ? "bg-primary/10 text-primary" : "text-muted-foreground/40 hover:text-muted-foreground"}`}
            >
              <List className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-2">
          {viewMode === "list" ? (
            <div className="space-y-0.5">
              {ZONE_IDS.map((zoneId) => {
                const meta = ZONE_META[zoneId]
                const visible = !hiddenZones.includes(zoneId)
                return (
                  <div
                    key={zoneId}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-muted/30"
                  >
                    <meta.icon className="size-4 shrink-0" style={{ color: meta.accent, opacity: visible ? 1 : 0.3 }} />
                    <div className="min-w-0 flex-1">
                      <span className={`text-sm ${visible ? "" : "text-muted-foreground/40"}`}>{meta.label}</span>
                    </div>
                    <Switch
                      checked={visible}
                      onCheckedChange={() => toggleZone(zoneId)}
                    />
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {ZONE_IDS.map((zoneId) => {
                const meta = ZONE_META[zoneId]
                const visible = !hiddenZones.includes(zoneId)
                return (
                  <button
                    key={zoneId}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      toggleZone(zoneId)
                    }}
                    aria-pressed={visible}
                    title={visible ? `${meta.label} — click to hide` : `${meta.label} — click to show`}
                    className="group relative flex flex-col items-center gap-1.5 rounded-xl border-2 px-2 py-3 text-xs transition-all hover:scale-[1.03] active:scale-[0.97]"
                    style={{
                      borderColor: visible ? meta.accent : "color-mix(in oklch, var(--border), transparent 50%)",
                      backgroundColor: visible
                        ? `color-mix(in oklch, ${meta.accent}, transparent 85%)`
                        : "color-mix(in oklch, var(--muted), transparent 80%)",
                      opacity: visible ? 1 : 0.55,
                    }}
                  >
                    {/* On/off badge top-right */}
                    <div
                      className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full border-2 transition-all"
                      style={{
                        backgroundColor: visible ? meta.accent : "var(--background)",
                        borderColor: visible ? meta.accent : "color-mix(in oklch, var(--border), transparent 30%)",
                      }}
                    >
                      {visible && <Check className="size-3 text-white" strokeWidth={3} />}
                    </div>

                    <div
                      className="flex size-8 items-center justify-center rounded-lg transition-colors"
                      style={{
                        backgroundColor: visible
                          ? `color-mix(in oklch, ${meta.accent}, transparent 75%)`
                          : "color-mix(in oklch, var(--muted), transparent 50%)",
                      }}
                    >
                      <meta.icon
                        className="size-4"
                        style={{
                          color: visible ? meta.accent : "var(--muted-foreground)",
                          opacity: visible ? 1 : 0.5,
                        }}
                      />
                    </div>
                    <span
                      className="font-medium"
                      style={{
                        color: visible ? undefined : "var(--muted-foreground)",
                        textDecoration: visible ? undefined : "line-through",
                        textDecorationThickness: "1.5px",
                      }}
                    >
                      {meta.label}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
