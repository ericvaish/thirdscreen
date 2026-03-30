// Client-side Spotify token management using localStorage.
// Mirrors lib/spotify/service.ts but runs entirely in the browser.
// Spotify's token endpoint and Web API both support CORS for PKCE clients.

import { SPOTIFY_TOKEN_URL, SPOTIFY_API_BASE } from "./constants"

const LS_KEYS = {
  accessToken: "ts_spotify_access_token",
  refreshToken: "ts_spotify_refresh_token",
  tokenExpiry: "ts_spotify_token_expiry",
} as const

// ── Token storage ──────────────────────────────────────────────────────────

export function getLocalSpotifyTokens(): {
  accessToken: string | null
  refreshToken: string | null
  expiry: number | null
} {
  return {
    accessToken: localStorage.getItem(LS_KEYS.accessToken),
    refreshToken: localStorage.getItem(LS_KEYS.refreshToken),
    expiry: Number(localStorage.getItem(LS_KEYS.tokenExpiry)) || null,
  }
}

export function saveLocalSpotifyTokens(data: {
  access_token: string
  refresh_token?: string
  expires_in: number
}): void {
  const expiry = Date.now() + data.expires_in * 1000
  localStorage.setItem(LS_KEYS.accessToken, data.access_token)
  localStorage.setItem(LS_KEYS.tokenExpiry, String(expiry))
  if (data.refresh_token) {
    localStorage.setItem(LS_KEYS.refreshToken, data.refresh_token)
  }
}

export function clearLocalSpotifyTokens(): void {
  localStorage.removeItem(LS_KEYS.accessToken)
  localStorage.removeItem(LS_KEYS.refreshToken)
  localStorage.removeItem(LS_KEYS.tokenExpiry)
}

// ── Token exchange (PKCE, no client secret) ────────────────────────────────

export async function exchangeCodeLocally(
  code: string,
  codeVerifier: string,
  redirectUri: string,
  clientId: string
): Promise<boolean> {
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
  saveLocalSpotifyTokens(data)
  return true
}

// ── Token refresh ──────────────────────────────────────────────────────────

async function refreshLocalToken(clientId: string): Promise<string | null> {
  const { refreshToken } = getLocalSpotifyTokens()
  if (!refreshToken) return null

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
    clearLocalSpotifyTokens()
    return null
  }

  const data = await res.json()
  saveLocalSpotifyTokens(data)
  return data.access_token
}

/** Get a valid access token, refreshing if expired */
export async function getValidLocalToken(clientId: string): Promise<string | null> {
  const { accessToken, expiry } = getLocalSpotifyTokens()
  if (!accessToken) return null

  // Refresh 60s before expiry
  if (expiry && Date.now() > expiry - 60_000) {
    return refreshLocalToken(clientId)
  }

  return accessToken
}

// ── Spotify API calls (direct CORS) ────────────────────────────────────────

async function localSpotifyFetch(
  endpoint: string,
  clientId: string,
  options?: RequestInit
): Promise<Response | null> {
  const token = await getValidLocalToken(clientId)
  if (!token) return null

  const res = await fetch(`${SPOTIFY_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  })

  if (res.status === 401) {
    const newToken = await refreshLocalToken(clientId)
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

export interface LocalPlaybackState {
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

export async function getLocalCurrentPlayback(clientId: string): Promise<LocalPlaybackState | null> {
  const res = await localSpotifyFetch("/me/player", clientId)
  if (!res || res.status === 204) return null
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

export async function localPlaybackControl(
  action: "play" | "pause" | "next" | "previous",
  clientId: string
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

  const res = await localSpotifyFetch(endpoint, clientId, { method })
  return res !== null && (res.ok || res.status === 204)
}

export async function localSeekPlayback(
  positionMs: number,
  clientId: string
): Promise<boolean> {
  const res = await localSpotifyFetch(
    `/me/player/seek?position_ms=${Math.round(positionMs)}`,
    clientId,
    { method: "PUT" }
  )
  return res !== null && (res.ok || res.status === 204)
}

export async function localTransferPlayback(
  deviceId: string,
  play = false,
  clientId: string
): Promise<boolean> {
  const res = await localSpotifyFetch("/me/player", clientId, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ device_ids: [deviceId], play }),
  })
  return res !== null && (res.ok || res.status === 204)
}

export interface LocalSpotifyDevice {
  id: string
  name: string
  type: string
  is_active: boolean
  volume_percent: number | null
}

export async function getLocalDevices(clientId: string): Promise<LocalSpotifyDevice[]> {
  const res = await localSpotifyFetch("/me/player/devices", clientId)
  if (!res || !res.ok) return []
  const data = (await res.json()) as { devices?: LocalSpotifyDevice[] }
  return data.devices ?? []
}

export async function localSetShuffle(state: boolean, clientId: string): Promise<boolean> {
  const res = await localSpotifyFetch(`/me/player/shuffle?state=${state}`, clientId, { method: "PUT" })
  return res !== null && (res.ok || res.status === 204)
}

export async function localSetRepeat(state: "off" | "track" | "context", clientId: string): Promise<boolean> {
  const res = await localSpotifyFetch(`/me/player/repeat?state=${state}`, clientId, { method: "PUT" })
  return res !== null && (res.ok || res.status === 204)
}

export async function localSetVolume(volumePercent: number, clientId: string): Promise<boolean> {
  const clamped = Math.max(0, Math.min(100, Math.round(volumePercent)))
  const res = await localSpotifyFetch(`/me/player/volume?volume_percent=${clamped}`, clientId, { method: "PUT" })
  return res !== null && (res.ok || res.status === 204)
}

export async function localCheckSavedTrack(trackId: string, clientId: string): Promise<boolean> {
  const res = await localSpotifyFetch(`/me/tracks/contains?ids=${trackId}`, clientId)
  if (!res || !res.ok) return false
  const data = (await res.json()) as boolean[]
  return data[0] ?? false
}

export async function localSaveTrack(trackId: string, clientId: string): Promise<boolean> {
  const res = await localSpotifyFetch("/me/tracks", clientId, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids: [trackId] }),
  })
  return res !== null && (res.ok || res.status === 200)
}

export async function localRemoveTrack(trackId: string, clientId: string): Promise<boolean> {
  const res = await localSpotifyFetch("/me/tracks", clientId, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids: [trackId] }),
  })
  return res !== null && (res.ok || res.status === 200)
}
