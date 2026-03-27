import { NextResponse } from "next/server"
import { getDb } from "@/lib/get-db"
import { medicineDoseLogs } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { v4 as uuidv4 } from "uuid"
import { getAuthUserId } from "@/lib/auth"

// GET doses by medicineId and date
export async function GET(request: Request) {
  try {
    const [userId, authError] = await getAuthUserId()
    if (authError) return authError
    const { searchParams } = new URL(request.url)
    const medicineId = searchParams.get("medicineId")
    const date = searchParams.get("date")

    if (!medicineId || !date) {
      return NextResponse.json(
        { error: "medicineId and date are required" },
        { status: 400 }
      )
    }

    const items = await getDb()
      .select()
      .from(medicineDoseLogs)
      .where(
        and(
          eq(medicineDoseLogs.medicineId, medicineId),
          eq(medicineDoseLogs.date, date),
          eq(medicineDoseLogs.userId, userId)
        )
      )
    return NextResponse.json(items)
  } catch (error) {
    console.error("Failed to fetch doses:", error)
    return NextResponse.json(
      { error: "Failed to fetch doses" },
      { status: 500 }
    )
  }
}

// POST toggle dose (create if not exists, delete if exists)
export async function POST(request: Request) {
  try {
    const [userId, authError] = await getAuthUserId()
    if (authError) return authError
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: any = await request.json()
    const { medicineId, timeId, date } = body

    if (!medicineId || !timeId || !date) {
      return NextResponse.json(
        { error: "medicineId, timeId, and date are required" },
        { status: 400 }
      )
    }

    // Check if dose already exists
    const existing = await getDb()
      .select()
      .from(medicineDoseLogs)
      .where(
        and(
          eq(medicineDoseLogs.medicineId, medicineId),
          eq(medicineDoseLogs.timeId, timeId),
          eq(medicineDoseLogs.date, date),
          eq(medicineDoseLogs.userId, userId)
        )
      )

    if (existing.length > 0) {
      // Delete existing dose (toggle off)
      await getDb()
        .delete(medicineDoseLogs)
        .where(
          and(
            eq(medicineDoseLogs.id, existing[0].id),
            eq(medicineDoseLogs.userId, userId)
          )
        )
      return NextResponse.json({ toggled: "off", id: existing[0].id })
    } else {
      // Create new dose (toggle on)
      const id = uuidv4()
      await getDb().insert(medicineDoseLogs).values({
        id,
        userId,
        medicineId,
        timeId,
        takenAt: new Date().toISOString(),
        date,
      })
      const [created] = await getDb()
        .select()
        .from(medicineDoseLogs)
        .where(eq(medicineDoseLogs.id, id))
      return NextResponse.json({ toggled: "on", dose: created }, { status: 201 })
    }
  } catch (error) {
    console.error("Failed to toggle dose:", error)
    return NextResponse.json(
      { error: "Failed to toggle dose" },
      { status: 500 }
    )
  }
}
