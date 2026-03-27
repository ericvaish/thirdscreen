import { NextResponse } from "next/server"
import { getDb } from "@/lib/get-db"
import { settings } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { getAuthUserId } from "@/lib/auth"

// GET all settings
export async function GET() {
  try {
    const [userId, authError] = await getAuthUserId()
    if (authError) return authError
    const allSettings = await getDb()
      .select()
      .from(settings)
      .where(eq(settings.userId, userId))
    // Filter out sensitive keys (OAuth tokens) before returning to frontend
    const SENSITIVE_PREFIXES = ["spotify_access_token", "spotify_refresh_token", "spotify_token_expiry"]
    const result: Record<string, unknown> = {}
    for (const s of allSettings) {
      if (!SENSITIVE_PREFIXES.includes(s.key)) {
        result[s.key] = s.value
      }
    }
    return NextResponse.json(result)
  } catch (error) {
    console.error("Failed to fetch settings:", error)
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    )
  }
}

// PUT update a setting (upsert)
export async function PUT(request: Request) {
  try {
    const [userId, authError] = await getAuthUserId()
    if (authError) return authError
    const body = await request.json()
    const { key, value } = body

    if (!key) {
      return NextResponse.json({ error: "key is required" }, { status: 400 })
    }

    // Check if setting exists for this user
    const existing = await getDb()
      .select()
      .from(settings)
      .where(and(eq(settings.key, key), eq(settings.userId, userId)))

    if (existing.length > 0) {
      await getDb()
        .update(settings)
        .set({ value })
        .where(and(eq(settings.key, key), eq(settings.userId, userId)))
    } else {
      await getDb().insert(settings).values({ key, userId, value })
    }

    return NextResponse.json({ key, value })
  } catch (error) {
    console.error("Failed to update setting:", error)
    return NextResponse.json(
      { error: "Failed to update setting" },
      { status: 500 }
    )
  }
}
