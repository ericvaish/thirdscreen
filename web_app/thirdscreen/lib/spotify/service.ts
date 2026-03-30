import { getDb } from "@/lib/get-db"
import { settings } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { SPOTIFY_TOKEN_URL, SPOTIFY_API_BASE, SETTINGS_KEYS } from "./constants"
import { getAdminConfig, ADMIN_KEYS } from "@/lib/admin-config"

// ── DB helpers ──────────────────────────────────────────────────────────────

async function getSetting(key: string, userId: string): Promise<unknown> {
  const [row] = await getDb()
    .select()
    .from(settings)
    .where(and(eq(settings.key, key), eq(settings.userId, userId)))
  return row?.value ?? null
}

async function setSetting(key: string, value: unknown, userId: string): Promise<void> {
  const existing = await getDb()
    .select()
    .from(settings)
    .where(and(eq(settings.key, key), eq(settings.userId, userId)))
  if (existing.length > 0) {
    await getDb()
      .update(settings)
      .set({ value })
      .where(and(eq(settings.key, key), eq(settings.userId, userId)))
  } else {
    await getDb().insert(settings).values({ key, userId, value })
  }
}

// ── Token management ────────────────────────────────────────────────────────

export async function getTokens(userId: string = ""): Promise<{
  accessToken: string | null
  refreshToken: string | null
  expiry: number | null
  clientId: string | null
}> {
  const [accessToken, refreshToken, expiry, userClientId] = await Promise.all([
    getSetting(SETTINGS_KEYS.accessToken, userId) as Promise<string | null>,
    getSetting(SETTINGS_KEYS.refreshToken, userId) as Promise<string | null>,
    getSetting(SETTINGS_KEYS.tokenExpiry, userId) as Promise<number | null>,
    getSetting(SETTINGS_KEYS.clientId, userId) as Promise<string | null>,
  ])
  // Env var takes priority, fallback to user-provided (self-hosted)
  const clientId = getAdminConfig(ADMIN_KEYS.spotifyClientId) || userClientId
  return { accessToken, refreshToken, expiry, clientId }
}

export async function saveTokens(data: {
  access_token: string
  refresh_token?: string
  expires_in: number
}, userId: string = ""): Promise<void> {
  const expiry = Date.now() + data.expires_in * 1000
  await Promise.all([
    setSetting(SETTINGS_KEYS.accessToken, data.access_token, userId),
    setSetting(SETTINGS_KEYS.tokenExpiry, expiry, userId),
    ...(data.refresh_token
      ? [setSetting(SETTINGS_KEYS.refreshToken, data.refresh_token, userId)]
      : []),
  ])
}

export async function clearTokens(userId: string = ""): Promise<void> {
  await Promise.all([
    setSetting(SETTINGS_KEYS.accessToken, null, userId),
    setSetting(SETTINGS_KEYS.refreshToken, null, userId),
    setSetting(SETTINGS_KEYS.tokenExpiry, null, userId),
  ])
}

// ── Token exchange & refresh ────────────────────────────────────────────────

export async function exchangeCode(
  code: string,
  codeVerifier: string,
  redirectUri: string,
  userId: string = ""
): Promise<boolean> {
  const clientId = (await getSetting(SETTINGS_KEYS.clientId, userId)) as string | null
  if (!clientId) return false

  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      code_verifier: codeVerifier,
    }),
  })

  if (!res.ok) return false
  const data = await res.json()
  await saveTokens(data, userId)
  return true
}

async function refreshAccessToken(userId: string = ""): Promise<string | null> {
  const { refreshToken, clientId } = await getTokens(userId)
  if (!refreshToken || !clientId) return null

  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
    }),
  })

  if (!res.ok) {
    // Refresh token revoked, clear everything
    await clearTokens(userId)
    return null
  }

  const data = await res.json()
  await saveTokens(data, userId)
  return data.access_token
}

/** Get a valid access token, refreshing if expired */
export async function getValidToken(userId: string = ""): Promise<string | null> {
  const { accessToken, expiry } = await getTokens(userId)
  if (!accessToken) return null

  // Refresh 60s before expiry
  if (expiry && Date.now() > expiry - 60_000) {
    return refreshAccessToken(userId)
  }

  return accessToken
}

// ── Spotify API calls ───────────────────────────────────────────────────────

