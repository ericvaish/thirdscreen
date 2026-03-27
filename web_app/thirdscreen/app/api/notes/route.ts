import { NextResponse } from "next/server"
import { getDb } from "@/lib/get-db"
import { notes } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { v4 as uuidv4 } from "uuid"
import { getAuthUserId } from "@/lib/auth"

// GET notes by cardId
export async function GET(request: Request) {
  try {
    const [userId, authError] = await getAuthUserId()
    if (authError) return authError
    const { searchParams } = new URL(request.url)
    const cardId = searchParams.get("cardId")

    const items = cardId
      ? await getDb()
          .select()
          .from(notes)
          .where(and(eq(notes.cardId, cardId), eq(notes.userId, userId)))
      : await getDb().select().from(notes).where(eq(notes.userId, userId))
    return NextResponse.json(items)
  } catch (error) {
    console.error("Failed to fetch notes:", error)
    return NextResponse.json(
      { error: "Failed to fetch notes" },
      { status: 500 }
    )
  }
}

// POST create note
export async function POST(request: Request) {
  try {
    const [userId, authError] = await getAuthUserId()
    if (authError) return authError
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: any = await request.json()
    const id = uuidv4()

    await getDb().insert(notes).values({
      id,
      userId,
      cardId: body.cardId,
      content: body.content ?? "",
      pinned: body.pinned ?? false,
      sortOrder: body.sortOrder ?? 0,
    })

    const [created] = await getDb().select().from(notes).where(eq(notes.id, id))
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    console.error("Failed to create note:", error)
    return NextResponse.json(
      { error: "Failed to create note" },
      { status: 500 }
    )
  }
}

// PUT update note
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

    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() }
    if (body.content !== undefined) updates.content = body.content
    if (body.pinned !== undefined) updates.pinned = body.pinned
    if (body.sortOrder !== undefined) updates.sortOrder = body.sortOrder

    await getDb()
      .update(notes)
      .set(updates)
      .where(and(eq(notes.id, id), eq(notes.userId, userId)))

    const [updated] = await getDb()
      .select()
      .from(notes)
      .where(and(eq(notes.id, id), eq(notes.userId, userId)))
    return NextResponse.json(updated)
  } catch (error) {
    console.error("Failed to update note:", error)
    return NextResponse.json(
      { error: "Failed to update note" },
      { status: 500 }
    )
  }
}

// DELETE note
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
      .delete(notes)
      .where(and(eq(notes.id, id), eq(notes.userId, userId)))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete note:", error)
    return NextResponse.json(
      { error: "Failed to delete note" },
      { status: 500 }
    )
  }
}
