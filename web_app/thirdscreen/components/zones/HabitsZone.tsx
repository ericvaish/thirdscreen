"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { format, subDays, eachDayOfInterval } from "date-fns"
import { Plus, Trash2, Flame, Check, Settings, LineChart as LineChartIcon, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useDashboard } from "@/components/dashboard/DashboardContext"
import { ZoneDragHandle } from "@/components/dashboard/ZoneDragHandle"
import {
  listHabits,
  createHabit,
  deleteHabit,
  toggleHabitLog,
  type HabitItem,
  type HabitLog,
} from "@/lib/data-layer"

const ACCENT = "var(--zone-habits-accent, oklch(0.7 0.15 140))"
const DAYS_TO_SHOW = 7

const HABIT_COLORS = [
  "oklch(0.7 0.15 140)", // green
  "oklch(0.7 0.12 200)", // teal
  "oklch(0.7 0.12 260)", // blue
  "oklch(0.65 0.12 300)", // purple
  "oklch(0.7 0.12 30)",  // coral
  "oklch(0.75 0.12 80)", // amber
]

type ChartStyle = "sparkline" | "line"

export function HabitsZone() {
  const { editMode } = useDashboard()
  const [habits, setHabits] = useState<HabitItem[]>([])
  const [logs, setLogs] = useState<HabitLog[]>([])
  const [inlineNewName, setInlineNewName] = useState("")
  const [chartStyle, setChartStyle] = useState<ChartStyle>("sparkline")
  const inlineInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const stored = localStorage.getItem("habits-chart-style") as ChartStyle | null
    if (stored === "sparkline" || stored === "line") setChartStyle(stored)
  }, [])

  const today = format(new Date(), "yyyy-MM-dd")
  const dates = eachDayOfInterval({
    start: subDays(new Date(), DAYS_TO_SHOW - 1),
    end: new Date(),
  })

  const fetchData = useCallback(async () => {
    try {
      const startDate = format(subDays(new Date(), DAYS_TO_SHOW - 1), "yyyy-MM-dd")
      const data = await listHabits(startDate, today)
      setHabits(data.habits)
      setLogs(data.logs)
    } catch {}
  }, [today])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleAdd = async (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    try {
      const color = HABIT_COLORS[habits.length % HABIT_COLORS.length]
      await createHabit({ name: trimmed, color })
      fetchData()
    } catch {
      toast.error("Failed to add habit")
    }
  }

  const handleDelete = async (id: string) => {
    setHabits((prev) => prev.filter((h) => h.id !== id))
    try {
      await deleteHabit(id)
    } catch {
      fetchData()
    }
  }

  const handleToggle = async (habitId: string, date: string) => {
    setLogs((prev) => {
      const existing = prev.find((l) => l.habitId === habitId && l.date === date)
      if (existing) return prev.filter((l) => l !== existing)
      return [...prev, { id: `temp-${Date.now()}`, habitId, date, completed: true }]
    })
    try {
      await toggleHabitLog(habitId, date)
    } catch {
      fetchData()
    }
  }

  const setChart = (style: ChartStyle) => {
    setChartStyle(style)
    localStorage.setItem("habits-chart-style", style)
  }

  const logSet = new Set(
    logs.filter((l) => l.completed).map((l) => `${l.habitId}:${l.date}`),
  )

  const dailyPct = dates.map((d) => {
    const dateStr = format(d, "yyyy-MM-dd")
    if (habits.length === 0) return 0
    const completed = habits.filter((h) => logSet.has(`${h.id}:${dateStr}`)).length
    return Math.round((completed / habits.length) * 100)
  })

  const getStreak = (habitId: string): number => {
    let streak = 0
    for (let i = 0; i < 365; i++) {
      const d = format(subDays(new Date(), i), "yyyy-MM-dd")
      if (logSet.has(`${habitId}:${d}`)) streak++
      else break
    }
    return streak
  }

  // ── Shared sub-components ──────────────────────────────────────────────

  const DateHeaders = () => (
    <div className="mb-1 flex items-center gap-px px-1">
      <div className="w-20 shrink-0" />
      {dates.map((d) => {
        const isToday = format(d, "yyyy-MM-dd") === today
        return (
          <div
            key={d.toISOString()}
            className={cn(
              "flex flex-1 flex-col items-center",
              isToday ? "text-foreground/80" : "text-muted-foreground/30",
            )}
          >
            <span className="font-mono text-xs uppercase">
              {format(d, "EEE").slice(0, 2)}
            </span>
            <span className={cn("font-mono text-xs", isToday && "font-bold")}>
              {format(d, "d")}
            </span>
          </div>
        )
      })}
      <div className="w-8 shrink-0 text-center text-muted-foreground/30">
        <Flame className="mx-auto size-3" />
      </div>
    </div>
  )

  const HabitRow = ({ habit }: { habit: HabitItem }) => {
    const streak = getStreak(habit.id)
    const habitColor = habit.color ?? ACCENT
    return (
      <div className="group flex items-center gap-px rounded-md px-1 py-0.5 transition-colors hover:bg-foreground/[0.02]">
        <div className="flex w-20 shrink-0 items-center gap-1.5 overflow-hidden">
          {habit.icon && <span className="text-xs">{habit.icon}</span>}
          <span className="truncate text-xs text-foreground/70">{habit.name}</span>
          <button
            onClick={() => handleDelete(habit.id)}
            className="shrink-0 text-muted-foreground/20 transition-colors hover:text-destructive"
          >
            <Trash2 className="size-2.5" />
          </button>
        </div>
        {dates.map((d) => {
          const dateStr = format(d, "yyyy-MM-dd")
          const done = logSet.has(`${habit.id}:${dateStr}`)
          return (
            <button
              key={dateStr}
              onClick={() => handleToggle(habit.id, dateStr)}
              className="flex flex-1 items-center justify-center py-1"
            >
              <div
                className={cn(
                  "flex size-6 items-center justify-center rounded-md border transition-all",
                  done ? "border-transparent" : "border-foreground/25 hover:border-foreground/40",
                )}
                style={done ? { background: habitColor, opacity: 0.85 } : undefined}
              >
                {done && <Check className="size-3.5 text-white" />}
              </div>
            </button>
          )
        })}
        <div className="flex w-8 shrink-0 items-center justify-center">
          {streak > 0 && (
            <span className="font-mono text-xs font-bold tabular-nums" style={{ color: habitColor }}>
              {streak}
            </span>
          )}
        </div>
      </div>
    )
  }


  // ── Charts ─────────────────────────────────────────────────────────────

  const SparklineChart = () => (
    <div className="mb-2 flex items-end gap-px px-1">
      <div className="w-20 shrink-0" />
      {dailyPct.map((pct, i) => (
        <div key={i} className="flex flex-1 flex-col items-center">
          <div
            className="w-full rounded-sm transition-all duration-300"
            style={{
              height: `${Math.max(2, (pct / 100) * 32)}px`,
              background:
                pct === 100
                  ? ACCENT
                  : pct > 0
                    ? `color-mix(in oklch, ${ACCENT} ${pct}%, transparent)`
                    : "var(--border)",
              opacity: pct === 0 ? 0.15 : 0.7,
            }}
          />
        </div>
      ))}
      <div className="w-8 shrink-0" />
    </div>
  )

  const LineChart = () => {
    const chartH = 80 // px
    const yLabels = [100, 50, 0]

    return (
      <div className="mb-2 flex gap-px px-1">
        {/* Y-axis labels */}
        <div className="relative flex w-20 shrink-0 flex-col justify-between" style={{ height: chartH }}>
          {yLabels.map((v) => (
            <span key={v} className="text-right font-mono text-xs leading-none text-muted-foreground/30">
              {v}%
            </span>
          ))}
        </div>
        {/* Chart area -- 6px padding top/bottom so dots at 0% and 100% aren't clipped */}
        <div className="relative flex-1 py-[6px]" style={{ height: chartH }}>
          <div className="relative h-full w-full">
          {/* Grid lines */}
          {yLabels.map((v) => (
            <div
              key={v}
              className="absolute left-0 w-full border-t border-border/10"
              style={{ top: `${100 - v}%` }}
            />
          ))}
          {/* Line segments + dots */}
          {dailyPct.map((pct, i) => {
            const x = ((i + 0.5) / dailyPct.length) * 100
            const y = 100 - pct
            const nextPct = dailyPct[i + 1]
            const nextX = nextPct !== undefined ? ((i + 1.5) / dailyPct.length) * 100 : null
            const nextY = nextPct !== undefined ? 100 - nextPct : null

            return (
              <div key={i}>
                {/* Line segment to next point */}
                {nextX !== null && nextY !== null && (
                  <svg
                    className="pointer-events-none absolute inset-0 h-full w-full"
                    style={{ overflow: "visible" }}
                  >
                    <line
                      x1={`${x}%`} y1={`${y}%`}
                      x2={`${nextX}%`} y2={`${nextY}%`}
                      stroke="oklch(0.7 0.15 140)"
                      strokeWidth="2"
                      strokeLinecap="round"
                      style={{ filter: "drop-shadow(0 0 4px oklch(0.7 0.15 140 / 0.3))" }}
                    />
                  </svg>
                )}
                {/* Dot */}
                <div
                  className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
                  style={{
                    left: `${x}%`,
                    top: `${y}%`,
                    width: 8,
                    height: 8,
                    borderColor: "oklch(0.7 0.15 140)",
                    background: pct === 100 ? "oklch(0.7 0.15 140)" : "var(--background)",
                  }}
                />
              </div>
            )
          })}
          </div>
        </div>
        <div className="w-8 shrink-0" />
      </div>
    )
  }

  return (
    <div className="zone-surface zone-habits flex h-full flex-col">
      {/* Header */}
      <div
        className={`flex shrink-0 items-center justify-between px-4 py-1.5 ${editMode ? "zone-drag-handle" : ""}`}
      >
        <div className="flex items-center gap-2">
          <ZoneDragHandle />
          <div className="h-4 w-[3px] rounded-full" style={{ background: ACCENT }} />
          <span
            className="font-[family-name:var(--font-display)] text-sm font-bold tracking-tight"
            style={{ color: ACCENT }}
          >
            Habits
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          {/* Settings popover */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                className="text-muted-foreground/30 hover:text-foreground"
              >
                <Settings className="size-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent side="bottom" align="end" className="w-48">
              <p className="mb-2 font-mono text-xs font-medium uppercase tracking-wider" style={{ color: ACCENT }}>
                Chart Style
              </p>
              <div className="space-y-1">
                <button
                  onClick={() => setChart("sparkline")}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors",
                    chartStyle === "sparkline"
                      ? "bg-primary/10 text-foreground"
                      : "text-muted-foreground hover:bg-muted/30",
                  )}
                >
                  <TrendingUp className="size-3.5" />
                  Sparkline
                </button>
                <button
                  onClick={() => setChart("line")}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors",
                    chartStyle === "line"
                      ? "bg-primary/10 text-foreground"
                      : "text-muted-foreground hover:bg-muted/30",
                  )}
                >
                  <LineChartIcon className="size-3.5" />
                  Line Chart
                </button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-auto px-3 pb-2">
        {/* Chart -- always visible even with 0 habits */}
        {chartStyle === "sparkline" ? <SparklineChart /> : <LineChart />}

        {/* Date headers -- always visible */}
        <DateHeaders />

        {/* Habit rows */}
        <div className="space-y-0.5">
          {habits.map((habit) => (
            <HabitRow key={habit.id} habit={habit} />
          ))}
        </div>

        {/* Inline add row -- always visible */}
        <form
          className="flex items-center gap-1.5 rounded-md px-1 py-0.5"
          onSubmit={(e) => {
            e.preventDefault()
            if (inlineNewName.trim()) {
              handleAdd(inlineNewName)
              setInlineNewName("")
            } else {
              inlineInputRef.current?.focus()
            }
          }}
        >
          <button
            type="submit"
            className="shrink-0 rounded-md p-1 text-muted-foreground/30 transition-colors hover:text-foreground"
          >
            <Plus className="size-3" />
          </button>
          <Input
            ref={inlineInputRef}
            value={inlineNewName}
            onChange={(e) => setInlineNewName(e.target.value)}
            placeholder="Add habit"
            className="h-7 min-w-0 flex-1 rounded-none border-none bg-transparent px-0 text-xs shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
        </form>
      </div>
    </div>
  )
}
