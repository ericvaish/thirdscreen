import { NextResponse } from "next/server"
import { readSession } from "@/lib/auth/session"
import { ensureUser } from "@/lib/auth/ensure-user"

export async function GET() {
  const session = await readSession()
  if (!session) {
    return NextResponse.json({ user: null }, { status: 200 })
  }

  // Keep the users table in step with Auth0; never fail the request over it.
  try {
    await ensureUser(session)
  } catch {
    // ignore — the session is still valid without the profile row
  }

  return NextResponse.json({
    user: {
      id: session.sub,
      email: session.email,
      name: session.name,
      avatarUrl: session.picture,
    },
  })
}
