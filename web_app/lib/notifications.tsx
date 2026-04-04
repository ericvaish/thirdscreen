"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import {
  listNotifications,
  createNotification,
  updateNotification,
  markAllNotificationsRead,
} from "./data-layer"

// ── Notification Types ──────────────────────────────────────────────────────

export type NotificationType = "timer" | "alarm" | "meeting" | "email" | "chat" | "info"

export interface AppNotification {
  id: string
  type: NotificationType
  title: string
  body?: string | null
  /** ISO timestamp */
  createdAt: string
  /** Client-only: auto-mark-as-read after this many ms (0 = sticky). Not persisted. */
  ttl: number
  /** Client-only: animation state for dismissing */
  dismissed: boolean
  /** Whether the notification has been read (persisted) */
  read: boolean
  /** Optional metadata */
  meta?: Record<string, unknown> | null
}

// ── Context ─────────────────────────────────────────────────────────────────

interface NotificationContextType {
  /** Unread / active notifications */
  notifications: AppNotification[]
  /** Read / past notifications (history) */
  history: AppNotification[]
  /** Whether history has been loaded from DB */
  historyLoaded: boolean
  /** Push a new notification. Returns its ID. */
  push: (
    type: NotificationType,
    title: string,
    opts?: { body?: string; ttl?: number; meta?: Record<string, unknown> }
  ) => string
  /** Dismiss a notification by ID (marks as read, moves to history) */
  dismiss: (id: string) => void
  /** Dismiss all notifications (marks all as read) */
  dismissAll: () => void
  /** Count of active (unread) notifications */
  activeCount: number
}

const NotificationContext = createContext<NotificationContextType>({
  notifications: [],
  history: [],
  historyLoaded: false,
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
  const [history, setHistory] = useState<AppNotification[]>([])
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const knownIdsRef = useRef<Set<string>>(new Set())

  // Load notifications from DB on mount
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const items: any[] = (await listNotifications({ limit: 50 })) as any[]
        if (cancelled) return

        const unread: AppNotification[] = []
        const readItems: AppNotification[] = []

        for (const item of items) {
          // Skip items already in state (pushed before DB load completed)
          if (knownIdsRef.current.has(item.id)) continue
          knownIdsRef.current.add(item.id)

          const notif: AppNotification = {
            id: item.id,
            type: item.type as NotificationType,
            title: item.title,
            body: item.body,
            createdAt: item.createdAt || item.created_at,
            ttl: 0,
            dismissed: false,
            read: item.read,
            meta: item.meta,
          }

          if (item.read) {
            readItems.push(notif)
          } else {
            unread.push(notif)
          }
        }

        setNotifications((prev) => [...prev, ...unread])
        setHistory(readItems)
        setHistoryLoaded(true)
      } catch (err) {
        console.error("Failed to load notifications:", err)
        setHistoryLoaded(true)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const dismiss = useCallback((id: string) => {
    // Animate out
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, dismissed: true } : n))
    )

    // After animation, move to history
    setTimeout(() => {
      setNotifications((prev) => {
        const item = prev.find((n) => n.id === id)
        if (item) {
          setHistory((h) => [{ ...item, read: true, dismissed: false }, ...h])
        }
        return prev.filter((n) => n.id !== id)
      })
    }, 300)

    // Persist read state (fire-and-forget)
    updateNotification({ id, read: true }).catch(() => {})

    // Clear TTL timer
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
      const ttl = opts?.ttl ?? 10_000
      const notification: AppNotification = {
        id,
        type,
        title,
        body: opts?.body,
        createdAt: new Date().toISOString(),
        ttl,
        dismissed: false,
        read: false,
        meta: opts?.meta,
      }

      knownIdsRef.current.add(id)
      setNotifications((prev) => [...prev, notification])

      // Auto-dismiss after TTL (marks as read)
      if (ttl > 0) {
        const timer = setTimeout(() => dismiss(id), ttl)
        timersRef.current.set(id, timer)
      }

      // Persist to DB (fire-and-forget)
      createNotification({
        id,
        type,
        title,
        body: opts?.body,
        meta: opts?.meta,
      }).catch(() => {})

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
    [dismiss],
  )

  const dismissAll = useCallback(() => {
    setNotifications((prev) => {
      // Move all to history
      setHistory((h) => [
        ...prev.map((n) => ({ ...n, read: true, dismissed: false })),
        ...h,
      ])
      return []
    })

    // Clear all TTL timers
    for (const timer of timersRef.current.values()) clearTimeout(timer)
    timersRef.current.clear()

    // Persist (fire-and-forget)
    markAllNotificationsRead().catch(() => {})
  }, [])

  const activeCount = notifications.filter((n) => !n.dismissed).length

  return (
    <NotificationContext value={{
      notifications,
      history,
      historyLoaded,
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
