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
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { extractDominantColor } from "@/lib/spotify/color"
import { toast } from "sonner"
import { generatePKCE } from "@/lib/spotify/pkce"
import { SPOTIFY_AUTH_URL, SPOTIFY_SCOPES } from "@/lib/spotify/constants"

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
  | { state: "needs-auth" }
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
  const [status, setStatus] = useState<ConnectionStatus>({ state: "loading" })
  const [albumColor, setAlbumColor] = useState<{ r: number; g: number; b: number } | null>(null)
  const lastAlbumArtRef = useRef("")
  const playerRef = useRef<SpotifyPlayer | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const sdkLoadedRef = useRef(false)

  // Fetch connection status from server
  const fetchState = useCallback(async () => {
    try {
      const res = await fetch("/api/spotify")
      if (!res.ok) return
      const data = await res.json()

      if (data.needsClientId) {
        setStatus({ state: "needs-client-id" })
      } else if (!data.connected) {
        setStatus({ state: "needs-auth" })
      } else {
        setStatus((prev) => ({
          state: "connected",
          playback: data.playback ?? null,
          sdkReady: prev.state === "connected" ? prev.sdkReady : false,
          deviceId: prev.state === "connected" ? prev.deviceId : null,
        }))
      }
    } catch {
      setStatus({ state: "needs-client-id" })
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
            const res = await fetch("/api/spotify/token")
            const { token } = await res.json()
            if (token) cb(token)
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
        pollRef.current = setInterval(fetchState, 10000)
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
      if (e.origin !== window.location.origin) return
      if (e.data?.type === "spotify-auth" && e.data.success) {
        toast.success("Connected to Spotify")
        fetchState()
      }
    }
    window.addEventListener("message", handler)
    return () => window.removeEventListener("message", handler)
  }, [fetchState])

  // ── Controls ──────────────────────────────────────────────────────────

  const sendControl = async (action: string) => {
    try {
      await fetch("/api/spotify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      setTimeout(fetchState, 300)
    } catch {}
  }

  const startPlayback = async () => {
    if (status.state !== "connected" || !status.deviceId) return
    // Transfer playback to our SDK device and start playing
    try {
      await fetch("/api/spotify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "transfer",
          deviceId: status.deviceId,
          play: true,
        }),
      })
      setTimeout(fetchState, 500)
    } catch {}
  }

  const disconnect = async () => {
    playerRef.current?.disconnect()
    playerRef.current = null
    sdkLoadedRef.current = false
    await fetch("/api/spotify", { method: "DELETE" })
    setStatus({ state: "needs-client-id" })
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
    return <SpotifySetup onComplete={fetchState} />
  }

  if (status.state === "needs-auth") {
    return <SpotifyAuth onComplete={fetchState} />
  }

  // Connected
  const { playback, sdkReady, deviceId } = status

  // Build dynamic styles from album color
  const accentColor = albumColor
    ? `rgb(${albumColor.r}, ${albumColor.g}, ${albumColor.b})`
    : "var(--zone-media-accent)"

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
      <div className="flex shrink-0 items-center justify-between px-4 py-1.5">
        <div className="flex items-center gap-2">
          <div
            className="h-4 w-[3px] rounded-full transition-colors duration-1000"
            style={{ background: accentColor }}
          />
          <span
            className="font-[family-name:var(--font-display)] text-sm font-bold tracking-tight transition-colors duration-1000"
            style={{ color: accentColor }}
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
                style={{ background: accentColor }}
              >
                <Play className="size-3" />
                Start Playback
              </Button>
              <p className="max-w-48 text-center text-[0.5625rem] text-muted-foreground/30">
                Starts your last played track on this device
              </p>
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground/50">
                Connecting to Spotify...
              </p>
              <p className="text-[0.625rem] text-muted-foreground/30">
                Play something on Spotify, or wait for the player to initialize
              </p>
            </>
          )}
        </div>
      ) : (
        <>
          {/* Track info */}
          <div className="shrink-0 px-4">
            <div className="flex items-center gap-3">
              {playback.albumArt && (
                <img
                  src={playback.albumArt}
                  alt=""
                  className="size-10 shrink-0 rounded"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-foreground">
                  {playback.title}
                </p>
                <p className="truncate text-[0.625rem] text-muted-foreground/60">
                  {playback.artist}
                </p>
              </div>
            </div>
          </div>

          {/* Controls + progress */}
          <div className="shrink-0 px-4 py-1.5">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => sendControl("previous")}
                className="text-muted-foreground/60 hover:text-foreground"
              >
                <SkipBack className="size-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => sendControl(playback.isPlaying ? "pause" : "play")}
                className="size-7 rounded-full transition-colors duration-1000"
                style={{ color: accentColor }}
              >
                {playback.isPlaying ? (
                  <Pause className="size-3.5" />
                ) : (
                  <Play className="size-3.5" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => sendControl("next")}
                className="text-muted-foreground/60 hover:text-foreground"
              >
                <SkipForward className="size-3" />
              </Button>

              <span className="ml-1 font-mono text-[0.5625rem] tabular-nums text-muted-foreground/50">
                {formatMs(playback.progressMs)}
              </span>

              <div className="h-1 flex-1 overflow-hidden rounded-full bg-border/30">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(playback.progressMs / Math.max(playback.durationMs, 1)) * 100}%`,
                    background: accentColor,
                  }}
                />
              </div>

              <span className="font-mono text-[0.5625rem] tabular-nums text-muted-foreground/30">
                {formatMs(playback.durationMs)}
              </span>
            </div>
          </div>

          {/* Lyrics */}
          <SyncedLyrics
            track={playback.title}
            artist={playback.artist}
            album={playback.album}
            durationMs={playback.durationMs}
            progressMs={playback.progressMs}
            isPlaying={playback.isPlaying}
          />
        </>
      )}
    </div>
  )
}

// ── Spotify setup (enter client ID) ─────────────────────────────────────────

function SpotifySetup({ onComplete }: { onComplete: () => void }) {
  const [clientId, setClientId] = useState("")
  const [saving, setSaving] = useState(false)

  const save = async () => {
    const id = clientId.trim()
    if (!id) return
    setSaving(true)
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "spotify_client_id", value: id }),
      })
      onComplete()
    } catch {
      toast.error("Failed to save")
    } finally {
      setSaving(false)
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
        <div className="w-full max-w-xs space-y-3 text-center">
          <p className="text-xs text-muted-foreground">
            Enter your Spotify Client ID to connect
          </p>
          <p className="text-[0.625rem] text-muted-foreground/40">
            Create a free app at developer.spotify.com, set the redirect URI to{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.5625rem]">
              {typeof window !== "undefined" ? `${window.location.origin.replace("://localhost", "://127.0.0.1")}/api/spotify/callback` : "http://127.0.0.1:3000/api/spotify/callback"}
            </code>
          </p>
          <Input
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="Paste Client ID here"
            className="h-8 text-center text-xs"
            onKeyDown={(e) => e.key === "Enter" && save()}
          />
          <Button
            size="sm"
            onClick={save}
            disabled={!clientId.trim() || saving}
            className="w-full"
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Spotify auth (open OAuth popup) ─────────────────────────────────────────

function SpotifyAuth({ onComplete }: { onComplete: () => void }) {
  const connect = async () => {
    const { codeVerifier, codeChallenge } = await generatePKCE()

    const settingsRes = await fetch("/api/settings")
    const allSettings = await settingsRes.json()
    const clientId = allSettings.spotify_client_id
    if (!clientId) return

    const origin = window.location.origin.replace("://localhost", "://127.0.0.1")
    const redirectUri = `${origin}/api/spotify/callback`

    const state = btoa(JSON.stringify({ v: codeVerifier, r: redirectUri }))

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
}: {
  track: string
  artist: string
  album: string
  durationMs: number
  progressMs: number
  isPlaying: boolean
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
  const syncRef = useRef({ position: progressMs, time: Date.now() })

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
      if (isNew && containerRef.current) {
        // Reset scroll to top instantly, then snap to the active line
        containerRef.current.scrollTop = 0
        activeLineRef.current?.scrollIntoView({
          behavior: "instant",
          block: "center",
        })
      } else {
        activeLineRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        })
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
                "py-1 text-sm leading-relaxed",
                isActive
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground/60"
              )}
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
        <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-muted-foreground/60">
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
