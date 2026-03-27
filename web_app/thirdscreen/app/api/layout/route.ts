import { NextResponse } from "next/server"
import { getDb } from "@/lib/get-db"
import { cards } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { getAuthUserId } from "@/lib/auth"

// GET all cards (layout)
export async function GET() {
  try {
    const [userId, authError] = await getAuthUserId()
    if (authError) return authError
    const allCards = await getDb()
      .select()
      .from(cards)
      .where(eq(cards.userId, userId))
    return NextResponse.json(allCards)
  } catch (error) {
    console.error("Failed to fetch layout:", error)
    return NextResponse.json(
      { error: "Failed to fetch layout" },
      { status: 500 }
    )
  }
}

// PUT update card positions
export async function PUT(request: Request) {
  try {
    const [userId, authError] = await getAuthUserId()
    if (authError) return authError
    const positions: { id: string; x: number; y: number; w: number; h: number }[] =
      await request.json()

    for (const pos of positions) {
      await getDb()
        .update(cards)
        .set({ x: pos.x, y: pos.y, w: pos.w, h: pos.h })
        .where(and(eq(cards.id, pos.id), eq(cards.userId, userId)))
    }

    const updated = await getDb()
      .select()
      .from(cards)
      .where(eq(cards.userId, userId))
    return NextResponse.json(updated)
  } catch (error) {
    console.error("Failed to update layout:", error)
    return NextResponse.json(
      { error: "Failed to update layout" },
      { status: 500 }
    )
  }
}
