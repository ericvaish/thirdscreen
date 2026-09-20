import { auth0 } from "@/lib/auth0"

export interface SessionPayload {
  sub: string // app user id (the Google account id, see toUserId)
  email: string
  name?: string | null
  picture?: string | null
}

const GOOGLE_PREFIX = "google-oauth2|"

/**
 * Map an Auth0 `sub` to the app's user id.
 *
 * Before Auth0 the app signed users in with Google directly and stored the
 * raw Google `sub` as the user id — every row in the database is keyed on it.
 * Auth0 returns the same value prefixed with the connection name
 * ("google-oauth2|1234…"), so stripping the prefix keeps existing accounts and
 * their data attached to the same user.
 */
export function toUserId(sub: string): string {
  return sub.startsWith(GOOGLE_PREFIX)
    ? sub.slice(GOOGLE_PREFIX.length)
    : sub
}

export async function readSession(): Promise<SessionPayload | null> {
  try {
    const session = await auth0.getSession()
    const user = session?.user
    if (!user?.sub) return null
    return {
      sub: toUserId(user.sub),
      email: user.email ?? "",
      name: user.name ?? null,
      picture: user.picture ?? null,
    }
  } catch {
    return null
  }
}
