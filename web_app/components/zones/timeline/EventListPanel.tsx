"use client"

import { MapPin } from "lucide-react"
import type { TimelineEvent } from "./timeline-utils"
import { eventColor, formatTime12 } from "./timeline-utils"

export function EventListPanel({
  events,
  direction,
  onSelectEvent,
}: {
  events: TimelineEvent[]
  direction: "vertical" | "horizontal"
  onSelectEvent: (ev: TimelineEvent) => void
}) {
  // Filter to only show ongoing or future events
  const now = new Date()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const filtered = events.filter((ev) => {
    if (ev.allDay) return true // always show all-day events
    const [eh, em] = ev.endTime.split(":").map(Number)
    const endMin = eh * 60 + em
    return endMin > nowMinutes // event hasn't ended yet
  })

  const sorted = [...filtered].sort((a, b) => {
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1
    return a.startTime.localeCompare(b.startTime)
  })

  if (sorted.length === 0) {
    return (
      <div className="flex items-center justify-center p-4 text-xs text-muted-foreground/40">
        No events today
      </div>
    )
  }

  return (
    <div
      className={`overflow-y-auto ${
        direction === "vertical"
          ? "flex shrink-0 flex-wrap gap-1.5 border-t border-border/10 px-3 py-2"
          : "flex flex-col gap-0.5 px-2 py-1.5"
      }`}
    >
      {sorted.map((ev) => {
        const evColor = ev.color ?? eventColor(ev.id)
        return (
          <button
            key={ev.id}
            onClick={() => onSelectEvent(ev)}
            className={`group flex min-h-11 items-start gap-2 rounded-md border border-transparent px-2 py-1.5 text-left transition-colors hover:border-border/20 hover:bg-muted/20 ${
              direction === "vertical" ? "w-auto shrink-0" : "w-full"
            }`}
          >
            <div
              className="mt-1 h-full w-[3px] shrink-0 rounded-full"
              style={{ backgroundColor: evColor, minHeight: "1rem" }}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-foreground/80">
                {ev.title}
              </p>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground/50">
                {ev.allDay ? (
                  <span>All day</span>
                ) : (
                  <span className="font-mono tabular-nums">
                    {formatTime12(parseInt(ev.startTime.split(":")[0]) * 60 + parseInt(ev.startTime.split(":")[1]))}
                    {" - "}
                    {formatTime12(parseInt(ev.endTime.split(":")[0]) * 60 + parseInt(ev.endTime.split(":")[1]))}
                  </span>
                )}
                {ev.location && (
                  <>
                    <span className="text-border/30">|</span>
                    <MapPin className="size-2.5 shrink-0" />
                    <span className="truncate">{ev.location}</span>
                  </>
                )}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
