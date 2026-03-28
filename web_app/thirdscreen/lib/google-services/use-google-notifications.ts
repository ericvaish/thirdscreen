"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useNotifications } from "@/lib/notifications"

const POLL_INTERVAL = 30_000 // 30 seconds
const ACCOUNT_CHECK_INTERVAL = 60_000 // check for new accounts every 60s

// ── Gmail types (matches API response) ─────────────────────────────────────

interface GmailMessage {
  id: string
  from: string
  subject: string
  snippet: string
}

interface GmailStatus {
  email: string
  unreadCount: number
  recentMessages: GmailMessage[]
}

// ── Chat types (matches API response) ──────────────────────────────────────

interface ChatMessage {
  id: string
  spaceDisplayName: string
  sender: string
  text: string
}

interface ChatStatus {
  email: string
  recentMessages: ChatMessage[]
}

// ── Unread counts exposed to StatusBar ─────────────────────────────────────

export interface UnreadCounts {
  gmail: number
  chat: number
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useGoogleNotifications() {
  const { push } = useNotifications()
  const [unread, setUnread] = useState<UnreadCounts>({ gmail: 0, chat: 0 })
  const [hasGmail, setHasGmail] = useState(false)
  const [hasChat, setHasChat] = useState(false)

  // Track seen message IDs so we only notify on genuinely new messages
  const seenGmailRef = useRef<Set<string>>(new Set())
  const seenChatRef = useRef<Set<string>>(new Set())
  const initialFetchRef = useRef({ gmail: true, chat: true })

  // Check which services have connected accounts
  const checkAccounts = useCallback(async () => {
    try {
      const [gmailRes, chatRes] = await Promise.all([
        fetch("/api/google-services?service=gmail&action=accounts"),
        fetch("/api/google-services?service=chat&action=accounts"),
      ])
      if (gmailRes.ok) {
        const accounts: unknown[] = await gmailRes.json()
        setHasGmail(accounts.length > 0)
      }
      if (chatRes.ok) {
        const accounts: unknown[] = await chatRes.json()
        setHasChat(accounts.length > 0)
      }
    } catch {
      // Silently fail
    }
  }, [])

  // Check accounts on mount and periodically
  useEffect(() => {
    checkAccounts()
    const interval = setInterval(checkAccounts, ACCOUNT_CHECK_INTERVAL)
    return () => clearInterval(interval)
  }, [checkAccounts])

  const pollGmail = useCallback(async () => {
    if (!hasGmail) return
    try {
      const res = await fetch("/api/google-services?service=gmail&action=status")
      if (!res.ok) return
      const data: GmailStatus[] = await res.json()

      const totalUnread = data.reduce((sum, d) => sum + d.unreadCount, 0)
      setUnread((prev) => ({ ...prev, gmail: totalUnread }))

      for (const account of data) {
        for (const msg of account.recentMessages) {
          if (seenGmailRef.current.has(msg.id)) continue
          seenGmailRef.current.add(msg.id)

          // Don't notify on first fetch (existing unreads)
          if (initialFetchRef.current.gmail) continue

          push("email", msg.subject || "(No subject)", {
            body: `${msg.from}: ${msg.snippet}`.slice(0, 120),
            ttl: 15_000,
            meta: { messageId: msg.id, email: account.email },
          })
        }
      }
      initialFetchRef.current.gmail = false
    } catch {
      // Silently fail - will retry on next poll
    }
  }, [push, hasGmail])

  const pollChat = useCallback(async () => {
    if (!hasChat) return
    try {
      const res = await fetch("/api/google-services?service=chat&action=status")
      if (!res.ok) return
      const data: ChatStatus[] = await res.json()

      const totalNew = data.reduce((sum, d) => sum + d.recentMessages.length, 0)
      setUnread((prev) => ({ ...prev, chat: totalNew }))

      for (const account of data) {
        for (const msg of account.recentMessages) {
          if (seenChatRef.current.has(msg.id)) continue
          seenChatRef.current.add(msg.id)

          if (initialFetchRef.current.chat) continue

          push("chat", msg.spaceDisplayName, {
            body: `${msg.sender}: ${msg.text}`.slice(0, 120),
            ttl: 15_000,
            meta: { messageId: msg.id, email: account.email },
          })
        }
      }
      initialFetchRef.current.chat = false
    } catch {
      // Silently fail
    }
  }, [push, hasChat])

  // Only poll status when accounts are connected
  useEffect(() => {
    if (!hasGmail && !hasChat) return

    // Initial status fetch
    if (hasGmail) pollGmail()
    if (hasChat) pollChat()

    const interval = setInterval(() => {
      if (hasGmail) pollGmail()
      if (hasChat) pollChat()
    }, POLL_INTERVAL)

    return () => clearInterval(interval)
  }, [pollGmail, pollChat, hasGmail, hasChat])

  return unread
}
