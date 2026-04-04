export const runtime = "edge"

import { NextResponse } from "next/server"
import { getDb } from "@/lib/get-db"
import { cards } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { v4 as uuidv4 } from "uuid"
import { getAuthUserId } from "@/lib/auth"

// POST create a new card
export async function POST(request: Request) {
  try {
    const [userId, authError] = await getAuthUserId()
    if (authError) return authError
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: any = await request.json()

    const VALID_CARD_TYPES = ["clock", "timer", "todo", "notes", "schedule", "calories", "medicines"]
    if (!body.type || !VALID_CARD_TYPES.includes(body.type)) {
      return NextResponse.json({ error: "Invalid or missing card type" }, { status: 400 })
    }

    const id = uuidv4()

    await getDb().insert(cards).values({
      id,
      userId,
      type: body.type,
      title: body.title ?? null,
      x: body.x ?? 0,
      y: body.y ?? 0,
      w: body.w ?? 4,
      h: body.h ?? 4,
      visible: body.visible ?? true,
      settings: body.settings ?? null,
    })

    const [created] = await getDb().select().from(cards).where(eq(cards.id, id))
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    console.error("Failed to create card:", error)
    return NextResponse.json(
      { error: "Failed to create card" },
      { status: 500 }
    )
  }
}

// DELETE remove a card
export async function DELETE(request: Request) {
  try {
    const [userId, authError] = await getAuthUserId()
    if (authError) return authError
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }

    await getDb()
      .delete(cards)
      .where(and(eq(cards.id, id), eq(cards.userId, userId)))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete card:", error)
    return NextResponse.json(
      { error: "Failed to delete card" },
      { status: 500 }
    )
  }
}
