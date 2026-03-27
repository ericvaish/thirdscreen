export const runtime = "edge"

import { NextResponse } from "next/server"
import { getDb } from "@/lib/get-db"
import { foodItems } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { v4 as uuidv4 } from "uuid"
import { getAuthUserId } from "@/lib/auth"

// GET food items by cardId and date
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
          .from(foodItems)
          .where(
            and(
              eq(foodItems.cardId, cardId),
              eq(foodItems.date, date),
              eq(foodItems.userId, userId)
            )
          )
      : await getDb()
          .select()
          .from(foodItems)
          .where(and(eq(foodItems.date, date), eq(foodItems.userId, userId)))
    return NextResponse.json(items)
  } catch (error) {
    console.error("Failed to fetch food items:", error)
    return NextResponse.json(
      { error: "Failed to fetch food items" },
      { status: 500 }
    )
  }
}

// POST create food item
export async function POST(request: Request) {
  try {
    const [userId, authError] = await getAuthUserId()
    if (authError) return authError
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: any = await request.json()
    const id = uuidv4()

    await getDb().insert(foodItems).values({
      id,
      userId,
      cardId: body.cardId,
      name: body.name,
      calories: body.calories,
      date: body.date,
    })

    const [created] = await getDb()
      .select()
      .from(foodItems)
      .where(eq(foodItems.id, id))
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    console.error("Failed to create food item:", error)
    return NextResponse.json(
      { error: "Failed to create food item" },
      { status: 500 }
    )
  }
}

// DELETE food item
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
      .delete(foodItems)
      .where(and(eq(foodItems.id, id), eq(foodItems.userId, userId)))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete food item:", error)
    return NextResponse.json(
      { error: "Failed to delete food item" },
      { status: 500 }
    )
  }
}
