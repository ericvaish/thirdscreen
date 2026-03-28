"use client"

import { createContext, useCallback, useContext, useRef, useState } from "react"

// ── Notification Types ──────────────────────────────────────────────────────

export type NotificationType = "timer" | "alarm" | "meeting" | "email" | "chat" | "info"

export interface AppNotification {
  id: string
  type: NotificationType
  title: string
  body?: string
  /** Timestamp when the notification was created */
  createdAt: number
  /** Auto-dismiss after this many ms (0 = sticky until dismissed) */
  ttl: number
  /** Whether the user has dismissed this notification */
  dismissed: boolean
  /** Optional metadata */
  meta?: Record<string, unknown>
}

// ── Context ─────────────────────────────────────────────────────────────────

interface NotificationContextType {
  notifications: AppNotification[]
  /** Push a new notification. Returns its ID. */
  push: (
    type: NotificationType,
    title: string,
    opts?: { body?: string; ttl?: number; meta?: Record<string, unknown> }
  ) => string
  /** Dismiss a notification by ID */
  dismiss: (id: string) => void
  /** Dismiss all notifications */
  dismissAll: () => void
  /** Count of active (non-dismissed) notifications */
  activeCount: number
}

const NotificationContext = createContext<NotificationContextType>({
  notifications: [],
  push: () => "",
  dismiss: () => {},
  dismissAll: () => {},
  activeCount: 0,
})

// ── Provider ────────────────────────────────────────────────────────────────

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  )

  const dismiss = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, dismissed: true } : n))
    )
    // Clean up after animation
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id))
    }, 300)
    const timer = timersRef.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timersRef.current.delete(id)
    }
  }, [])

  const push = useCallback(
    (
      type: NotificationType,
      title: string,
      opts?: { body?: string; ttl?: number; meta?: Record<string, unknown> }
    ): string => {
      const id = crypto.randomUUID()
      const ttl = opts?.ttl ?? 10_000 // default 10s
      const notification: AppNotification = {
        id,
        type,
        title,
        body: opts?.body,
        createdAt: Date.now(),
        ttl,
        dismissed: false,
        meta: opts?.meta,
      }

      setNotifications((prev) => [...prev, notification])

      // Auto-dismiss after TTL
      if (ttl > 0) {
        const timer = setTimeout(() => dismiss(id), ttl)
        timersRef.current.set(id, timer)
      }

      // Browser notification (best-effort)
      try {
        if (
          typeof Notification !== "undefined" &&
          Notification.permission === "granted"
        ) {
          new Notification(title, { body: opts?.body, tag: id })
        }
      } catch {}

      return id
    },
    [dismiss]
  )

  const dismissAll = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, dismissed: true })))
    setTimeout(() => setNotifications([]), 300)
    for (const timer of timersRef.current.values()) clearTimeout(timer)
    timersRef.current.clear()
  }, [])

  const activeCount = notifications.filter((n) => !n.dismissed).length

  return (
    <NotificationContext value={{
      notifications,
      push,
      dismiss,
      dismissAll,
      activeCount,
    }}>
      {children}
    </NotificationContext>
  )
}

export function useNotifications() {
  return useContext(NotificationContext)
}
