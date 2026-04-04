export const runtime = "edge"

import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth"
import {
  listServiceAccounts,
  removeServiceAccount,
  getGoogleClientId,
  type GoogleServiceType,
} from "@/lib/google-services/account"
import { fetchGmailStatus } from "@/lib/google-services/gmail"
import { fetchAllChatStatus } from "@/lib/google-services/chat"

// GET /api/google-services?service=gmail|chat&action=accounts|status|client-id
export async function GET(request: Request) {
  const [userId, authError] = await getAuthUserId()
  if (authError) return authError

  const { searchParams } = new URL(request.url)
  const service = searchParams.get("service") as GoogleServiceType | null
  const action = searchParams.get("action") ?? "status"

  if (action === "client-id") {
    const clientId = getGoogleClientId()
    return NextResponse.json({ clientId })
  }

  if (!service || !["gmail", "chat"].includes(service)) {
    return NextResponse.json({ error: "Invalid service" }, { status: 400 })
  }

  if (action === "accounts") {
    try {
      const accounts = await listServiceAccounts(service, userId)
      return NextResponse.json(
        accounts.map((a) => ({ id: a.id, email: a.email, service: a.service }))
      )
    } catch {
      // Table may not exist yet (migration not applied)
      return NextResponse.json([])
    }
  }

  if (action === "status") {
    try {
      if (service === "gmail") {
        const status = await fetchGmailStatus(userId)
        return NextResponse.json(status)
      }
      if (service === "chat") {
        const status = await fetchAllChatStatus(userId)
        return NextResponse.json(status)
      }
    } catch {
      // Table may not exist yet
      return NextResponse.json([])
    }
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 })
}

// DELETE /api/google-services?service=gmail|chat&id=...
export async function DELETE(request: Request) {
  const [userId, authError] = await getAuthUserId()
  if (authError) return authError

  const { searchParams } = new URL(request.url)
  const service = searchParams.get("service") as GoogleServiceType | null
  const id = searchParams.get("id")

  if (!service || !["gmail", "chat"].includes(service)) {
    return NextResponse.json({ error: "Invalid service" }, { status: 400 })
  }
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 })
  }

  await removeServiceAccount(id, service, userId)
  return NextResponse.json({ success: true })
}
