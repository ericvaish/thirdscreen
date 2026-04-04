// Gmail service: fetch unread message count and recent message previews.

import { GMAIL_API } from "./constants"
import {
  listServiceAccounts,
  getValidToken,
  type GoogleServiceAccount,
} from "./account"

export interface GmailMessage {
  id: string
  threadId: string
  from: string
  subject: string
  snippet: string
  date: number // unix ms
}

export interface GmailStatus {
  email: string
  unreadCount: number
  recentMessages: GmailMessage[]
}

// ── Fetch unread messages for one account ──────────────────────────────────

async function fetchUnread(
  account: GoogleServiceAccount,
  maxResults = 10
): Promise<GmailStatus | null> {
  const token = await getValidToken(account)
  if (!token) return null

  // Get unread message IDs
  const params = new URLSearchParams({
    q: "is:unread category:primary",
    maxResults: String(maxResults),
  })

  const listRes = await fetch(`${GMAIL_API}/users/me/messages?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!listRes.ok) return null
  const listData: {
    messages?: { id: string }[]
    resultSizeEstimate?: number
  } = await listRes.json()
  const messageIds = (listData.messages ?? []).map((m) => m.id)
  const unreadCount = listData.resultSizeEstimate ?? messageIds.length

  // Fetch metadata for each message (batch of up to maxResults)
  const recentMessages: GmailMessage[] = []
  for (const msgId of messageIds.slice(0, 5)) {
    try {
      const msgRes = await fetch(
        `${GMAIL_API}/users/me/messages/${msgId}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (!msgRes.ok) continue
      const msg: {
        id: string
        threadId: string
        snippet?: string
        internalDate?: string
        payload?: { headers?: { name: string; value: string }[] }
      } = await msgRes.json()

      const headers = msg.payload?.headers ?? []
      const from =
        headers.find((h) => h.name === "From")?.value ?? ""
      const subject =
        headers.find((h) => h.name === "Subject")?.value ?? "(No subject)"

      recentMessages.push({
        id: msg.id,
        threadId: msg.threadId,
        from: parseFromHeader(from),
        subject,
        snippet: msg.snippet ?? "",
        date: Number(msg.internalDate) || Date.now(),
      })
    } catch {
      // Skip individual message failures
    }
  }

  return { email: account.email, unreadCount, recentMessages }
}

// Parse "Name <email>" into just the name (or email if no name)
function parseFromHeader(from: string): string {
  const match = from.match(/^"?([^"<]+)"?\s*</)
  return match ? match[1].trim() : from.replace(/<.*>/, "").trim() || from
}

// ── Public API ─────────────────────────────────────────────────────────────

export async function fetchGmailStatus(
  userId: string = ""
): Promise<GmailStatus[]> {
  const accounts = await listServiceAccounts("gmail", userId)
  const results = await Promise.all(accounts.map(fetchUnread))
  return results.filter((r): r is GmailStatus => r !== null)
}
