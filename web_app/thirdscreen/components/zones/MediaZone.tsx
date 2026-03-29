"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Music,
  Unplug,
  Volume2,
  Minus,
  Plus,
  Type,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { extractDominantColor } from "@/lib/spotify/color"
import { useDashboard } from "@/components/dashboard/DashboardContext"
import { ZoneDragHandle } from "@/components/dashboard/ZoneDragHandle"
import { toast } from "sonner"
import { generatePKCE } from "@/lib/spotify/pkce"
import { SPOTIFY_AUTH_URL, SPOTIFY_SCOPES } from "@/lib/spotify/constants"
import { isLocal } from "@/lib/data-layer"
import { useAuth, SignInButton } from "@clerk/nextjs"
import {
  getLocalSpotifyTokens,
  saveLocalSpotifyTokens,
  getLocalCurrentPlayback,
  getValidLocalToken,
  localPlaybackControl,
  localSeekPlayback,
  localTransferPlayback,
  clearLocalSpotifyTokens,
} from "@/lib/spotify/local-spotify"

// ── Types ───────────────────────────────────────────────────────────────────

interface PlaybackState {
  isPlaying: boolean
  title: string
  artist: string
  album: string
  albumArt: string | null
  progressMs: number
  durationMs: number
}

type ConnectionStatus =
  | { state: "loading" }
  | { state: "needs-client-id" }
  | { state: "needs-auth"; clientId: string | null }
  | { state: "connected"; playback: PlaybackState | null; sdkReady: boolean; deviceId: string | null }

// Extend window for Spotify SDK
declare global {
  interface Window {
    Spotify?: {
      Player: new (options: {
        name: string
        getOAuthToken: (cb: (token: string) => void) => void
        volume: number
      }) => SpotifyPlayer
    }
    onSpotifyWebPlaybackSDKReady?: () => void
  }
}

interface SpotifyPlayer {
  connect: () => Promise<boolean>
  disconnect: () => void
  addListener: (event: string, callback: (data: unknown) => void) => void
  removeListener: (event: string) => void
  getCurrentState: () => Promise<SpotifyPlayerState | null>
  togglePlay: () => Promise<void>
  previousTrack: () => Promise<void>
  nextTrack: () => Promise<void>
  resume: () => Promise<void>
  pause: () => Promise<void>
}

interface SpotifyPlayerState {
  paused: boolean
  position: number
  duration: number
  track_window: {
    current_track: {
      name: string
      artists: { name: string }[]
      album: { name: string; images: { url: string }[] }
    }
  }
}

// ── MediaZone ───────────────────────────────────────────────────────────────

