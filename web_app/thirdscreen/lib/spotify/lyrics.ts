import { getDb } from "@/lib/get-db"
import { lyricsCache } from "@/db/schema"
import { eq } from "drizzle-orm"

const LRCLIB_API = "https://lrclib.net/api/get"
const USER_AGENT = "ThirdScreen/1.0 (https://github.com)"
const MAX_CACHE_SIZE = 200

// ── Types ───────────────────────────────────────────────────────────────────

export interface LyricsLine {
  startMs: number
  text: string
}

export interface LyricsResult {
  instrumental: boolean
  synced: LyricsLine[] | null // parsed time-synced lines
  plain: string | null // plain text fallback
  cached: boolean
}

// ── Cache key ───────────────────────────────────────────────────────────────

async function hashKey(track: string, artist: string, album: string): Promise<string> {
  const input = `${track}|${artist}|${album}`.toLowerCase()
  const data = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest("SHA-256", data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 40)
}

// ── LRC parser ──────────────────────────────────────────────────────────────

const LRC_REGEX = /\[(\d+):(\d+)\.(\d+)\]\s*(.*)/

export function parseLRC(lrc: string): LyricsLine[] {
  const lines: LyricsLine[] = []

  for (const rawLine of lrc.split("\n")) {
    const match = rawLine.match(LRC_REGEX)
    if (!match) continue

    const minutes = parseInt(match[1], 10)
    const seconds = parseInt(match[2], 10)
    const centiseconds = parseInt(match[3], 10)
    const text = match[4].trim()

    const startMs = minutes * 60000 + seconds * 1000 + centiseconds * 10

    lines.push({ startMs, text })
  }

  return lines.sort((a, b) => a.startMs - b.startMs)
}

// ── Evict old cache entries ─────────────────────────────────────────────────

async function evictIfNeeded(): Promise<void> {
  const all = await getDb()
    .select({ id: lyricsCache.id, fetchedAt: lyricsCache.fetchedAt })
    .from(lyricsCache)

  if (all.length <= MAX_CACHE_SIZE) return

  // Sort by fetchedAt ascending (oldest first)
  all.sort((a, b) => (a.fetchedAt < b.fetchedAt ? -1 : 1))

  const toRemove = all.slice(0, all.length - MAX_CACHE_SIZE)
  for (const entry of toRemove) {
    await getDb().delete(lyricsCache).where(eq(lyricsCache.id, entry.id))
  }
}

// ── Main fetch function ─────────────────────────────────────────────────────

export async function getLyrics(
  track: string,
  artist: string,
  album: string,
  durationMs?: number
): Promise<LyricsResult> {
  const id = await hashKey(track, artist, album)

  // 1. Check cache
  const [cached] = await getDb().select().from(lyricsCache).where(eq(lyricsCache.id, id))

  if (cached) {
    return {
      instrumental: cached.instrumental,
      synced: cached.syncedLyrics ? parseLRC(cached.syncedLyrics) : null,
      plain: cached.plainLyrics,
      cached: true,
    }
  }

  // 2. Fetch from LRCLib
  try {
    const params = new URLSearchParams({
      track_name: track,
      artist_name: artist,
      album_name: album,
    })
    if (durationMs) {
      params.set("duration", String(Math.round(durationMs / 1000)))
    }

    const res = await fetch(`${LRCLIB_API}?${params}`, {
      headers: { "User-Agent": USER_AGENT },
    })

    if (!res.ok) {
      // Not found or error - cache as empty to avoid re-fetching
      await getDb().insert(lyricsCache).values({
        id,
        track,
        artist,
        album,
        instrumental: false,
        syncedLyrics: null,
        plainLyrics: null,
      }).onConflictDoNothing()

      return { instrumental: false, synced: null, plain: null, cached: false }
    }

    const data = await res.json()

    const result: LyricsResult = {
      instrumental: data.instrumental ?? false,
      synced: data.syncedLyrics ? parseLRC(data.syncedLyrics) : null,
      plain: data.plainLyrics ?? null,
      cached: false,
    }

    // 3. Store in cache
    await getDb().insert(lyricsCache).values({
      id,
      track,
      artist,
      album,
      instrumental: result.instrumental,
      syncedLyrics: data.syncedLyrics ?? null,
      plainLyrics: data.plainLyrics ?? null,
    }).onConflictDoNothing()

    await evictIfNeeded()

    return result
  } catch {
    return { instrumental: false, synced: null, plain: null, cached: false }
  }
}

// ── Force refetch (bypasses cache) ──────────────────────────────────────────

export async function refetchLyrics(
  track: string,
  artist: string,
  album: string,
  durationMs?: number
): Promise<LyricsResult> {
  const id = await hashKey(track, artist, album)

  // Delete cached entry
  await getDb().delete(lyricsCache).where(eq(lyricsCache.id, id))

  // Re-fetch
  return getLyrics(track, artist, album, durationMs)
}
