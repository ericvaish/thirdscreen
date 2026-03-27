import { NextResponse } from "next/server"
import { getDb } from "@/lib/get-db"
import { enabledIntegrations } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { getAuthUserId } from "@/lib/auth"

// GET all enabled integrations
export async function GET() {
  try {
    const [userId, authError] = await getAuthUserId()
    if (authError) return authError
    const items = await getDb()
      .select()
      .from(enabledIntegrations)
      .where(eq(enabledIntegrations.userId, userId))
    return NextResponse.json(items)
  } catch (error) {
    console.error("Failed to fetch integrations:", error)
    return NextResponse.json(
      { error: "Failed to fetch integrations" },
      { status: 500 }
    )
  }
}

// PUT toggle an integration (upsert: create if missing, update if exists)
export async function PUT(request: Request) {
  try {
    const [userId, authError] = await getAuthUserId()
    if (authError) return authError
    const body = await request.json()
    const { integrationId, enabled } = body

    if (!integrationId || enabled === undefined) {
      return NextResponse.json(
        { error: "integrationId and enabled are required" },
        { status: 400 }
      )
    }

    const existing = await getDb()
      .select()
      .from(enabledIntegrations)
      .where(
        and(
          eq(enabledIntegrations.integrationId, integrationId),
          eq(enabledIntegrations.userId, userId)
        )
      )

    if (existing.length > 0) {
      await getDb()
        .update(enabledIntegrations)
        .set({ enabled })
        .where(
          and(
            eq(enabledIntegrations.id, existing[0].id),
            eq(enabledIntegrations.userId, userId)
          )
        )
    } else {
      await getDb().insert(enabledIntegrations).values({
        id: integrationId,
        userId,
        integrationId,
        enabled,
      })
    }

    const all = await getDb()
      .select()
      .from(enabledIntegrations)
      .where(eq(enabledIntegrations.userId, userId))
    return NextResponse.json(all)
  } catch (error) {
    console.error("Failed to update integration:", error)
    return NextResponse.json(
      { error: "Failed to update integration" },
      { status: 500 }
    )
  }
}
