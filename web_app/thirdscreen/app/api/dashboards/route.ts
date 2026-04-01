export const runtime = "edge"

import { NextResponse } from "next/server"
import { getDb } from "@/lib/get-db"
import { dashboards } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { getAuthUserId } from "@/lib/auth"
import { getDefaultLayout, DASHBOARD_LIMITS } from "@/lib/grid-layout"

// GET - list all dashboards for user
export async function GET() {
  try {
    const [userId, authError] = await getAuthUserId()
    if (authError) return authError

    const rows = await getDb()
      .select()
      .from(dashboards)
      .where(eq(dashboards.userId, userId))

    if (rows.length === 0) {
      // Auto-create default dashboard
      const id = crypto.randomUUID()
      const now = new Date().toISOString()
      const defaultLayout = getDefaultLayout()
      await getDb().insert(dashboards).values({
        id,
        userId,
        name: "Main",
        sortOrder: 0,
        isDefault: true,
        layoutLandscape: defaultLayout as unknown as string,
        layoutPortrait: defaultLayout as unknown as string,
        hiddenZones: "[]",
        createdAt: now,
        updatedAt: now,
      })
      return NextResponse.json({
        dashboards: [{
          id,
          name: "Main",
          sortOrder: 0,
          isDefault: true,
          layoutLandscape: defaultLayout,
          layoutPortrait: defaultLayout,
          hiddenZones: [],
        }],
      })
    }

    return NextResponse.json({
      dashboards: rows.map((r) => ({
        id: r.id,
        name: r.name,
        sortOrder: r.sortOrder,
        isDefault: r.isDefault,
        layoutLandscape: r.layoutLandscape ?? getDefaultLayout(),
        layoutPortrait: r.layoutPortrait ?? getDefaultLayout(),
        hiddenZones: r.hiddenZones ?? [],
      })),
    })
  } catch (error) {
    console.error("Failed to list dashboards:", error)
    return NextResponse.json({ error: "Failed to list dashboards" }, { status: 500 })
  }
}

// POST - create new dashboard
export async function POST(request: Request) {
  try {
    const [userId, authError] = await getAuthUserId()
    if (authError) return authError

    // Check limit
    const existing = await getDb()
      .select()
      .from(dashboards)
      .where(eq(dashboards.userId, userId))

    // TODO: check user plan for limit (default to free for now)
    if (existing.length >= DASHBOARD_LIMITS.free) {
      return NextResponse.json({ error: "Dashboard limit reached. Upgrade to Pro for more." }, { status: 403 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = (await request.json()) as any
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const defaultLayout = getDefaultLayout()

    await getDb().insert(dashboards).values({
      id,
      userId,
      name: body.name ?? `Dashboard ${existing.length + 1}`,
      sortOrder: existing.length,
      isDefault: false,
      layoutLandscape: defaultLayout as unknown as string,
      layoutPortrait: defaultLayout as unknown as string,
      hiddenZones: "[]",
      createdAt: now,
      updatedAt: now,
    })

    return NextResponse.json({
      id,
      name: body.name ?? `Dashboard ${existing.length + 1}`,
      sortOrder: existing.length,
      isDefault: false,
      layoutLandscape: defaultLayout,
      layoutPortrait: defaultLayout,
      hiddenZones: [],
    })
  } catch (error) {
    console.error("Failed to create dashboard:", error)
    return NextResponse.json({ error: "Failed to create dashboard" }, { status: 500 })
  }
}

// PUT - update dashboard
export async function PUT(request: Request) {
  try {
    const [userId, authError] = await getAuthUserId()
    if (authError) return authError

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = (await request.json()) as any
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 })
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date().toISOString() }
    if (updates.name !== undefined) updateData.name = updates.name
    if (updates.layoutLandscape !== undefined) updateData.layoutLandscape = updates.layoutLandscape
    if (updates.layoutPortrait !== undefined) updateData.layoutPortrait = updates.layoutPortrait
    if (updates.hiddenZones !== undefined) updateData.hiddenZones = updates.hiddenZones
    if (updates.sortOrder !== undefined) updateData.sortOrder = updates.sortOrder

    await getDb()
      .update(dashboards)
      .set(updateData)
      .where(and(eq(dashboards.id, id), eq(dashboards.userId, userId)))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to update dashboard:", error)
    return NextResponse.json({ error: "Failed to update dashboard" }, { status: 500 })
  }
}

// DELETE - delete dashboard
export async function DELETE(request: Request) {
  try {
    const [userId, authError] = await getAuthUserId()
    if (authError) return authError

    const url = new URL(request.url)
    const id = url.searchParams.get("id")
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 })
    }

    // Don't allow deleting the last dashboard
    const existing = await getDb()
      .select()
      .from(dashboards)
      .where(eq(dashboards.userId, userId))

    if (existing.length <= 1) {
      return NextResponse.json({ error: "Cannot delete the last dashboard" }, { status: 400 })
    }

    await getDb()
      .delete(dashboards)
      .where(and(eq(dashboards.id, id), eq(dashboards.userId, userId)))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete dashboard:", error)
    return NextResponse.json({ error: "Failed to delete dashboard" }, { status: 500 })
  }
}
