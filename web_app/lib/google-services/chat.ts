// Google Chat service: fetch recent messages/notifications from spaces.

import { CHAT_API } from "./constants"
import {
  listServiceAccounts,
  getValidToken,
  type GoogleServiceAccount,
} from "./account"

export interface ChatSpace {
  name: string // e.g. "spaces/AAAA"
  displayName: string
  type: "ROOM" | "DM" | "GROUP_CHAT"
}

export interface ChatMessage {
  id: string
  spaceName: string
  spaceDisplayName: string
  sender: string
  text: string
  createTime: number // unix ms
}

export interface ChatStatus {
  email: string
  spaces: ChatSpace[]
  recentMessages: ChatMessage[]
}

// ── Fetch spaces and recent messages for one account ───────────────────────

async function fetchChatStatus(
  account: GoogleServiceAccount
): Promise<ChatStatus | null> {
  const token = await getValidToken(account)
  if (!token) return null

  // List spaces the user is in
  const spacesRes = await fetch(`${CHAT_API}/spaces?pageSize=20`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!spacesRes.ok) return null
  const spacesData: {
    spaces?: { name: string; displayName?: string; type?: string }[]
  } = await spacesRes.json()

  const spaces: ChatSpace[] = (spacesData.spaces ?? []).map((s) => ({
    name: s.name,
    displayName: s.displayName ?? s.name,
    type: (s.type ?? "ROOM") as ChatSpace["type"],
  }))

  // Fetch recent messages from each space (up to 3 per space, max 5 spaces)
  const recentMessages: ChatMessage[] = []
  for (const space of spaces.slice(0, 5)) {
    try {
      const msgsRes = await fetch(
        `${CHAT_API}/${space.name}/messages?pageSize=3&orderBy=createTime desc`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (!msgsRes.ok) continue
      const msgsData: {
        messages?: {
          name?: string
          text?: string
          createTime?: string
          sender?: { displayName?: string; name?: string }
        }[]
      } = await msgsRes.json()

      for (const msg of msgsData.messages ?? []) {
        recentMessages.push({
          id: msg.name ?? "",
          spaceName: space.name,
          spaceDisplayName: space.displayName,
          sender: msg.sender?.displayName ?? msg.sender?.name ?? "Unknown",
          text: msg.text ?? "",
          createTime: msg.createTime
            ? new Date(msg.createTime).getTime()
            : Date.now(),
        })
      }
    } catch {
      // Skip failed spaces
    }
  }

  // Sort by time, newest first
  recentMessages.sort((a, b) => b.createTime - a.createTime)

  return { email: account.email, spaces, recentMessages: recentMessages.slice(0, 10) }
}

// ── Public API ─────────────────────────────────────────────────────────────

export async function fetchAllChatStatus(
  userId: string = ""
): Promise<ChatStatus[]> {
  const accounts = await listServiceAccounts("chat", userId)
  const results = await Promise.all(accounts.map(fetchChatStatus))
  return results.filter((r): r is ChatStatus => r !== null)
}
