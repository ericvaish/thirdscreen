"use client"

import { useEffect, useRef, useState } from "react"
import { Bell, X, Trash2, Timer, Clock, CalendarDays, Mail, MessageSquare, Info } from "lucide-react"
import { useNotifications, type NotificationType, type AppNotification } from "@/lib/notifications"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

// ── Icon & color mapping ────────────────────────────────────────────────────

const NOTIF_ICONS: Record<NotificationType, typeof Bell> = {
  timer: Timer,
  alarm: Clock,
  meeting: CalendarDays,
  email: Mail,
  chat: MessageSquare,
  info: Info,
}

const NOTIF_COLORS: Record<NotificationType, string> = {
  timer: "text-emerald-400",
  alarm: "text-amber-400",
  meeting: "text-blue-400",
  email: "text-violet-400",
  chat: "text-cyan-400",
  info: "text-muted-foreground",
}

const URGENT_TYPES: Set<NotificationType> = new Set(["timer", "alarm", "meeting"])

// ── Toast Pop-up (urgent notifications) ─────────────────────────────────────

function NotificationToast({
  notification,
  onDismiss,
}: {
  notification: AppNotification
  onDismiss: () => void
}) {
  const Icon = NOTIF_ICONS[notification.type]
  const color = NOTIF_COLORS[notification.type]

  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-xl border border-border/30 bg-card/95 px-3.5 py-2.5 shadow-xl backdrop-blur-xl transition-all duration-300",
        notification.dismissed && "translate-y-[-8px] scale-95 opacity-0",
      )}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", color)} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{notification.title}</p>
        {notification.body && (
          <p className="mt-0.5 text-xs text-muted-foreground/60">{notification.body}</p>
        )}
      </div>
      <button
        onClick={onDismiss}
        className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground/30 transition-colors hover:text-foreground"
      >
        <X className="size-3" />
      </button>
    </div>
  )
}

// ── Notification Bell ───────────────────────────────────────────────────────

export function NotificationBell() {
  const { notifications, history, dismiss, dismissAll, activeCount } = useNotifications()
  const [panelOpen, setPanelOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const bellRef = useRef<HTMLDivElement>(null)

  const active = notifications.filter((n) => !n.dismissed)
  const urgent = active.filter(
    (n) => URGENT_TYPES.has(n.type) && Date.now() - new Date(n.createdAt).getTime() < 8000,
  )

  // Close panel on click outside
  useEffect(() => {
    if (!panelOpen) return
    const handleClick = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        bellRef.current && !bellRef.current.contains(e.target as Node)
      ) {
        setPanelOpen(false)
      }
    }
    document.addEventListener("pointerdown", handleClick)
    return () => document.removeEventListener("pointerdown", handleClick)
  }, [panelOpen])

  return (
    <div ref={bellRef} className="relative">
      {/* Bell button */}
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={() => setPanelOpen(!panelOpen)}
        className={cn(
          "relative",
          activeCount > 0
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground",
        )}
        title="Notifications"
      >
        <Bell className="size-4" />
        {activeCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
            {activeCount > 9 ? "9+" : activeCount}
          </span>
        )}
      </Button>

      {/* Urgent toast pop-ups */}
      {urgent.length > 0 && !panelOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 flex w-72 flex-col gap-1.5">
          {urgent.slice(0, 3).map((n) => (
            <NotificationToast
              key={n.id}
              notification={n}
              onDismiss={() => dismiss(n.id)}
            />
          ))}
        </div>
      )}

      {/* Notification panel */}
      {panelOpen && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full z-50 mt-2 flex w-80 flex-col overflow-hidden rounded-xl border border-border/30 bg-card/95 shadow-2xl backdrop-blur-xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/20 px-4 py-2.5">
            <span className="text-xs font-semibold text-foreground">
              Notifications
            </span>
            {active.length > 0 && (
              <button
                onClick={() => dismissAll()}
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground/50 transition-colors hover:text-foreground"
              >
                <Trash2 className="size-3" />
                Clear all
              </button>
            )}
          </div>

          {/* Scrollable content */}
          <div className="max-h-96 overflow-y-auto">
            {/* Unread / active notifications */}
            {active.length > 0 && (
              <div>
                {active.map((notif) => (
                  <NotificationRow
                    key={notif.id}
                    notification={notif}
                    onDismiss={() => dismiss(notif.id)}
                    showDismiss
                  />
                ))}
              </div>
            )}

            {/* History divider */}
            {history.length > 0 && (
              <div className="border-t border-border/20 px-4 py-1.5">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/30">
                  History
                </span>
              </div>
            )}

            {/* History / read notifications */}
            {history.length > 0 && (
              <div className="opacity-60">
                {history.map((notif) => (
                  <NotificationRow
                    key={notif.id}
                    notification={notif}
                    showDismiss={false}
                  />
                ))}
              </div>
            )}

            {/* Empty state */}
            {active.length === 0 && history.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Bell className="size-5 text-muted-foreground/20" />
                <p className="mt-2 text-xs text-muted-foreground/40">
                  No notifications
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Notification Row ────────────────────────────────────────────────────────

function NotificationRow({
  notification,
  onDismiss,
  showDismiss,
}: {
  notification: AppNotification
  onDismiss?: () => void
  showDismiss: boolean
}) {
  const Icon = NOTIF_ICONS[notification.type]
  const color = NOTIF_COLORS[notification.type]
  const ago = formatTimeAgo(notification.createdAt)

  return (
    <div
      className={cn(
        "flex items-start gap-2.5 border-b border-border/10 px-4 py-2.5 transition-colors last:border-0 hover:bg-muted/10",
        notification.dismissed && "scale-95 opacity-0 transition-all duration-300",
      )}
    >
      <Icon className={cn("mt-0.5 size-3.5 shrink-0", color)} />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground">{notification.title}</p>
        {notification.body && (
          <p className="mt-0.5 text-xs text-muted-foreground/50">
            {notification.body}
          </p>
        )}
        <p className="mt-0.5 text-xs text-muted-foreground/30">{ago}</p>
      </div>
      {showDismiss && onDismiss && (
        <button
          onClick={onDismiss}
          className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground/20 transition-colors hover:text-foreground"
        >
          <X className="size-3" />
        </button>
      )}
    </div>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatTimeAgo(timestamp: string): string {
  const diff = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000)
  if (diff < 10) return "just now"
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}
