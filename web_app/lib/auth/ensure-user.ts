import { getDb } from "@/lib/get-db"
import { users } from "@/db/schema"
import { eq } from "drizzle-orm"
import type { SessionPayload } from "./session"

// Don't rewrite last_login_at on every page load; an hour is plenty of
// resolution for "when did this person last sign in".
const LOGIN_TOUCH_INTERVAL_MS = 60 * 60 * 1000

/**
 * Make sure the signed-in Auth0 user has a row in `users`.
 *
 * The old hand-rolled Google callback did this inline; with Auth0 the callback
 * runs in edge middleware where the libsql client can't run, so the upsert
 * happens on the first authenticated request instead.
 */
export async function ensureUser(session: SessionPayload): Promise<void> {
  const now = Date.now()
  const db = getDb()

  const existing = await db
    .select({ id: users.id, lastLoginAt: users.lastLoginAt })
    .from(users)
    .where(eq(users.id, session.sub))
    .limit(1)

  if (existing.length === 0) {
    await db.insert(users).values({
      id: session.sub,
      email: session.email,
      name: session.name ?? null,
      avatarUrl: session.picture ?? null,
      createdAt: now,
      lastLoginAt: now,
    })
    return
  }

  if (now - existing[0].lastLoginAt < LOGIN_TOUCH_INTERVAL_MS) return

  await db
    .update(users)
    .set({
      email: session.email,
      name: session.name ?? null,
      avatarUrl: session.picture ?? null,
      lastLoginAt: now,
    })
    .where(eq(users.id, session.sub))
}
