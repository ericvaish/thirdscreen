import { NextResponse } from "next/server"
import { getDb } from "@/lib/get-db"
import { links } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { v4 as uuidv4 } from "uuid"
import { getAuthUserId } from "@/lib/auth"

// GET links by cardId
export async function GET(request: Request) {
  try {
    const [userId, authError] = await getAuthUserId()
    if (authError) return authError
    const { searchParams } = new URL(request.url)
    const cardId = searchParams.get("cardId")

    const items = cardId
      ? await getDb()
          .select()
          .from(links)
          .where(and(eq(links.cardId, cardId), eq(links.userId, userId)))
      : await getDb().select().from(links).where(eq(links.userId, userId))
    return NextResponse.json(items)
  } catch (error) {
    console.error("Failed to fetch links:", error)
    return NextResponse.json(
      { error: "Failed to fetch links" },
      { status: 500 }
    )
  }
}

// POST create link
export async function POST(request: Request) {
  try {
    const [userId, authError] = await getAuthUserId()
    if (authError) return authError
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: any = await request.json()
    const id = uuidv4()

    await getDb().insert(links).values({
      id,
      userId,
      cardId: body.cardId,
      url: body.url,
      title: body.title ?? null,
      pinned: body.pinned ?? false,
    })

    const [created] = await getDb().select().from(links).where(eq(links.id, id))
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    console.error("Failed to create link:", error)
    return NextResponse.json(
      { error: "Failed to create link" },
      { status: 500 }
    )
  }
}

// DELETE link
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
      .delete(links)
      .where(and(eq(links.id, id), eq(links.userId, userId)))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete link:", error)
    return NextResponse.json(
      { error: "Failed to delete link" },
      { status: 500 }
    )
  }
}
