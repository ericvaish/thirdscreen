"use client"

import {
  format,
  isToday,
  isSameDay,
  isSameMonth,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
} from "date-fns"
import type { TimelineEvent } from "./timeline-utils"
import { eventColor } from "./timeline-utils"

export function MonthView({
  selectedDate,
  dateEvents,
  onSelectDay,
}: {
  selectedDate: Date
  dateEvents: Map<string, TimelineEvent[]>
  onSelectDay: (date: Date) => void
}) {
  const monthStart = startOfMonth(selectedDate)
  const monthEnd = endOfMonth(selectedDate)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })

  return (
    <div className="flex min-h-0 flex-1 flex-col px-2 pb-1">
      {/* Weekday headers */}
      <div className="grid shrink-0 grid-cols-7 gap-px pb-0.5">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div
            key={d}
            className="text-center font-mono text-xs uppercase text-muted-foreground/40"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day cells grid */}
      <div className="grid min-h-0 flex-1 grid-cols-7 gap-px">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd")
          const events = dateEvents.get(key) ?? []
          const inMonth = isSameMonth(day, selectedDate)
          const isDayToday = isToday(day)
          const isSelected = isSameDay(day, selectedDate)

          return (
            <button
              key={key}
              onClick={() => onSelectDay(day)}
              className={`group relative flex flex-col items-center overflow-hidden rounded-md border p-0.5 transition-colors ${
                !inMonth
                  ? "border-transparent opacity-30"
                  : isSelected
                    ? "border-[var(--zone-timeline-accent)]/40 bg-[var(--zone-timeline-accent)]/5"
                    : "border-transparent hover:border-border/25 hover:bg-muted/20"
              }`}
            >
              <span
                className={`flex size-4 shrink-0 items-center justify-center rounded-full font-mono text-xs font-medium ${
                  isDayToday
                    ? "bg-amber-400 text-black"
                    : "text-foreground/60"
                }`}
              >
                {format(day, "d")}
              </span>

              {/* Event indicators */}
              {events.length > 0 && (
                <div className="mt-0.5 flex flex-wrap justify-center gap-[2px]">
                  {events.slice(0, 4).map((ev) => (
                    <div
                      key={ev.id}
                      className="size-[3px] rounded-full"
                      style={{
                        backgroundColor:
                          ev.color ?? eventColor(ev.id),
                      }}
                    />
                  ))}
                  {events.length > 4 && (
                    <span className="text-xs leading-none text-muted-foreground/50">
                      +{events.length - 4}
                    </span>
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
