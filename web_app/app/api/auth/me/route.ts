import { NextResponse } from "next/server"
import { readSession } from "@/lib/auth/session"

export async function GET() {
  const session = await readSession()
  if (!session) {
    return NextResponse.json({ user: null }, { status: 200 })
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
