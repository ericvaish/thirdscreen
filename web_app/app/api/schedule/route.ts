export const runtime = "edge"

import { NextResponse } from "next/server"
import { getDb } from "@/lib/get-db"
import { scheduleEvents } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { v4 as uuidv4 } from "uuid"
import { getAuthUserId, verifyCardOwnership } from "@/lib/auth"

// GET events by cardId and date
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
          .from(scheduleEvents)
          .where(
            and(
              eq(scheduleEvents.cardId, cardId),
              eq(scheduleEvents.date, date),
              eq(scheduleEvents.userId, userId)
            )
          )
      : await getDb()
          .select()
          .from(scheduleEvents)
          .where(
            and(eq(scheduleEvents.date, date), eq(scheduleEvents.userId, userId))
          )
    return NextResponse.json(items)
  } catch (error) {
    console.error("Failed to fetch schedule events:", error)
    return NextResponse.json(
      { error: "Failed to fetch schedule events" },
      { status: 500 }
    )
  }
}

// POST create event
export async function POST(request: Request) {
  try {
    const [userId, authError] = await getAuthUserId()
    if (authError) return authError
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: any = await request.json()

    if (!body.cardId || !body.title || !body.startTime || !body.endTime || !body.date) {
      return NextResponse.json(
        { error: "cardId, title, startTime, endTime, and date are required" },
        { status: 400 }
      )
    }

    if (!(await verifyCardOwnership(body.cardId, userId))) {
      return NextResponse.json({ error: "Card not found" }, { status: 403 })
    }

    const id = uuidv4()

    await getDb().insert(scheduleEvents).values({
      id,
      userId,
      cardId: body.cardId,
      title: body.title,
      startTime: body.startTime,
      endTime: body.endTime,
      allDay: body.allDay ?? false,
      color: body.color ?? "#3b82f6",
      location: body.location ?? null,
      description: body.description ?? null,
      date: body.date,
    })

    const [created] = await getDb()
      .select()
      .from(scheduleEvents)
      .where(eq(scheduleEvents.id, id))
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    console.error("Failed to create schedule event:", error)
    return NextResponse.json(
      { error: "Failed to create schedule event" },
      { status: 500 }
    )
  }
}

// PUT update event
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
    if (body.title !== undefined) updates.title = body.title
    if (body.startTime !== undefined) updates.startTime = body.startTime
    if (body.endTime !== undefined) updates.endTime = body.endTime
    if (body.allDay !== undefined) updates.allDay = body.allDay
    if (body.color !== undefined) updates.color = body.color
    if (body.location !== undefined) updates.location = body.location
    if (body.description !== undefined) updates.description = body.description
    if (body.date !== undefined) updates.date = body.date

    await getDb()
      .update(scheduleEvents)
      .set(updates)
      .where(and(eq(scheduleEvents.id, id), eq(scheduleEvents.userId, userId)))

    const [updated] = await getDb()
      .select()
      .from(scheduleEvents)
      .where(and(eq(scheduleEvents.id, id), eq(scheduleEvents.userId, userId)))
    return NextResponse.json(updated)
  } catch (error) {
    console.error("Failed to update schedule event:", error)
    return NextResponse.json(
      { error: "Failed to update schedule event" },
      { status: 500 }
    )
  }
}

// DELETE event
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
      .delete(scheduleEvents)
      .where(and(eq(scheduleEvents.id, id), eq(scheduleEvents.userId, userId)))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete schedule event:", error)
    return NextResponse.json(
      { error: "Failed to delete schedule event" },
      { status: 500 }
    )
  }
}
