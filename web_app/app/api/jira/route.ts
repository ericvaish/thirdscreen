import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth"
import {
  getClientId,
  listJiraAccounts,
  removeJiraAccount,
  fetchAllJiraIssues,
} from "@/lib/jira/service"

export async function GET(request: Request) {
  const [userId, authError] = await getAuthUserId()
  if (authError) return authError

  const { searchParams } = new URL(request.url)
  const action = searchParams.get("action")

  if (action === "client-id") {
    const clientId = getClientId()
    return NextResponse.json({ clientId })
  }

  if (action === "accounts") {
    const accounts = await listJiraAccounts(userId)
    return NextResponse.json(
      accounts.map((a) => ({
        id: a.id,
        email: a.email,
        displayName: a.displayName,
        siteUrl: a.siteUrl,
        createdAt: a.createdAt,
      }))
    )
  }

  if (action === "issues") {
    const issues = await fetchAllJiraIssues(userId)
    return NextResponse.json(issues)
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 })
}

export async function DELETE(request: Request) {
  const [userId, authError] = await getAuthUserId()
  if (authError) return authError

  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 })
  }

  await removeJiraAccount(id, userId)
  return NextResponse.json({ success: true })
}
