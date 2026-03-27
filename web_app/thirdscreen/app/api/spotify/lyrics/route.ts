import { NextResponse } from "next/server"
import { getLyrics, refetchLyrics } from "@/lib/spotify/lyrics"

// GET /api/spotify/lyrics?track=...&artist=...&album=...&duration=...
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const track = searchParams.get("track")
    const artist = searchParams.get("artist")
    const album = searchParams.get("album") ?? ""
    const duration = searchParams.get("duration")
    const force = searchParams.get("force") === "1"

    if (!track || !artist) {
      return NextResponse.json(
        { error: "track and artist are required" },
        { status: 400 }
      )
    }

    const durationMs = duration ? parseInt(duration, 10) : undefined

    const result = force
      ? await refetchLyrics(track, artist, album, durationMs)
      : await getLyrics(track, artist, album, durationMs)

    return NextResponse.json(result)
  } catch (error) {
    console.error("Lyrics error:", error)
    return NextResponse.json(
      { error: "Failed to fetch lyrics" },
      { status: 500 }
    )
  }
}
