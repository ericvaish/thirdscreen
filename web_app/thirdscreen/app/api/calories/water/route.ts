export const runtime = "edge"

import { NextResponse } from "next/server"
import { getDb } from "@/lib/get-db"
import { waterLogs } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { v4 as uuidv4 } from "uuid"
import { getAuthUserId } from "@/lib/auth"

// GET water log by cardId and date
export async function GET(request: Request) {
  try {
    const [userId, authError] = await getAuthUserId()
    if (authError) return authError
    const { searchParams } = new URL(request.url)
    const cardId = searchParams.get("cardId")
    const date = searchParams.get("date")

    if (!date) {
      return NextResponse.json(
        { error: "date is required" },
        { status: 400 }
      )
    }

    const items = cardId
      ? await getDb()
          .select()
          .from(waterLogs)
          .where(
            and(
              eq(waterLogs.cardId, cardId),
              eq(waterLogs.date, date),
              eq(waterLogs.userId, userId)
            )
          )
      : await getDb()
          .select()
          .from(waterLogs)
          .where(and(eq(waterLogs.date, date), eq(waterLogs.userId, userId)))

    // Return the first entry or null
    return NextResponse.json(items[0] ?? null)
  } catch (error) {
    console.error("Failed to fetch water log:", error)
    return NextResponse.json(
      { error: "Failed to fetch water log" },
      { status: 500 }
    )
  }
}

// PUT update water amount (upsert: create if not exists, update if exists)
export async function PUT(request: Request) {
  try {
    const [userId, authError] = await getAuthUserId()
    if (authError) return authError
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: any = await request.json()
    const { cardId, date, ml } = body

    if (!cardId || !date || ml === undefined) {
      return NextResponse.json(
        { error: "cardId, date, and ml are required" },
        { status: 400 }
      )
    }

    // Check if a water log already exists for this user+card+date
    const existing = await getDb()
      .select()
      .from(waterLogs)
      .where(
        and(
          eq(waterLogs.cardId, cardId),
          eq(waterLogs.date, date),
          eq(waterLogs.userId, userId)
        )
      )

    if (existing.length > 0) {
      await getDb()
        .update(waterLogs)
        .set({ ml })
        .where(and(eq(waterLogs.id, existing[0].id), eq(waterLogs.userId, userId)))

      const [updated] = await getDb()
        .select()
        .from(waterLogs)
        .where(eq(waterLogs.id, existing[0].id))
      return NextResponse.json(updated)
    } else {
      const id = uuidv4()
      await getDb().insert(waterLogs).values({ id, userId, cardId, date, ml })

      const [created] = await getDb()
        .select()
        .from(waterLogs)
        .where(eq(waterLogs.id, id))
      return NextResponse.json(created, { status: 201 })
    }
  } catch (error) {
    console.error("Failed to update water log:", error)
    return NextResponse.json(
      { error: "Failed to update water log" },
      { status: 500 }
    )
  }
}
