"use client"

import {
  format,
  addDays,
  isToday,
  isSameDay,
  startOfWeek,
  eachDayOfInterval,
} from "date-fns"
import type { TimelineEvent } from "./timeline-utils"
import { eventColor, WEEK_HOURS } from "./timeline-utils"

export function WeekView({
  selectedDate,
  dateEvents,
  onSelectDay,
}: {
  selectedDate: Date
  dateEvents: Map<string, TimelineEvent[]>
  onSelectDay: (date: Date) => void
}) {
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 })
  const days = eachDayOfInterval({
    start: weekStart,
    end: addDays(weekStart, 6),
  })

  const now = new Date()
  const nowHour = now.getHours() + now.getMinutes() / 60

  return (
    <div className="flex min-h-0 flex-1 gap-px px-2 pb-1">
      {days.map((day) => {
        const key = format(day, "yyyy-MM-dd")
        const events = dateEvents.get(key) ?? []
        const timedEvents = events.filter((e) => !e.allDay)
        const allDayEvents = events.filter((e) => e.allDay)
        const isDayToday = isToday(day)
        const isSelected = isSameDay(day, selectedDate)

        return (
          <button
            key={key}
            onClick={() => onSelectDay(day)}
            className={`group relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-md border transition-colors ${
              isSelected
                ? "border-[var(--zone-timeline-accent)]/40 bg-[var(--zone-timeline-accent)]/5"
                : "border-border/10 hover:border-border/25 hover:bg-muted/20"
            }`}
          >
            {/* Day header */}
            <div className="shrink-0 px-1 pt-1 pb-0.5 text-center">
              <div className="font-mono text-xs uppercase text-muted-foreground/50">
                {format(day, "EEE")}
              </div>
              <div
                className={`mx-auto flex size-5 items-center justify-center rounded-full font-mono text-xs font-medium ${
                  isDayToday
                    ? "bg-amber-400 text-black"
                    : "text-foreground/70"
                }`}
              >
                {format(day, "d")}
              </div>
            </div>

            {/* All-day event dots */}
            {allDayEvents.length > 0 && (
              <div className="flex justify-center gap-0.5 px-0.5 pb-0.5">
                {allDayEvents.slice(0, 3).map((ev) => (
                  <div
                    key={ev.id}
                    className="size-1 rounded-full"
                    style={{
                      backgroundColor:
                        ev.color ?? eventColor(ev.id),
                    }}
                  />
                ))}
              </div>
            )}

            {/* Mini timeline column */}
            <div className="relative min-h-0 flex-1">
              {/* Hour grid lines */}
              {WEEK_HOURS.map((h) => {
                const pct = ((h - 5) / 19) * 100
                return (
                  <div
                    key={h}
                    className="absolute left-0 w-full"
                    style={{ top: `${pct}%` }}
                  >
                    <div className="h-px w-full bg-border/10" />
                  </div>
                )
              })}

              {/* Now line */}
              {isDayToday && nowHour >= 5 && nowHour <= 24 && (
                <div
                  className="absolute left-0 z-10 w-full"
                  style={{ top: `${((nowHour - 5) / 19) * 100}%` }}
                >
                  <div className="h-px w-full bg-amber-400/70 shadow-[0_0_4px_oklch(0.8_0.16_85)]" />
                </div>
              )}

              {/* Event bars */}
              {timedEvents.map((ev) => {
                const [sh, sm] = ev.startTime.split(":").map(Number)
                const [eh, em] = ev.endTime.split(":").map(Number)
                const startH = sh + sm / 60
                const endH = eh + em / 60
                const topPct = Math.max(0, ((startH - 5) / 19) * 100)
                const bottomPct = Math.min(100, ((endH - 5) / 19) * 100)
                const heightPct = Math.max(bottomPct - topPct, 2)

                const isThin = heightPct < 4
                return (
                  <div
                    key={ev.id}
                    className="absolute left-0.5 right-0.5 overflow-hidden"
                    style={{
                      top: `${topPct}%`,
                      height: `${heightPct}%`,
                      backgroundColor: ev.color ?? eventColor(ev.id),
                      minHeight: "3px",
                    }}
                    title={ev.title}
                  >
                    {!isThin && (
                      <span className="block truncate px-0.5 text-[0.5rem] font-medium leading-tight text-white/90">
                        {ev.title}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </button>
        )
      })}
    </div>
  )
}
