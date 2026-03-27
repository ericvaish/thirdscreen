export const runtime = "edge"

import { NextResponse } from "next/server"
import { getValidToken } from "@/lib/spotify/service"
import { getAuthUserId } from "@/lib/auth"

// GET /api/spotify/token - returns current access token for Web Playback SDK
export async function GET() {
  try {
    const [userId, authError] = await getAuthUserId()
    if (authError) return authError
    const token = await getValidToken(userId)
    if (!token) {
      return NextResponse.json({ token: null }, { status: 401 })
    }
    return NextResponse.json({ token })
  } catch {
    return NextResponse.json({ token: null }, { status: 500 })
  }
}
