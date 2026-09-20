import { NextResponse } from "next/server"
import { readSession } from "@/lib/auth/session"
import { ensureUser } from "@/lib/auth/ensure-user"

// Who is signed in must never come from a cache — a stale copy of this
// response keeps the UI showing a user who has already signed out.
const NO_STORE = { "cache-control": "no-store, max-age=0" }

export async function GET() {
  const session = await readSession()
  if (!session) {
    return NextResponse.json({ user: null }, { headers: NO_STORE })
  }

  // Keep the users table in step with Auth0; never fail the request over it.
  try {
    await ensureUser(session)
  } catch {
    // ignore — the session is still valid without the profile row
  }

  return NextResponse.json(
    {
      user: {
        id: session.sub,
        email: session.email,
        name: session.name,
        avatarUrl: session.picture,
      },
    },
    { headers: NO_STORE },
  )
}
