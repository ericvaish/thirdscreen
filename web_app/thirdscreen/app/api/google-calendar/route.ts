export const runtime = "edge"

import { NextResponse } from "next/server"
import {
  listGoogleAccounts,
  removeGoogleAccount,
  fetchAllGoogleEvents,
} from "@/lib/google-calendar/service"
import { getDb } from "@/lib/get-db"
import { settings, calendarAccounts } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { GOOGLE_CLIENT_ID_KEY } from "@/lib/google-calendar/constants"
import { getAuthUserId } from "@/lib/auth"

// GET /api/google-calendar
// ?action=accounts  -> list connected accounts
// ?action=events&date=YYYY-MM-DD -> fetch events from all accounts
// ?action=client-id -> get the stored client ID
export async function GET(request: Request) {
  const [userId, authError] = await getAuthUserId()
    if (authError) return authError
  const { searchParams } = new URL(request.url)
  const action = searchParams.get("action") ?? "accounts"

  if (action === "client-id") {
    // Env var takes priority, then DB setting
    const envClientId = process.env.GOOGLE_CLIENT_ID ?? null
    if (envClientId) {
      return NextResponse.json({ clientId: envClientId, adminProvided: true })
    }
    const [row] = await getDb()
      .select()
      .from(settings)
      .where(
        and(eq(settings.key, GOOGLE_CLIENT_ID_KEY), eq(settings.userId, userId))
      )
    return NextResponse.json({ clientId: row?.value ?? null, adminProvided: false })
  }

  if (action === "accounts") {
    const accounts = await listGoogleAccounts(userId)
    // Don't leak tokens to the frontend
    return NextResponse.json(
      accounts.map((a) => ({
        id: a.id,
        email: a.email,
        color: a.color,
        calendarIds: a.calendarIds,
        createdAt: a.createdAt,
      }))
    )
  }

  if (action === "events") {
    const date = searchParams.get("date")
    if (!date) {
      return NextResponse.json({ error: "date is required" }, { status: 400 })
    }
    const events = await fetchAllGoogleEvents(date, userId)
    return NextResponse.json(events)
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 })
}

// PUT /api/google-calendar
// Set client ID or update account settings
export async function PUT(request: Request) {
  const [userId, authError] = await getAuthUserId()
    if (authError) return authError
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: any = await request.json()

  // Update account color or calendarIds
  if (body.accountId) {
    const updates: Record<string, unknown> = {}
    if (body.color !== undefined) updates.color = body.color
    if (body.calendarIds !== undefined)
      updates.calendarIds = body.calendarIds

    if (Object.keys(updates).length > 0) {
      await getDb()
        .update(calendarAccounts)
        .set(updates)
        .where(
          and(
            eq(calendarAccounts.id, body.accountId),
            eq(calendarAccounts.userId, userId)
          )
        )
    }
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: "Invalid request" }, { status: 400 })
}

// DELETE /api/google-calendar?id=...
export async function DELETE(request: Request) {
  const [userId, authError] = await getAuthUserId()
    if (authError) return authError
  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 })
  }

  await removeGoogleAccount(id, userId)
  return NextResponse.json({ success: true })
}
