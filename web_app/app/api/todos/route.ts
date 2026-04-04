export const runtime = "edge"

import { NextResponse } from "next/server"
import { getDb } from "@/lib/get-db"
import { todos } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { v4 as uuidv4 } from "uuid"
import { getAuthUserId, verifyCardOwnership } from "@/lib/auth"

// GET todos by cardId
export async function GET(request: Request) {
  try {
    const [userId, authError] = await getAuthUserId()
    if (authError) return authError
    const { searchParams } = new URL(request.url)
    const cardId = searchParams.get("cardId")

    const items = cardId
      ? await getDb()
          .select()
          .from(todos)
          .where(and(eq(todos.cardId, cardId), eq(todos.userId, userId)))
      : await getDb().select().from(todos).where(eq(todos.userId, userId))
    return NextResponse.json(items)
  } catch (error) {
    console.error("Failed to fetch todos:", error)
    return NextResponse.json(
      { error: "Failed to fetch todos" },
      { status: 500 }
    )
  }
}

// POST create todo
export async function POST(request: Request) {
  try {
    const [userId, authError] = await getAuthUserId()
    if (authError) return authError
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: any = await request.json()

    if (!body.cardId || !body.title || typeof body.title !== "string") {
      return NextResponse.json({ error: "cardId and title are required" }, { status: 400 })
    }

    if (!(await verifyCardOwnership(body.cardId, userId))) {
      return NextResponse.json({ error: "Card not found" }, { status: 403 })
    }

    const id = uuidv4()

    await getDb().insert(todos).values({
      id,
      userId,
      cardId: body.cardId,
      title: body.title,
      completed: body.completed ?? false,
      scheduledDate: body.scheduledDate ?? null,
      scheduledTime: body.scheduledTime ?? null,
      duration: body.duration ?? null,
      sortOrder: body.sortOrder ?? 0,
    })

    const [created] = await getDb().select().from(todos).where(eq(todos.id, id))
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    console.error("Failed to create todo:", error)
    return NextResponse.json(
      { error: "Failed to create todo" },
      { status: 500 }
    )
  }
}

// PUT update todo
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

    // Whitelist allowed fields to prevent mass-assignment
    const updates: Record<string, unknown> = {}
    if (body.title !== undefined) updates.title = body.title
    if (body.completed !== undefined) updates.completed = body.completed
    if (body.scheduledDate !== undefined) updates.scheduledDate = body.scheduledDate
    if (body.scheduledTime !== undefined) updates.scheduledTime = body.scheduledTime
    if (body.duration !== undefined) updates.duration = body.duration
    if (body.sortOrder !== undefined) updates.sortOrder = body.sortOrder

    await getDb()
      .update(todos)
      .set(updates)
      .where(and(eq(todos.id, id), eq(todos.userId, userId)))

    const [updated] = await getDb()
      .select()
      .from(todos)
      .where(and(eq(todos.id, id), eq(todos.userId, userId)))
    return NextResponse.json(updated)
  } catch (error) {
    console.error("Failed to update todo:", error)
    return NextResponse.json(
      { error: "Failed to update todo" },
      { status: 500 }
    )
  }
}

// DELETE todo
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
      .delete(todos)
      .where(and(eq(todos.id, id), eq(todos.userId, userId)))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete todo:", error)
    return NextResponse.json(
      { error: "Failed to delete todo" },
      { status: 500 }
    )
  }
}
