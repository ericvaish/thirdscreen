export const runtime = "edge"

import { NextResponse } from "next/server"
import {
  getCurrentPlayback,
  playbackControl,
  transferPlayback,
  getTokens,
  clearTokens,
} from "@/lib/spotify/service"
import { getAuthUserId } from "@/lib/auth"

// GET /api/spotify - get current playback state + connection status
export async function GET() {
  try {
    const [userId, authError] = await getAuthUserId()
    if (authError) return authError
    const { accessToken, clientId } = await getTokens(userId)

    if (!clientId) {
      return NextResponse.json({ connected: false, needsClientId: true })
    }
    if (!accessToken) {
      return NextResponse.json({ connected: false, needsClientId: false, clientId })
    }

    const playback = await getCurrentPlayback(userId)
    return NextResponse.json({
      connected: true,
      playback, // null if no active device
    })
  } catch (error) {
    console.error("Spotify GET error:", error)
    return NextResponse.json({ connected: false, error: "Failed to fetch" }, { status: 500 })
  }
}

// POST /api/spotify - playback control (play, pause, next, previous)
export async function POST(request: Request) {
  try {
    const [userId, authError] = await getAuthUserId()
    if (authError) return authError
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: any = await request.json()
    const { action } = body

    // Transfer playback to a device
    if (action === "transfer") {
      const { deviceId, play } = body
      if (!deviceId) {
        return NextResponse.json({ error: "deviceId required" }, { status: 400 })
      }
      const ok = await transferPlayback(deviceId, play ?? false, userId)
      return NextResponse.json({ success: ok })
    }

    if (!["play", "pause", "next", "previous"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    const ok = await playbackControl(action, userId)
    return NextResponse.json({ success: ok })
  } catch (error) {
    console.error("Spotify POST error:", error)
    return NextResponse.json({ error: "Playback control failed" }, { status: 500 })
  }
}

// DELETE /api/spotify - disconnect (clear tokens)
export async function DELETE() {
  try {
    const [userId, authError] = await getAuthUserId()
    if (authError) return authError
    await clearTokens(userId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Spotify DELETE error:", error)
    return NextResponse.json({ error: "Failed to disconnect" }, { status: 500 })
  }
}
