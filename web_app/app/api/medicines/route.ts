
import { NextResponse } from "next/server"
import { getDb } from "@/lib/get-db"
import { medicines } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { v4 as uuidv4 } from "uuid"
import { getAuthUserId, verifyCardOwnership } from "@/lib/auth"

// GET medicines by cardId
export async function GET(request: Request) {
  try {
    const [userId, authError] = await getAuthUserId()
    if (authError) return authError
    const { searchParams } = new URL(request.url)
    const cardId = searchParams.get("cardId")

    const items = cardId
      ? await getDb()
          .select()
          .from(medicines)
          .where(
            and(eq(medicines.cardId, cardId), eq(medicines.userId, userId))
          )
      : await getDb()
          .select()
          .from(medicines)
          .where(eq(medicines.userId, userId))
    return NextResponse.json(items)
  } catch (error) {
    console.error("Failed to fetch medicines:", error)
    return NextResponse.json(
      { error: "Failed to fetch medicines" },
      { status: 500 }
    )
  }
}

// POST create medicine
export async function POST(request: Request) {
  try {
    const [userId, authError] = await getAuthUserId()
    if (authError) return authError
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: any = await request.json()

    if (!body.cardId || !body.name || typeof body.name !== "string") {
      return NextResponse.json({ error: "cardId and name are required" }, { status: 400 })
    }

    if (!(await verifyCardOwnership(body.cardId, userId))) {
      return NextResponse.json({ error: "Card not found" }, { status: 403 })
    }

    const id = uuidv4()

    await getDb().insert(medicines).values({
      id,
      userId,
      cardId: body.cardId,
      name: body.name,
      dosage: body.dosage ?? null,
      times: body.times ?? [],
      repeatPattern: body.repeatPattern ?? "daily",
      activeDays: body.activeDays ?? [0, 1, 2, 3, 4, 5, 6],
      active: body.active ?? true,
    })

    const [created] = await getDb()
      .select()
      .from(medicines)
      .where(eq(medicines.id, id))
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    console.error("Failed to create medicine:", error)
    return NextResponse.json(
      { error: "Failed to create medicine" },
      { status: 500 }
    )
  }
}

// PUT update medicine
export async function PUT(request: Request) {
  try {
    const [userId, authError] = await getAuthUserId()
    if (authError) return authError
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: any = await request.json()
    const { id } = body

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }

    const updates: Record<string, unknown> = {}
    if (body.name !== undefined) updates.name = body.name
    if (body.dosage !== undefined) updates.dosage = body.dosage
    if (body.times !== undefined) updates.times = body.times
    if (body.repeatPattern !== undefined) updates.repeatPattern = body.repeatPattern
    if (body.activeDays !== undefined) updates.activeDays = body.activeDays
    if (body.active !== undefined) updates.active = body.active

    await getDb()
      .update(medicines)
      .set(updates)
      .where(and(eq(medicines.id, id), eq(medicines.userId, userId)))

    const [updated] = await getDb()
      .select()
      .from(medicines)
      .where(and(eq(medicines.id, id), eq(medicines.userId, userId)))
    return NextResponse.json(updated)
  } catch (error) {
    console.error("Failed to update medicine:", error)
    return NextResponse.json(
      { error: "Failed to update medicine" },
      { status: 500 }
    )
  }
}

// DELETE medicine
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
      .delete(medicines)
      .where(and(eq(medicines.id, id), eq(medicines.userId, userId)))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete medicine:", error)
    return NextResponse.json(
      { error: "Failed to delete medicine" },
      { status: 500 }
    )
  }
}