export function MediaZone() {
  const { editMode } = useDashboard()
  const [status, setStatus] = useState<ConnectionStatus>({ state: "loading" })
  const [albumColor, setAlbumColor] = useState<{ r: number; g: number; b: number } | null>(null)
  const [smoothProgress, setSmoothProgress] = useState(0)
  const lastAlbumArtRef = useRef("")
  const playerRef = useRef<SpotifyPlayer | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const sdkLoadedRef = useRef(false)
  const clientIdRef = useRef<string | null>(null)
  const progressSyncRef = useRef({ position: 0, time: 0 })
  const [seekingMs, setSeekingMs] = useState<number | null>(null)
  const progressBarRef = useRef<HTMLDivElement | null>(null)
  const [lyricsSize, setLyricsSize] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("lyrics-font-size")
      return stored ? parseInt(stored, 10) : 14
    }
    return 14
  })
  const [lyricsSizeOpen, setLyricsSizeOpen] = useState(false)

  // Fetch connection status
  const fetchState = useCallback(async () => {
    if (isLocal) {
      // Local mode: fetch client ID from public endpoint, tokens from localStorage
      try {
        if (!clientIdRef.current) {
          const res = await fetch("/api/spotify/client-id")
          const data = await res.json()
          clientIdRef.current = data.clientId ?? null
        }
        if (!clientIdRef.current) {
          setStatus({ state: "needs-client-id" })
          return
        }
        const tokens = getLocalSpotifyTokens()
        if (!tokens.accessToken) {
          setStatus({ state: "needs-auth", clientId: clientIdRef.current })
          return
        }
        const playback = await getLocalCurrentPlayback(clientIdRef.current)
        setStatus((prev) => ({
          state: "connected",
          playback,
          sdkReady: prev.state === "connected" ? prev.sdkReady : false,
          deviceId: prev.state === "connected" ? prev.deviceId : null,
        }))
      } catch {
        // Transient error (network, idle tab) — keep previous state
        setStatus((prev) => (prev.state === "loading" ? { state: "needs-client-id" } : prev))
      }
      return
    }

    // Server mode: existing flow
    try {
      const res = await fetch("/api/spotify")
      if (res.status === 401) {
        setStatus({ state: "needs-auth", clientId: null })
        return
      }
      if (!res.ok) {
        // Transient server error — keep previous state
        setStatus((prev) => (prev.state === "loading" ? { state: "needs-client-id" } : prev))
        return
      }
      const data = await res.json()

      if (data.needsClientId) {
        setStatus({ state: "needs-client-id" })
      } else if (!data.connected) {
        setStatus({ state: "needs-auth", clientId: data.clientId ?? null })
      } else {
        setStatus((prev) => ({
          state: "connected",
          playback: data.playback ?? null,
          sdkReady: prev.state === "connected" ? prev.sdkReady : false,
          deviceId: prev.state === "connected" ? prev.deviceId : null,
        }))
      }
    } catch {
      // Transient error (network, idle tab) — keep previous state
      setStatus((prev) => (prev.state === "loading" ? { state: "needs-client-id" } : prev))
    }
  }, [])

  // Load Spotify Web Playback SDK
  const initSDK = useCallback(() => {
    if (sdkLoadedRef.current) return
    sdkLoadedRef.current = true

    window.onSpotifyWebPlaybackSDKReady = () => {
      if (!window.Spotify) return

      const player = new window.Spotify.Player({
        name: "Third Screen",
        getOAuthToken: async (cb) => {
          try {
            if (isLocal && clientIdRef.current) {
              const token = await getValidLocalToken(clientIdRef.current)
              if (token) cb(token)
            } else {
              const res = await fetch("/api/spotify/token")
              const { token } = await res.json()
              if (token) cb(token)
            }
          } catch {}
        },
        volume: 0.5,
      })

      player.addListener("ready", (data: unknown) => {
        const { device_id } = data as { device_id: string }
        setStatus((prev) =>
          prev.state === "connected"
            ? { ...prev, sdkReady: true, deviceId: device_id }
            : prev
        )
      })

      player.addListener("player_state_changed", (state: unknown) => {
        if (!state) return
        const s = state as SpotifyPlayerState
        const track = s.track_window.current_track
        setStatus((prev) =>
          prev.state === "connected"
            ? {
                ...prev,
                playback: {
                  isPlaying: !s.paused,
                  title: track.name,
                  artist: track.artists.map((a) => a.name).join(", "),
                  album: track.album.name,
                  albumArt: track.album.images[0]?.url ?? null,
                  progressMs: s.position,
                  durationMs: s.duration,
                },
              }
            : prev
        )
      })

      player.connect()
      playerRef.current = player
    }

    // Load SDK script if not already present
    if (!document.getElementById("spotify-sdk")) {
      const script = document.createElement("script")
      script.id = "spotify-sdk"
      script.src = "https://sdk.scdn.co/spotify-player.js"
      document.body.appendChild(script)
    }
  }, [])

  // Init on mount
  useEffect(() => {
    fetchState()
    return () => {
      playerRef.current?.disconnect()
    }
  }, [fetchState])

  // Start SDK + polling once connected
  useEffect(() => {
    if (status.state === "connected") {
      initSDK()
      if (!pollRef.current) {
        pollRef.current = setInterval(fetchState, 3000)
      }
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [status.state, initSDK, fetchState])

  // Extract dominant color from album art
  useEffect(() => {
    const artUrl =
      status.state === "connected" ? status.playback?.albumArt : null
    if (!artUrl || artUrl === lastAlbumArtRef.current) return
    lastAlbumArtRef.current = artUrl

    extractDominantColor(artUrl).then((color) => {
      if (color) setAlbumColor(color)
    })
  }, [status])

  // Listen for auth callback from popup
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type !== "spotify-auth") return

      // Local mode: popup sends tokens back for us to save
      if (isLocal && e.data.success && e.data.tokens) {
        saveLocalSpotifyTokens(e.data.tokens)
        toast.success("Connected to Spotify")
        fetchState()
        return
      }

      // Server mode: just refetch state
      if (e.data.success) {
        toast.success("Connected to Spotify")
        fetchState()
      }
    }
    window.addEventListener("message", handler)
    return () => window.removeEventListener("message", handler)
  }, [fetchState])

  // Smooth progress: derive playback info and interpolate between polls
  const connectedPlayback = status.state === "connected" ? status.playback : null
  const isPlaying = connectedPlayback?.isPlaying ?? false
  const serverProgress = connectedPlayback?.progressMs ?? 0
  const duration = connectedPlayback?.durationMs ?? 0

  useEffect(() => {
    progressSyncRef.current = { position: serverProgress, time: Date.now() }
    setSmoothProgress(serverProgress)
  }, [serverProgress])

  useEffect(() => {
    if (!isPlaying || !duration) return
    const tick = () => {
      const elapsed = Date.now() - progressSyncRef.current.time
      setSmoothProgress(Math.min(progressSyncRef.current.position + elapsed, duration))
      rafId = requestAnimationFrame(tick)
    }
    let rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [isPlaying, duration])

  // ── Controls ──────────────────────────────────────────────────────────

  const sendControl = async (action: string) => {
    // Optimistic update for play/pause
    if ((action === "play" || action === "pause") && status.state === "connected" && status.playback) {
      setStatus({
        ...status,
        playback: { ...status.playback, isPlaying: action === "play" },
      })
    }

    try {
      if (isLocal && clientIdRef.current) {
        await localPlaybackControl(action as "play" | "pause" | "next" | "previous", clientIdRef.current)
      } else {
        await fetch("/api/spotify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        })
      }
      setTimeout(fetchState, 300)
    } catch {}
  }

  const startPlayback = async () => {
    if (status.state !== "connected" || !status.deviceId) return
    try {
      if (isLocal && clientIdRef.current) {
        await localTransferPlayback(status.deviceId, true, clientIdRef.current)
      } else {
        await fetch("/api/spotify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "transfer",
            deviceId: status.deviceId,
            play: true,
          }),
        })
      }
      setTimeout(fetchState, 500)
    } catch {}
  }

  const sendSeek = async (positionMs: number) => {
    // Optimistic: update local progress immediately
    const clamped = Math.max(0, Math.min(positionMs, duration))
    progressSyncRef.current = { position: clamped, time: Date.now() }
    setSmoothProgress(clamped)

    try {
      if (isLocal && clientIdRef.current) {
        await localSeekPlayback(clamped, clientIdRef.current)
      } else {
        await fetch("/api/spotify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "seek", positionMs: clamped }),
        })
      }
      setTimeout(fetchState, 300)
    } catch {}
  }

  const getMsFromPointer = (clientX: number): number => {
    const bar = progressBarRef.current
    if (!bar || !duration) return 0
    const rect = bar.getBoundingClientRect()
    const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return fraction * duration
  }

  const onProgressPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    const ms = getMsFromPointer(e.clientX)
    setSeekingMs(ms)
  }

  const onProgressPointerMove = (e: React.PointerEvent) => {
    if (seekingMs === null) return
    setSeekingMs(getMsFromPointer(e.clientX))
  }

  const onProgressPointerUp = (e: React.PointerEvent) => {
    if (seekingMs === null) return
    const ms = getMsFromPointer(e.clientX)
    setSeekingMs(null)
    sendSeek(ms)
  }

  const disconnect = async () => {
    playerRef.current?.disconnect()
    playerRef.current = null
    sdkLoadedRef.current = false
    if (isLocal) {
      clearLocalSpotifyTokens()
    } else {
      await fetch("/api/spotify", { method: "DELETE" })
    }
    fetchState()
    toast.success("Disconnected from Spotify")
  }

  // ── Render ────────────────────────────────────────────────────────────

  if (status.state === "loading") {
    return (
      <div className="zone-surface zone-media flex h-full items-center justify-center">
        <div className="size-4 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground" />
      </div>
    )
  }

  if (status.state === "needs-client-id") {
    return (
      <div className="zone-surface zone-media flex h-full flex-col items-center justify-center gap-2 px-6">
        <Music className="size-6" style={{ color: "var(--zone-media-accent)", opacity: 0.4 }} />
        <p className="text-xs text-muted-foreground text-center">
          Spotify is not configured yet.
        </p>
      </div>
    )
  }

  if (status.state === "needs-auth") {
    return <SpotifyAuth clientId={status.clientId} onComplete={fetchState} />
  }

  // Connected
  const { playback, sdkReady, deviceId } = status

  // Build dynamic background gradient from album color
  const zoneBg = albumColor
    ? {
        background: `linear-gradient(135deg, rgba(${albumColor.r}, ${albumColor.g}, ${albumColor.b}, 0.15) 0%, var(--zone-media) 60%)`,
      }
    : undefined

  return (
    <div
      className="zone-surface zone-media flex h-full flex-col transition-[background] duration-1000"
      style={zoneBg}
    >
      <div className={`flex shrink-0 items-center justify-between px-4 py-1.5 ${editMode ? "zone-drag-handle" : ""}`}>
        <div className="flex items-center gap-2">
          <ZoneDragHandle />
          <div
            className="h-4 w-[3px] rounded-full"
            style={{ background: "var(--zone-media-accent)" }}
          />
          <span
            className="font-[family-name:var(--font-display)] text-sm font-bold tracking-tight"
            style={{ color: "var(--zone-media-accent)" }}
          >
            Now Playing
          </span>
        </div>
        <div className="flex items-center gap-1">
          {sdkReady && (
            <span title="Spotify SDK connected">
              <Volume2 className="size-3 text-green-500" />
            </span>
          )}
          {/* Lyrics size control */}
          <div className="relative flex items-center">
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setLyricsSizeOpen((v) => !v)}
              className="text-muted-foreground/40 hover:text-foreground/70"
              title="Lyrics text size"
            >
              <Type className="size-3" />
            </Button>
            {lyricsSizeOpen && (
              <div className="absolute right-0 top-full z-20 mt-1 flex items-center gap-0.5 rounded-lg border border-border/30 bg-card/95 p-1 shadow-lg backdrop-blur-sm">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => {
                    const next = Math.max(11, lyricsSize - 2)
                    setLyricsSize(next)
                    localStorage.setItem("lyrics-font-size", String(next))
                  }}
                  className="text-muted-foreground/60 hover:text-foreground"
                >
                  <Minus className="size-3" />
                </Button>
                <span className="min-w-[2rem] text-center font-mono text-xs text-muted-foreground">
                  {lyricsSize}
                </span>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => {
                    const next = Math.min(32, lyricsSize + 2)
                    setLyricsSize(next)
                    localStorage.setItem("lyrics-font-size", String(next))
                  }}
                  className="text-muted-foreground/60 hover:text-foreground"
                >
                  <Plus className="size-3" />
                </Button>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={disconnect}
            className="text-muted-foreground/40 hover:text-destructive"
            title="Disconnect Spotify"
          >
            <Unplug className="size-3" />
          </Button>
        </div>
      </div>

      {!playback ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3">
          <Music className="size-5 text-muted-foreground/30" />
          {sdkReady && deviceId ? (
            <>
              <p className="text-xs text-muted-foreground/50">
                Ready to play
              </p>
              <Button
                size="sm"
                onClick={startPlayback}
                className="gap-1.5"
                style={{ background: "var(--zone-media-accent)" }}
              >
                <Play className="size-3" />
                Start Playback
              </Button>
              <p className="max-w-48 text-center text-xs text-muted-foreground/30">
                Starts your last played track on this device
              </p>
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground/50">
                Connecting to Spotify...
              </p>
              <p className="text-xs text-muted-foreground/30">
                Play something on Spotify, or wait for the player to initialize
              </p>
            </>
          )}
        </div>
      ) : (
        <>
          {/* Track info: album art + title/artist */}
          <div className="shrink-0 px-4 pt-1">
            <div className="flex items-center gap-3">
              {playback.albumArt && (
                <img
                  src={playback.albumArt}
                  alt=""
                  className="size-12 shrink-0 rounded-md shadow-lg"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {playback.title}
                </p>
                <p className="truncate text-xs text-muted-foreground/60">
                  {playback.artist}
                </p>
              </div>
            </div>
          </div>

          {/* Playback controls: centered row */}
          <div className="flex shrink-0 items-center justify-center gap-3 px-4 py-1.5">
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => sendControl("previous")}
              className="text-muted-foreground/60 hover:text-foreground"
            >
              <SkipBack className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => sendControl(playback.isPlaying ? "pause" : "play")}
              className="rounded-full text-foreground"
            >
              {playback.isPlaying ? (
                <Pause className="size-4" />
              ) : (
                <Play className="size-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => sendControl("next")}
              className="text-muted-foreground/60 hover:text-foreground"
            >
              <SkipForward className="size-4" />
            </Button>
          </div>

          {/* Progress bar: full width, interactive seek */}
          <div className="shrink-0 px-4 pb-2">
            {(() => {
              const displayMs = seekingMs !== null ? seekingMs : smoothProgress
              const pct = (displayMs / Math.max(playback.durationMs, 1)) * 100
              return (
                <>
                  <div
                    ref={progressBarRef}
                    className="group/seek relative h-6 w-full cursor-pointer touch-none select-none"
                    onPointerDown={onProgressPointerDown}
                    onPointerMove={onProgressPointerMove}
                    onPointerUp={onProgressPointerUp}
                    onPointerCancel={() => setSeekingMs(null)}
                  >
                    {/* Track */}
                    <div className="absolute top-1/2 h-1.5 w-full -translate-y-1/2 overflow-hidden rounded-full bg-border/30 transition-[height] group-active/seek:h-2">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, background: "var(--zone-media-accent)" }}
                      />
                    </div>
                    {/* Thumb (visible on hover/drag) */}
                    <div
                      className="pointer-events-none absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-20 shadow-md transition-opacity group-active/seek:opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/seek:opacity-100"
                      style={{ left: `${pct}%`, background: "var(--zone-media-accent)" }}
                    />
                  </div>
                  <div className="-mt-1 flex items-center justify-between">
                    <span className="font-mono text-xs tabular-nums text-muted-foreground/50">
                      {formatMs(displayMs)}
                    </span>
                    <span className="font-mono text-xs tabular-nums text-muted-foreground/30">
                      {formatMs(playback.durationMs)}
                    </span>
                  </div>
                </>
              )
            })()}
          </div>

          {/* Lyrics */}
          <SyncedLyrics
            track={playback.title}
            artist={playback.artist}
            album={playback.album}
            durationMs={playback.durationMs}
            progressMs={playback.progressMs}
            isPlaying={playback.isPlaying}
            fontSize={lyricsSize}
          />
        </>
      )}
    </div>
  )
}


