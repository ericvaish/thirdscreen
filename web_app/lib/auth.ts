import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { getRequestContext } from "@cloudflare/next-on-pages"
import { getDb } from "@/lib/get-db"
import { cards } from "@/db/schema"
import { eq, and } from "drizzle-orm"

/**
 * Get the current user ID from Clerk.
 * Returns "" for unauthenticated requests (single-user/self-hosted mode).
 * In multi-tenant hosted mode (STORAGE=d1), use requireAuth() instead.
 */
export async function getUserId(): Promise<string> {
  try {
    const { userId } = await auth()
    return userId ?? ""
  } catch {
    return ""
  }
}

/**
 * Require authentication for an API route.
 * Returns the userId if authenticated, or a 401 NextResponse if not.
 * Usage:
 *   const [userId, errorResponse] = await requireAuth()
 *   if (errorResponse) return errorResponse
 */
export async function requireAuth(): Promise<
  [string, null] | [null, NextResponse]
> {
  try {
    const { userId } = await auth()
    if (!userId) {
      return [null, NextResponse.json({ error: "Unauthorized" }, { status: 401 })]
    }
    return [userId, null]
  } catch {
    return [null, NextResponse.json({ error: "Unauthorized" }, { status: 401 })]
  }
}

/**
 * Get user ID with enforcement based on storage mode.
 * - In D1/server mode: requires auth (returns 401 if not signed in)
 * - In SQLite mode: allows anonymous (returns "")
 */
export async function getAuthUserId(): Promise<
  [string, null] | [null, NextResponse]
> {
  let storage = process.env.STORAGE
  try {
    const { env } = getRequestContext()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    storage = (env as any).STORAGE ?? storage
  } catch {}
  const isMultiTenant = storage === "d1"

  if (isMultiTenant) {
    return requireAuth()
  }

  // Self-hosted: anonymous is fine
  const userId = await getUserId()
  return [userId, null]
}

/**
 * Verify that a cardId belongs to the given userId.
 * Returns true if the card exists and belongs to the user, false otherwise.
 */
export async function verifyCardOwnership(
  cardId: string,
  userId: string
): Promise<boolean> {
  const result = await getDb()
    .select({ id: cards.id })
    .from(cards)
    .where(and(eq(cards.id, cardId), eq(cards.userId, userId)))
  return result.length > 0
}
