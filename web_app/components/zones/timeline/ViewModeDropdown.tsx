"use client"

import { Sun } from "lucide-react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { ViewMode } from "./timeline-utils"

export function ViewModeDropdown({
  viewMode,
  onViewChange,
  showSunArc,
  onToggleSunArc,
}: {
  viewMode: ViewMode
  onViewChange: (mode: ViewMode) => void
  showSunArc: boolean
  onToggleSunArc: () => void
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="flex size-11 items-center justify-center rounded-lg border border-border/25 bg-muted/15 font-mono text-xs font-bold uppercase tracking-wider text-[var(--zone-timeline-accent)] transition-colors hover:border-border/40 hover:bg-muted/30 active:scale-95"
          title="View options"
        >
          {viewMode === "day" ? "D" : viewMode === "week" ? "W" : "M"}
        </button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="end" className="w-44 p-1">
        <p className="px-2 py-1 font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground/40">
          View
        </p>
        {(["day", "week", "month"] as ViewMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => onViewChange(mode)}
            className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition-colors ${
              viewMode === mode
                ? "bg-[var(--zone-timeline-accent)]/15 text-[var(--zone-timeline-accent)]"
                : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
            }`}
          >
            <span className="font-mono font-bold uppercase tracking-wider">
              {mode === "day" ? "D" : mode === "week" ? "W" : "M"}
            </span>
            {mode === "day" ? "Day" : mode === "week" ? "Week" : "Month"}
          </button>
        ))}
        {viewMode === "day" && (
          <>
            <div className="my-1 h-px bg-border/20" />
            <button
              onClick={onToggleSunArc}
              className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition-colors ${
                showSunArc
                  ? "text-amber-400"
                  : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
              }`}
            >
              <Sun className="size-3.5" />
              Daylight Arc
              {showSunArc && <span className="ml-auto text-amber-400">On</span>}
            </button>
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}
