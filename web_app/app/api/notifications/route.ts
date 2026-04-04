export const runtime = "edge"

import { NextResponse } from "next/server"
import { getDb } from "@/lib/get-db"
import { notifications } from "@/db/schema"
import { eq, and, desc } from "drizzle-orm"
import { v4 as uuidv4 } from "uuid"
import { getAuthUserId } from "@/lib/auth"

// GET notifications
export async function GET(request: Request) {
  try {
    const [userId, authError] = await getAuthUserId()
    if (authError) return authError
    const { searchParams } = new URL(request.url)
    const unreadOnly = searchParams.get("unreadOnly") === "1"
    const limit = parseInt(searchParams.get("limit") ?? "50", 10)

    const db = getDb()
    const conditions = [eq(notifications.userId, userId)]
    if (unreadOnly) {
      conditions.push(eq(notifications.read, false))
    }

    const items = await db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(limit)

    return NextResponse.json(items)
  } catch (error) {
    console.error("Failed to fetch notifications:", error)
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 })
  }
}

// POST create notification
export async function POST(request: Request) {
  try {
    const [userId, authError] = await getAuthUserId()
    if (authError) return authError
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: any = await request.json()

    if (!body.type || !body.title) {
      return NextResponse.json({ error: "type and title are required" }, { status: 400 })
    }

    const id = body.id || uuidv4()
    const item = {
      id,
      userId,
      type: body.type as string,
      title: body.title as string,
      body: (body.body as string) || null,
      read: false,
      meta: body.meta || null,
      createdAt: new Date().toISOString(),
    }

    await getDb().insert(notifications).values(item)
    return NextResponse.json(item, { status: 201 })
  } catch (error) {
    console.error("Failed to create notification:", error)
    return NextResponse.json({ error: "Failed to create notification" }, { status: 500 })
  }
}

// PUT update notification (mark read or mark all read)
export async function PUT(request: Request) {
  try {
    const [userId, authError] = await getAuthUserId()
    if (authError) return authError
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: any = await request.json()

    if (body.markAllRead) {
      await getDb()
        .update(notifications)
        .set({ read: true })
        .where(eq(notifications.userId, userId))
      return NextResponse.json({ success: true })
    }

    if (!body.id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }

    await getDb()
      .update(notifications)
      .set({ read: body.read ?? true })
      .where(and(eq(notifications.id, body.id), eq(notifications.userId, userId)))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to update notification:", error)
    return NextResponse.json({ error: "Failed to update notification" }, { status: 500 })
  }
}