async function spotifyFetch(
  endpoint: string,
  userId: string = "",
  options?: RequestInit
): Promise<Response | null> {
  const token = await getValidToken(userId)
  if (!token) return null

  const res = await fetch(`${SPOTIFY_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  })

  // Token might have been revoked between refresh check and use
  if (res.status === 401) {
    const newToken = await refreshAccessToken(userId)
    if (!newToken) return null
    return fetch(`${SPOTIFY_API_BASE}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${newToken}`,
        ...options?.headers,
      },
    })
  }

  return res
}

export interface SpotifyPlaybackState {
  isPlaying: boolean
  title: string
  artist: string
  album: string
  albumArt: string | null
  progressMs: number
  durationMs: number
  trackId: string | null
  shuffleState: boolean
  repeatState: "off" | "track" | "context"
  volumePercent: number | null
}

export async function getCurrentPlayback(userId: string = ""): Promise<SpotifyPlaybackState | null> {
  const res = await spotifyFetch("/me/player", userId)
  if (!res || res.status === 204) return null // 204 = no active device
  if (!res.ok) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await res.json()) as any
  if (!data.item) return null

  const track = data.item
  return {
    isPlaying: data.is_playing,
    title: track.name,
    artist: track.artists?.map((a: { name: string }) => a.name).join(", ") ?? "Unknown",
    album: track.album?.name ?? "",
    albumArt: track.album?.images?.[0]?.url ?? null,
    progressMs: data.progress_ms ?? 0,
    durationMs: track.duration_ms ?? 0,
    trackId: track.id ?? null,
    shuffleState: data.shuffle_state ?? false,
    repeatState: data.repeat_state ?? "off",
    volumePercent: data.device?.volume_percent ?? null,
  }
}

export async function playbackControl(
  action: "play" | "pause" | "next" | "previous",
  userId: string = ""
): Promise<boolean> {
  let endpoint: string
  let method = "PUT"

  switch (action) {
    case "play":
      endpoint = "/me/player/play"
      break
    case "pause":
      endpoint = "/me/player/pause"
      break
    case "next":
      endpoint = "/me/player/next"
      method = "POST"
      break
    case "previous":
      endpoint = "/me/player/previous"
      method = "POST"
      break
  }

  const res = await spotifyFetch(endpoint, userId, { method })
  return res !== null && (res.ok || res.status === 204)
}

export async function seekPlayback(positionMs: number, userId: string = ""): Promise<boolean> {
  const res = await spotifyFetch(
    `/me/player/seek?position_ms=${Math.round(positionMs)}`,
    userId,
    { method: "PUT" }
  )
  return res !== null && (res.ok || res.status === 204)
}

export async function transferPlayback(deviceId: string, play = false, userId: string = ""): Promise<boolean> {
  const res = await spotifyFetch("/me/player", userId, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ device_ids: [deviceId], play }),
  })
  return res !== null && (res.ok || res.status === 204)
}

export interface SpotifyDevice {
  id: string
  name: string
  type: string
  is_active: boolean
  volume_percent: number | null
}

export async function getDevices(userId: string = ""): Promise<SpotifyDevice[]> {
  const res = await spotifyFetch("/me/player/devices", userId)
  if (!res || !res.ok) return []
  const data = (await res.json()) as { devices?: SpotifyDevice[] }
  return data.devices ?? []
}

export async function setShuffle(state: boolean, userId: string = ""): Promise<boolean> {
  const res = await spotifyFetch(`/me/player/shuffle?state=${state}`, userId, { method: "PUT" })
  return res !== null && (res.ok || res.status === 204)
}

export async function setRepeat(state: "off" | "track" | "context", userId: string = ""): Promise<boolean> {
  const res = await spotifyFetch(`/me/player/repeat?state=${state}`, userId, { method: "PUT" })
  return res !== null && (res.ok || res.status === 204)
}

export async function setVolume(volumePercent: number, userId: string = ""): Promise<boolean> {
  const clamped = Math.max(0, Math.min(100, Math.round(volumePercent)))
  const res = await spotifyFetch(`/me/player/volume?volume_percent=${clamped}`, userId, { method: "PUT" })
  return res !== null && (res.ok || res.status === 204)
}

export async function checkSavedTrack(trackId: string, userId: string = ""): Promise<boolean> {
  const res = await spotifyFetch(`/me/tracks/contains?ids=${trackId}`, userId)
  if (!res || !res.ok) return false
  const data = (await res.json()) as boolean[]
  return data[0] ?? false
}

export async function saveTrack(trackId: string, userId: string = ""): Promise<boolean> {
  const res = await spotifyFetch("/me/tracks", userId, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids: [trackId] }),
  })
  return res !== null && (res.ok || res.status === 200)
}

export async function removeTrack(trackId: string, userId: string = ""): Promise<boolean> {
  const res = await spotifyFetch("/me/tracks", userId, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids: [trackId] }),
  })
  return res !== null && (res.ok || res.status === 200)
}
