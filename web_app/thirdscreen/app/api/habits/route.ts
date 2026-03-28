export const runtime = "edge"

import { NextResponse } from "next/server"
import { getDb } from "@/lib/get-db"
import { habits, habitLogs } from "@/db/schema"
import { eq, and, inArray } from "drizzle-orm"
import { v4 as uuidv4 } from "uuid"
import { getAuthUserId } from "@/lib/auth"

// GET habits + logs for a date range
export async function GET(request: Request) {
  try {
    const [userId, authError] = await getAuthUserId()
    if (authError) return authError
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    const allHabits = await getDb()
      .select()
      .from(habits)
      .where(and(eq(habits.userId, userId), eq(habits.archived, false)))

    let logs: { id: string; habitId: string; date: string; completed: boolean }[] = []
    if (startDate && endDate && allHabits.length > 0) {
      const habitIds = allHabits.map((h) => h.id)
      const allLogs = await getDb()
        .select()
        .from(habitLogs)
        .where(
          and(
            eq(habitLogs.userId, userId),
            inArray(habitLogs.habitId, habitIds),
          ),
        )
      // Filter by date range in JS (SQLite text comparison works for YYYY-MM-DD)
      logs = allLogs.filter((l) => l.date >= startDate && l.date <= endDate)
    }

    return NextResponse.json({ habits: allHabits, logs })
  } catch (error) {
    console.error("Failed to fetch habits:", error)
    return NextResponse.json({ error: "Failed to fetch habits" }, { status: 500 })
  }
}

// POST create habit or toggle log
export async function POST(request: Request) {
  try {
    const [userId, authError] = await getAuthUserId()
    if (authError) return authError
    const body = await request.json()

    if (body.action === "toggle") {
      // Toggle a habit log for a specific date
      const { habitId, date } = body
      const existing = await getDb()
        .select()
        .from(habitLogs)
        .where(
          and(
            eq(habitLogs.userId, userId),
            eq(habitLogs.habitId, habitId),
            eq(habitLogs.date, date),
          ),
        )

      if (existing.length > 0) {
        await getDb()
          .delete(habitLogs)
          .where(eq(habitLogs.id, existing[0].id))
        return NextResponse.json({ completed: false })
      } else {
        const id = uuidv4()
        await getDb().insert(habitLogs).values({
          id,
          userId,
          habitId,
          date,
          completed: true,
        })
        return NextResponse.json({ completed: true })
      }
    }

    // Create a new habit
    const id = uuidv4()
    await getDb().insert(habits).values({
      id,
      userId,
      name: body.name,
      color: body.color ?? null,
      icon: body.icon ?? null,
      sortOrder: body.sortOrder ?? 0,
    })

    const [created] = await getDb()
      .select()
      .from(habits)
      .where(eq(habits.id, id))
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    console.error("Failed to create habit:", error)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}

// DELETE a habit
export async function DELETE(request: Request) {
  try {
    const [userId, authError] = await getAuthUserId()
    if (authError) return authError
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

    await getDb()
      .delete(habits)
      .where(and(eq(habits.id, id), eq(habits.userId, userId)))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete habit:", error)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
