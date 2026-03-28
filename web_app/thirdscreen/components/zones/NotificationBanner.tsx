"use client"

import { useEffect, useRef, useState } from "react"
import {
  Timer,
  Clock,
  CalendarDays,
  Mail,
  Info,
  X,
  ChevronLeft,
  ChevronRight,
  Bell,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  useNotifications,
  type AppNotification,
  type NotificationType,
} from "@/lib/notifications"

const NOTIF_ICONS: Record<NotificationType, typeof Bell> = {
  timer: Timer,
  alarm: Clock,
  meeting: CalendarDays,
  email: Mail,
  info: Info,
}

// Each type gets its own accent palette: bg, border, text, glow
const NOTIF_THEME: Record<
  NotificationType,
  { bg: string; border: string; text: string; icon: string; glow: string }
> = {
  meeting: {
    bg: "bg-blue-500/15",
    border: "border-blue-500/40",
    text: "text-blue-300",
    icon: "text-blue-400",
    glow: "shadow-[0_0_20px_oklch(0.65_0.2_260/25%)]",
  },
  email: {
    bg: "bg-violet-500/15",
    border: "border-violet-500/40",
    text: "text-violet-300",
    icon: "text-violet-400",
    glow: "shadow-[0_0_20px_oklch(0.65_0.2_300/25%)]",
  },
  timer: {
    bg: "bg-emerald-500/15",
    border: "border-emerald-500/40",
    text: "text-emerald-300",
    icon: "text-emerald-400",
    glow: "shadow-[0_0_20px_oklch(0.7_0.18_160/25%)]",
  },
  alarm: {
    bg: "bg-amber-500/15",
    border: "border-amber-500/40",
    text: "text-amber-300",
    icon: "text-amber-400",
    glow: "shadow-[0_0_20px_oklch(0.75_0.16_80/25%)]",
  },
  info: {
    bg: "bg-foreground/[0.06]",
    border: "border-foreground/20",
    text: "text-foreground/80",
    icon: "text-foreground/60",
    glow: "",
  },
}

function timeAgo(createdAt: number): string {
  const seconds = Math.floor((Date.now() - createdAt) / 1000)
  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes === 1) return "1m ago"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ago`
}

export function NotificationBanner() {
  const { notifications, dismiss, dismissAll, activeCount } = useNotifications()
  const active = notifications.filter((n) => !n.dismissed)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [entering, setEntering] = useState(false)
  const prevCountRef = useRef(0)
  const [timeNow, setTimeNow] = useState(0)

  // Update relative timestamps
  useEffect(() => {
    setTimeNow(Date.now())
    if (active.length === 0) return
    const id = setInterval(() => setTimeNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [active.length])

  // Animate in when new notifications arrive
  useEffect(() => {
    if (activeCount > prevCountRef.current) {
      setEntering(true)
      setCurrentIndex(active.length - 1) // jump to newest
      const timer = setTimeout(() => setEntering(false), 400)
      return () => clearTimeout(timer)
    }
    prevCountRef.current = activeCount
  }, [activeCount, active.length])

  // Keep index in bounds
  useEffect(() => {
    if (currentIndex >= active.length) {
      setCurrentIndex(Math.max(0, active.length - 1))
    }
  }, [active.length, currentIndex])

  if (active.length === 0) return null

  const notif: AppNotification = active[currentIndex] ?? active[0]
  const theme = NOTIF_THEME[notif.type]
  const Icon = NOTIF_ICONS[notif.type]

  const prev = () => setCurrentIndex((i) => (i - 1 + active.length) % active.length)
  const next = () => setCurrentIndex((i) => (i + 1) % active.length)

  // Suppress timeNow lint - we use it to force re-render for timeAgo
  void timeNow

  return (
    <div
      className={cn(
        "shrink-0 transition-all duration-300 ease-out",
        entering ? "animate-in slide-in-from-top-2 fade-in" : ""
      )}
    >
      <div
        className={cn(
          "mx-1 flex items-center gap-3 rounded-lg border px-3 py-1.5 backdrop-blur-sm",
          theme.bg,
          theme.border,
          theme.glow
        )}
      >
        {/* Pulsing icon */}
        <div className="relative shrink-0">
          <Icon className={cn("size-4", theme.icon)} />
          <span
            className={cn(
              "absolute -top-0.5 -right-0.5 size-1.5 rounded-full animate-pulse",
              theme.icon.replace("text-", "bg-")
            )}
          />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span
              className={cn(
                "truncate font-[family-name:var(--font-display)] text-xs font-bold tracking-tight",
                theme.text
              )}
            >
              {notif.title}
            </span>
            <span className="shrink-0 font-mono text-[0.5rem] text-muted-foreground/40">
              {timeAgo(notif.createdAt)}
            </span>
          </div>
          {notif.body && (
            <p className="truncate text-[0.625rem] text-foreground/50">
              {notif.body}
            </p>
          )}
        </div>

        {/* Navigation (when multiple) */}
        {active.length > 1 && (
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              onClick={prev}
              className="rounded p-0.5 transition-colors hover:bg-foreground/10"
            >
              <ChevronLeft className="size-3 text-muted-foreground/50" />
            </button>
            <span className="font-mono text-[0.5rem] tabular-nums text-muted-foreground/40">
              {currentIndex + 1}/{active.length}
            </span>
            <button
              onClick={next}
              className="rounded p-0.5 transition-colors hover:bg-foreground/10"
            >
              <ChevronRight className="size-3 text-muted-foreground/50" />
            </button>
          </div>
        )}

        {/* Dismiss */}
        <button
          onClick={() => {
            if (active.length === 1) {
              dismissAll()
            } else {
              dismiss(notif.id)
            }
          }}
          className="shrink-0 rounded p-0.5 transition-colors hover:bg-foreground/10"
          title={active.length > 1 ? "Dismiss this" : "Dismiss"}
        >
          <X className="size-3 text-muted-foreground/40 hover:text-foreground/70" />
        </button>
      </div>
    </div>
  )
}
