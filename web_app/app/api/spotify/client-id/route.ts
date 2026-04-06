
import { NextResponse } from "next/server"
import { getAdminConfig, ADMIN_KEYS } from "@/lib/admin-config"

// GET /api/spotify/client-id - public endpoint, no auth required
// Returns the platform's Spotify Client ID so anonymous users can start OAuth
export async function GET() {
  const clientId = getAdminConfig(ADMIN_KEYS.spotifyClientId)
  return NextResponse.json({ clientId })
}