// ── Spotify auth (open OAuth popup) ─────────────────────────────────────────

function SpotifyAuth({ clientId, onComplete }: { clientId: string | null; onComplete: () => void }) {
  const { isSignedIn } = useAuth()
  const connect = async () => {
    if (!clientId) return

    const { codeVerifier, codeChallenge } = await generatePKCE()

    const openerOrigin = window.location.origin
    const redirectOrigin = openerOrigin.replace("://localhost", "://127.0.0.1")
    const callbackPath = isLocal ? "/spotify-callback" : "/api/spotify/callback"
    const redirectUri = `${redirectOrigin}${callbackPath}`

    // Include opener origin so the callback page can postMessage back correctly
    const state = btoa(JSON.stringify({ v: codeVerifier, r: redirectUri, o: openerOrigin }))

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: "code",
      redirect_uri: redirectUri,
      scope: SPOTIFY_SCOPES,
      code_challenge_method: "S256",
      code_challenge: codeChallenge,
      state,
    })

    const popup = window.open(
      `${SPOTIFY_AUTH_URL}?${params}`,
      "spotify-auth",
      "width=500,height=700,left=200,top=100"
    )

    if (popup) {
      const check = setInterval(() => {
        if (popup.closed) {
          clearInterval(check)
          setTimeout(onComplete, 500)
        }
      }, 500)
    }
  }

  return (
    <div className="zone-surface zone-media flex h-full flex-col">
      <div className="flex shrink-0 items-center px-4 py-1.5">
        <div className="flex items-center gap-2">
          <div className="h-4 w-[3px] rounded-full" style={{ background: "var(--zone-media-accent)" }} />
          <span
            className="font-[family-name:var(--font-display)] text-sm font-bold tracking-tight"
            style={{ color: "var(--zone-media-accent)" }}
          >
            Now Playing
          </span>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6">
        <Music className="size-6" style={{ color: "var(--zone-media-accent)", opacity: 0.4 }} />
        {clientId ? (
          <>
            <p className="text-xs text-muted-foreground">
              Connect your Spotify account
            </p>
            <Button
              size="sm"
              onClick={connect}
              className="gap-1.5"
              style={{ background: "var(--zone-media-accent)" }}
            >
              <Music className="size-3" />
              Connect Spotify
            </Button>
            {isLocal && !isSignedIn && (
              <p className="text-xs text-muted-foreground/30">
                Saved in local storage only
              </p>
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground text-center">
            Sign in to connect Spotify
          </p>
        )}
      </div>
    </div>
  )
}

// ── Synced Lyrics ───────────────────────────────────────────────────────────

interface LyricsLine {
  startMs: number
  text: string
}

interface LyricsData {
  instrumental: boolean
  synced: LyricsLine[] | null
  plain: string | null
}

function SyncedLyrics({
  track,
  artist,
  album,
  durationMs,
  progressMs,
  isPlaying,
  fontSize = 14,
}: {
  track: string
  artist: string
  album: string
  durationMs: number
  progressMs: number
  isPlaying: boolean
  fontSize?: number
}) {
  const [lyrics, setLyrics] = useState<LyricsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [localProgress, setLocalProgress] = useState(progressMs)
  const lastTrackRef = useRef("")
  const activeLineRef = useRef<HTMLParagraphElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const lastScrolledIndex = useRef(-1)
  const isNewTrackRef = useRef(false)
  // Timestamp-based progress: record when we last synced so we can
  // compute elapsed time without accumulation drift
  const syncRef = useRef({ position: progressMs, time: 0 })

  // Re-anchor whenever the SDK gives us a new position
  useEffect(() => {
    syncRef.current = { position: progressMs, time: Date.now() }
    setLocalProgress(progressMs)
  }, [progressMs])

  // Derive local progress from the anchor + wall clock (no drift)
  useEffect(() => {
    if (!isPlaying) return
    const tick = () => {
      const elapsed = Date.now() - syncRef.current.time
      const pos = Math.min(syncRef.current.position + elapsed, durationMs)
      setLocalProgress(pos)
      rafId = requestAnimationFrame(tick)
    }
    let rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [isPlaying, durationMs])

  // Fetch lyrics when track changes
  useEffect(() => {
    const trackKey = `${track}|${artist}`
    if (trackKey === lastTrackRef.current) return
    lastTrackRef.current = trackKey
    lastScrolledIndex.current = -1
    isNewTrackRef.current = true

    setLoading(true)
    setLyrics(null)

    const params = new URLSearchParams({ track, artist })
    if (album) params.set("album", album)
    if (durationMs) params.set("duration", String(durationMs))

    fetch(`/api/spotify/lyrics?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (lastTrackRef.current === trackKey) {
          setLyrics(data)
          setLoading(false)
        }
      })
      .catch(() => {
        if (lastTrackRef.current === trackKey) {
          setLyrics(null)
          setLoading(false)
        }
      })
  }, [track, artist, album, durationMs])

  // Find current line
  const currentIndex = lyrics?.synced
    ? findCurrentLine(lyrics.synced, localProgress)
    : -1

  // Auto-scroll when active line changes
  useEffect(() => {
    if (currentIndex < 0 || currentIndex === lastScrolledIndex.current) return
    lastScrolledIndex.current = currentIndex

    // On new track, jump instantly. On line changes within a song, smooth scroll.
    const isNew = isNewTrackRef.current
    isNewTrackRef.current = false

    requestAnimationFrame(() => {
      const container = containerRef.current
      const activeLine = activeLineRef.current
      if (!container || !activeLine) return

      // Calculate scroll position to center the active line within the lyrics container
      const lineTop = activeLine.offsetTop
      const lineHeight = activeLine.offsetHeight
      const containerHeight = container.clientHeight
      const targetScroll = lineTop - containerHeight / 2 + lineHeight / 2

      if (isNew) {
        container.scrollTop = targetScroll
      } else {
        container.scrollTo({ top: targetScroll, behavior: "smooth" })
      }
    })
  }, [currentIndex])

  if (loading) {
    return (
      <div className="min-h-0 flex-1 px-4 pb-2">
        <div className="flex h-full items-center justify-center">
          <div className="space-y-2">
            {[0.6, 0.8, 0.5, 0.7, 0.4].map((w, i) => (
              <div
                key={i}
                className="h-3 animate-pulse rounded bg-muted/30"
                style={{ width: `${w * 8}rem`, animationDelay: `${i * 100}ms` }}
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!lyrics || lyrics.instrumental) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-4 pb-2">
        <p className="text-xs italic text-muted-foreground/30">
          {lyrics?.instrumental ? "Instrumental" : "No lyrics available"}
        </p>
      </div>
    )
  }

  // Synced lyrics
  if (lyrics.synced && lyrics.synced.length > 0) {
    return (
      <div ref={containerRef} className="lyrics-container min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {/* Top spacer so first line can scroll to center */}
        <div className="h-[40%]" />

        {lyrics.synced.map((line, i) => {
          const isActive = i === currentIndex
          return (
            <p
              key={i}
              ref={isActive ? activeLineRef : undefined}
              className={cn(
                "py-1 leading-relaxed transition-[font-size] duration-200",
                isActive
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground/60"
              )}
              style={{ fontSize: `${fontSize}px` }}
            >
              {line.text || "\u00A0"}
            </p>
          )
        })}

        {/* Bottom spacer */}
        <div className="h-[40%]" />
      </div>
    )
  }

  // Plain lyrics fallback
  if (lyrics.plain) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-2">
        <pre
          className="whitespace-pre-wrap font-sans leading-relaxed text-muted-foreground/60"
          style={{ fontSize: `${fontSize}px` }}
        >
          {lyrics.plain}
        </pre>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-4 pb-2">
      <p className="text-xs text-muted-foreground/30">No lyrics available</p>
    </div>
  )
}

function findCurrentLine(lines: LyricsLine[], progressMs: number): number {
  let idx = -1
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startMs <= progressMs) {
      idx = i
    } else {
      break
    }
  }
  return idx
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${String(s).padStart(2, "0")}`
}
