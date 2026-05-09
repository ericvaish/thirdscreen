import { NextResponse } from "next/server"
import { getDb } from "@/lib/get-db"
import { cards } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { readSession } from "@/lib/auth/session"

/**
 * Get the current user ID from the session cookie.
 * Returns "" for unauthenticated requests (single-user/self-hosted mode).
 * In multi-tenant hosted mode (STORAGE=turso), use requireAuth() instead.
 */
export async function getUserId(): Promise<string> {
  const session = await readSession()
  return session?.sub ?? ""
}

/**
 * Require authentication for an API route.
 * Returns the userId if authenticated, or a 401 NextResponse if not.
 */
export async function requireAuth(): Promise<
  [string, null] | [null, NextResponse]
> {
  const session = await readSession()
  if (!session?.sub) {
    return [null, NextResponse.json({ error: "Unauthorized" }, { status: 401 })]
  }
  return [session.sub, null]
}

/**
 * Get user ID with enforcement based on storage mode.
 * - In turso/server mode: requires auth (returns 401 if not signed in)
 * - In local mode: allows anonymous (returns "")
 */
export async function getAuthUserId(): Promise<
  [string, null] | [null, NextResponse]
> {
  const storage = process.env.STORAGE
  const isMultiTenant = storage === "turso"

  if (isMultiTenant) {
    return requireAuth()
  }

  // Self-hosted: anonymous is fine
  const userId = await getUserId()
  return [userId, null]
}

/**
 * Verify that a cardId belongs to the given userId.
 */
export async function verifyCardOwnership(
  cardId: string,
  userId: string,
): Promise<boolean> {
  const result = await getDb()
    .select({ id: cards.id })
    .from(cards)
    .where(and(eq(cards.id, cardId), eq(cards.userId, userId)))
  return result.length > 0
}
