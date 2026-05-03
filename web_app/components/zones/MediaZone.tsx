"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useRegisterZoneActions, type ZoneAction } from "@/lib/zone-actions"
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Music,
  Minus,
  Plus,
  Monitor,
  Smartphone,
  Speaker,
  Tablet,
  Tv,
  Gamepad2,
  Car,
  MonitorSpeaker,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  Volume1,
  Heart,
  Copy,
  ExternalLink,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { extractDominantColor } from "@/lib/spotify/color"
import { useDashboard } from "@/components/dashboard/DashboardContext"
import { ZoneDragHandle } from "@/components/dashboard/ZoneDragHandle"
import { ZoneLabel } from "@/components/dashboard/ZoneLabel"
import { toast } from "sonner"
import { generatePKCE } from "@/lib/spotify/pkce"
import { SPOTIFY_AUTH_URL, SPOTIFY_SCOPES } from "@/lib/spotify/constants"
import { isLocal } from "@/lib/data-layer"
import { useAuth, SignInButton } from "@clerk/nextjs"
import {
  getLocalSpotifyTokens,
  saveLocalSpotifyTokens,
  getLocalCurrentPlayback,
  localPlaybackControl,
  localSeekPlayback,
  localTransferPlayback,
  getLocalDevices,
  localSetShuffle,
  localSetRepeat,
  localSetVolume,
  localCheckSavedTrack,
  localSaveTrack,
  localRemoveTrack,
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
  trackId: string | null
  shuffleState: boolean
  repeatState: "off" | "track" | "context"
  volumePercent: number | null
}

type ConnectionStatus =
  | { state: "loading" }
  | { state: "needs-client-id" }
  | { state: "needs-auth"; clientId: string | null }
  | { state: "connected"; playback: PlaybackState | null }

interface SpotifyDevice {
  id: string
  name: string
  type: string
  is_active: boolean
  volume_percent: number | null
}

// ── MediaZone ───────────────────────────────────────────────────────────────

export function MediaZone() {
  const { editMode } = useDashboard()
  const [status, setStatus] = useState<ConnectionStatus>({ state: "loading" })
  const [albumColor, setAlbumColor] = useState<{ r: number; g: number; b: number } | null>(null)
  const [smoothProgress, setSmoothProgress] = useState(0)
  const lastAlbumArtRef = useRef("")
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const clientIdRef = useRef<string | null>(null)
  const progressSyncRef = useRef({ position: 0, time: 0 })
  const [seekingMs, setSeekingMs] = useState<number | null>(null)
  const progressBarRef = useRef<HTMLDivElement | null>(null)
  const [lyricsSize, setLyricsSize] = useState(14)
  const [devices, setDevices] = useState<SpotifyDevice[]>([])
  const [devicePickerOpen, setDevicePickerOpen] = useState(false)
  const [devicesLoading, setDevicesLoading] = useState(false)
  const [isLiked, setIsLiked] = useState(false)
  const lastCheckedTrackRef = useRef<string | null>(null)

  // Sync lyrics size from localStorage after hydration
  useEffect(() => {
    const stored = localStorage.getItem("lyrics-font-size")
    if (stored) setLyricsSize(parseInt(stored, 10))
  }, [])

  const zoneActions = useMemo<ZoneAction[]>(
    () => [
      {
        id: "lyrics-smaller",
        label: `Lyrics smaller (${lyricsSize}px)`,
        icon: <Minus className="size-3.5" />,
        onSelect: () => {
          const next = Math.max(11, lyricsSize - 2)
          setLyricsSize(next)
          localStorage.setItem("lyrics-font-size", String(next))
        },
        disabled: lyricsSize <= 11,
      },
      {
        id: "lyrics-larger",
        label: `Lyrics larger (${lyricsSize}px)`,
        icon: <Plus className="size-3.5" />,
        onSelect: () => {
          const next = Math.min(32, lyricsSize + 2)
          setLyricsSize(next)
          localStorage.setItem("lyrics-font-size", String(next))
        },
        disabled: lyricsSize >= 32,
      },
    ],
    [lyricsSize],
  )
  useRegisterZoneActions("media", zoneActions)

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
        setStatus({ state: "connected", playback })
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
        setStatus({ state: "connected", playback: data.playback ?? null })
      }
    } catch {
      // Transient error (network, idle tab) — keep previous state
      setStatus((prev) => (prev.state === "loading" ? { state: "needs-client-id" } : prev))
    }
  }, [])

  // Init on mount
  useEffect(() => {
    fetchState()
  }, [fetchState])

  // Start polling once connected
  useEffect(() => {
    if (status.state === "connected") {
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
  }, [status.state, fetchState])

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

  // Check if current track is liked when track changes
  const currentTrackId = connectedPlayback?.trackId ?? null
  useEffect(() => {
    if (!currentTrackId || currentTrackId === lastCheckedTrackRef.current) return
    lastCheckedTrackRef.current = currentTrackId
    ;(async () => {
      try {
        let saved: boolean
        if (isLocal && clientIdRef.current) {
          saved = await localCheckSavedTrack(currentTrackId, clientIdRef.current)
        } else {
          const res = await fetch("/api/spotify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "check-saved", trackId: currentTrackId }),
          })
          const data = (await res.json()) as { saved?: boolean }
          saved = data.saved ?? false
        }
        setIsLiked(saved)
      } catch {
        setIsLiked(false)
      }
    })()
  }, [currentTrackId])

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

  const fetchDevices = async () => {
    setDevicesLoading(true)
    try {
      let deviceList: SpotifyDevice[]
      if (isLocal && clientIdRef.current) {
        deviceList = await getLocalDevices(clientIdRef.current)
      } else {
        const res = await fetch("/api/spotify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "devices" }),
        })
        const data = (await res.json()) as { devices?: SpotifyDevice[] }
        deviceList = data.devices ?? []
      }
      // Filter out "Third Screen" SDK device if it somehow still exists
      setDevices(deviceList.filter((d) => d.name !== "Third Screen"))
    } catch {
      setDevices([])
    } finally {
      setDevicesLoading(false)
    }
  }

  const transferToDevice = async (deviceId: string) => {
    try {
      if (isLocal && clientIdRef.current) {
        await localTransferPlayback(deviceId, true, clientIdRef.current)
      } else {
        await fetch("/api/spotify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "transfer",
            deviceId,
            play: true,
          }),
        })
      }
      setDevicePickerOpen(false)
      setTimeout(fetchState, 500)
    } catch {}
  }

  const toggleShuffle = async () => {
    if (status.state !== "connected" || !status.playback) return
    const newState = !status.playback.shuffleState
    // Optimistic
    setStatus({ ...status, playback: { ...status.playback, shuffleState: newState } })
    try {
      if (isLocal && clientIdRef.current) {
        await localSetShuffle(newState, clientIdRef.current)
      } else {
        await fetch("/api/spotify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "shuffle", state: newState }),
        })
      }
      setTimeout(fetchState, 300)
    } catch {}
  }

  const cycleRepeat = async () => {
    if (status.state !== "connected" || !status.playback) return
    const order: ("off" | "context" | "track")[] = ["off", "context", "track"]
    const idx = order.indexOf(status.playback.repeatState)
    const newState = order[(idx + 1) % 3]
    // Optimistic
    setStatus({ ...status, playback: { ...status.playback, repeatState: newState } })
    try {
      if (isLocal && clientIdRef.current) {
        await localSetRepeat(newState, clientIdRef.current)
      } else {
        await fetch("/api/spotify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "repeat", state: newState }),
        })
      }
      setTimeout(fetchState, 300)
    } catch {}
  }

  const sendVolume = async (vol: number) => {
    if (status.state !== "connected" || !status.playback) return
    const clamped = Math.max(0, Math.min(100, Math.round(vol)))
    // Optimistic
    setStatus({ ...status, playback: { ...status.playback, volumePercent: clamped } })
    try {
      if (isLocal && clientIdRef.current) {
        await localSetVolume(clamped, clientIdRef.current)
      } else {
        await fetch("/api/spotify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "volume", volumePercent: clamped }),
        })
      }
    } catch {}
  }

  const toggleLike = async () => {
    if (!currentTrackId) return
    const wasLiked = isLiked
    setIsLiked(!wasLiked)
    try {
      if (isLocal && clientIdRef.current) {
        if (wasLiked) {
          await localRemoveTrack(currentTrackId, clientIdRef.current)
        } else {
          await localSaveTrack(currentTrackId, clientIdRef.current)
        }
      } else {
        await fetch("/api/spotify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: wasLiked ? "remove-track" : "save-track",
            trackId: currentTrackId,
          }),
        })
      }
    } catch {
      setIsLiked(wasLiked) // revert on error
    }
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
  const { playback } = status

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

      {!playback ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3">
          <Music className="size-5 text-muted-foreground/30" />
          <p className="text-xs text-muted-foreground/50">
            No active playback
          </p>
          <p className="max-w-52 text-center text-xs text-muted-foreground/30">
            Play something on Spotify, or pick a device
          </p>
          <ChooseDeviceTrigger
            open={devicePickerOpen}
            setOpen={setDevicePickerOpen}
            fetchDevices={fetchDevices}
            devices={devices}
            loading={devicesLoading}
            onSelect={transferToDevice}
            sendVolume={sendVolume}
          />
        </div>
      ) : (
        <>
          {/* Track info: album art + title/artist + like */}
          <div className="shrink-0 px-4 pt-4">
            <div className="flex items-center gap-3">
              {playback.albumArt && (
                <img
                  src={playback.albumArt}
                  alt=""
                  className="size-12 shrink-0 rounded-md shadow-lg"
                  crossOrigin="anonymous"
                  onError={(e) => {
                    const img = e.currentTarget
                    if (!img.dataset.retried) {
                      img.dataset.retried = "1"
                      setTimeout(() => { img.src = playback.albumArt! }, 1000)
                    }
                  }}
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
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={toggleLike}
                className={cn(
                  "shrink-0 transition-colors",
                  isLiked
                    ? "text-green-500 hover:text-green-400"
                    : "text-muted-foreground/40 hover:text-foreground/70"
                )}
                title={isLiked ? "Remove from Liked Songs" : "Save to Liked Songs"}
              >
                <Heart className={cn("size-4", isLiked && "fill-current")} />
              </Button>
            </div>
          </div>

          {/* Playback controls: shuffle | prev | play/pause | next | repeat */}
          <div className="flex shrink-0 items-center justify-center gap-2 px-4 py-1.5 [&_button[data-size=icon-xs]]:!rounded-full [&_button[data-size=icon-sm]]:!rounded-full">
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={toggleShuffle}
              className={cn(
                "transition-colors",
                playback.shuffleState
                  ? "text-green-500 hover:text-green-400"
                  : "text-muted-foreground/40 hover:text-foreground/70"
              )}
              title={playback.shuffleState ? "Disable shuffle" : "Enable shuffle"}
            >
              <Shuffle className="size-3.5" />
            </Button>
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
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={cycleRepeat}
              className={cn(
                "transition-colors",
                playback.repeatState !== "off"
                  ? "text-green-500 hover:text-green-400"
                  : "text-muted-foreground/40 hover:text-foreground/70"
              )}
              title={
                playback.repeatState === "off"
                  ? "Enable repeat"
                  : playback.repeatState === "context"
                    ? "Enable repeat one"
                    : "Disable repeat"
              }
            >
              {playback.repeatState === "track" ? (
                <Repeat1 className="size-3.5" />
              ) : (
                <Repeat className="size-3.5" />
              )}
            </Button>
            <DeviceVolumeTrigger
              open={devicePickerOpen}
              setOpen={setDevicePickerOpen}
              fetchDevices={fetchDevices}
              devices={devices}
              loading={devicesLoading}
              onSelect={transferToDevice}
              volume={playback.volumePercent ?? 50}
              sendVolume={sendVolume}
            />
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
                        className="h-full rounded-full bg-foreground/80"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {/* Thumb (visible on hover/drag) */}
                    <div
                      className="pointer-events-none absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/80 opacity-20 shadow-md transition-opacity group-active/seek:opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/seek:opacity-100"
                      style={{ left: `${pct}%` }}
                    />
                  </div>
                  <div className="-mt-1 flex items-center justify-between">
                    <span className="font-mono text-xs tabular-nums text-muted-foreground/80">
                      {formatMs(displayMs)}
                    </span>
                    <span className="font-mono text-xs tabular-nums text-muted-foreground/60">
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


// ── Volume slider ──────────────────────────────────────────────────────────

function VolumeSlider({
  value,
  onChange,
}: {
  value: number
  onChange: (vol: number) => void
}) {
  const barRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const [localVol, setLocalVol] = useState(value)

  // Sync from parent when not dragging
  useEffect(() => {
    if (!dragging) setLocalVol(value)
  }, [value, dragging])

  const volFromPointer = (clientX: number) => {
    const bar = barRef.current
    if (!bar) return value
    const rect = bar.getBoundingClientRect()
    return Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100))
  }

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)
    const v = volFromPointer(e.clientX)
    setLocalVol(v)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return
    setLocalVol(volFromPointer(e.clientX))
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragging) return
    setDragging(false)
    const v = volFromPointer(e.clientX)
    setLocalVol(v)
    onChange(v)
  }

  const displayVol = dragging ? localVol : value

  return (
    <div
      ref={barRef}
      className="group/vol relative h-6 w-full cursor-pointer touch-none select-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => setDragging(false)}
    >
      <div className="absolute top-1/2 h-1 w-full -translate-y-1/2 overflow-hidden rounded-full bg-border/30">
        <div
          className="h-full rounded-full bg-foreground/60 transition-[width]"
          style={{ width: `${displayVol}%` }}
        />
      </div>
      <div
        className="pointer-events-none absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/80 opacity-0 shadow-sm transition-opacity group-active/vol:opacity-100 [@media(hover:hover)]:group-hover/vol:opacity-100"
        style={{ left: `${displayVol}%` }}
      />
    </div>
  )
}

// ── Device picker popover ──────────────────────────────────────────────────

function getDeviceIcon(type: string) {
  switch (type.toLowerCase()) {
    case "computer":
      return Monitor
    case "smartphone":
      return Smartphone
    case "speaker":
      return Speaker
    case "tablet":
      return Tablet
    case "tv":
      return Tv
    case "game_console":
      return Gamepad2
    case "automobile":
      return Car
    default:
      return Speaker
  }
}

function DevicesAndVolumePicker({
  devices,
  loading,
  onSelect,
  onClose,
  volume,
  onVolumeChange,
  triggerRef,
}: {
  devices: SpotifyDevice[]
  loading: boolean
  onSelect: (deviceId: string) => void
  onClose: () => void
  volume: number
  onVolumeChange: (vol: number) => void
  triggerRef: React.RefObject<HTMLElement | null>
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  // Position above the trigger button using its bounding rect (so the popup
  // escapes any overflow:hidden parents like the zone card).
  useEffect(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const update = () => {
      const r = trigger.getBoundingClientRect()
      const PANEL_W = 256
      const top = r.top - 8 // gap above the button; we anchor by bottom below
      const left = Math.min(
        Math.max(8, r.right - PANEL_W),
        window.innerWidth - PANEL_W - 8,
      )
      setPos({ top, left })
    }
    update()
    window.addEventListener("resize", update)
    window.addEventListener("scroll", update, true)
    return () => {
      window.removeEventListener("resize", update)
      window.removeEventListener("scroll", update, true)
    }
  }, [triggerRef])

  useEffect(() => {
    const handler = (e: PointerEvent) => {
      const target = e.target as Node
      if (
        ref.current && !ref.current.contains(target) &&
        triggerRef.current && !triggerRef.current.contains(target)
      ) {
        onClose()
      }
    }
    document.addEventListener("pointerdown", handler)
    return () => document.removeEventListener("pointerdown", handler)
  }, [onClose, triggerRef])

  if (typeof document === "undefined" || !pos) return null

  return createPortal(
    <div
      ref={ref}
      className="ts-deep-glass fixed z-[300] w-64 rounded-xl shadow-xl"
      style={{ top: pos.top, left: pos.left, transform: "translateY(-100%)" }}
    >
      <div className="flex items-center justify-between border-b border-border/20 px-3 py-2">
        <span className="text-xs font-semibold text-foreground/70">Connect to a device</span>
      </div>
      <div className="max-h-48 overflow-y-auto py-1">
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <div className="size-4 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground" />
          </div>
        ) : devices.length === 0 ? (
          <p className="px-3 py-3 text-center text-xs text-muted-foreground/50">
            No devices found. Open Spotify on a device first.
          </p>
        ) : (
          devices.map((device) => {
            const Icon = getDeviceIcon(device.type)
            return (
              <button
                key={device.id}
                onClick={() => onSelect(device.id)}
                className={cn(
                  "flex w-full min-h-11 items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-muted/30",
                  device.is_active && "bg-muted/20"
                )}
              >
                <Icon
                  className={cn(
                    "size-4 shrink-0",
                    device.is_active ? "text-green-500" : "text-muted-foreground/50"
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "truncate text-xs font-medium",
                      device.is_active ? "text-green-500" : "text-foreground/80"
                    )}
                  >
                    {device.name}
                  </p>
                  <p className="text-xs capitalize text-muted-foreground/40">
                    {device.type.toLowerCase().replace("_", " ")}
                  </p>
                </div>
                {device.is_active && (
                  <div className="size-2 shrink-0 rounded-full bg-green-500" />
                )}
              </button>
            )
          })
        )}
      </div>
      <div className="flex items-center gap-2 border-t border-border/20 px-3 py-2.5">
        <button
          onClick={() => onVolumeChange(volume === 0 ? 50 : 0)}
          className="shrink-0 text-muted-foreground/60 hover:text-foreground/80"
          title={volume === 0 ? "Unmute" : "Mute"}
        >
          {volume === 0 ? (
            <VolumeX className="size-3.5" />
          ) : volume < 50 ? (
            <Volume1 className="size-3.5" />
          ) : (
            <Volume2 className="size-3.5" />
          )}
        </button>
        <div className="flex-1">
          <VolumeSlider value={volume} onChange={onVolumeChange} />
        </div>
        <span className="w-8 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground/60">
          {Math.round(volume)}
        </span>
      </div>
    </div>,
    document.body,
  )
}

// ── Trigger wrappers (own a ref so the picker can position itself) ─────────

function ChooseDeviceTrigger({
  open, setOpen, fetchDevices, devices, loading, onSelect, sendVolume,
}: {
  open: boolean
  setOpen: (fn: (v: boolean) => boolean) => void
  fetchDevices: () => void
  devices: SpotifyDevice[]
  loading: boolean
  onSelect: (deviceId: string) => void
  sendVolume: (vol: number) => void
}) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => {
          setOpen((v) => !v)
          if (!open) fetchDevices()
        }}
        className="ts-inner-glass inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors"
      >
        <MonitorSpeaker className="size-3.5" />
        Choose Device
      </button>
      {open && (
        <DevicesAndVolumePicker
          devices={devices}
          loading={loading}
          onSelect={onSelect}
          onClose={() => setOpen(() => false)}
          volume={50}
          onVolumeChange={sendVolume}
          triggerRef={triggerRef}
        />
      )}
    </>
  )
}

function DeviceVolumeTrigger({
  open, setOpen, fetchDevices, devices, loading, onSelect, volume, sendVolume,
}: {
  open: boolean
  setOpen: (fn: (v: boolean) => boolean) => void
  fetchDevices: () => void
  devices: SpotifyDevice[]
  loading: boolean
  onSelect: (deviceId: string) => void
  volume: number
  sendVolume: (vol: number) => void
}) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  return (
    <>
      <Button
        ref={triggerRef}
        variant="ghost"
        size="icon-xs"
        onClick={() => {
          setOpen((v) => !v)
          if (!open) fetchDevices()
        }}
        className="text-muted-foreground/40 hover:text-foreground/70"
        title="Devices & volume"
      >
        <MonitorSpeaker className="size-3.5" />
      </Button>
      {open && (
        <DevicesAndVolumePicker
          devices={devices}
          loading={loading}
          onSelect={onSelect}
          onClose={() => setOpen(() => false)}
          volume={volume}
          onVolumeChange={sendVolume}
          triggerRef={triggerRef}
        />
      )}
    </>
  )
}

// ── Spotify auth (open OAuth popup) ─────────────────────────────────────────

function SpotifyAuth({ clientId, onComplete }: { clientId: string | null; onComplete: () => void }) {
  const { isSignedIn } = useAuth()
  const popupCheckRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [waitingExternal, setWaitingExternal] = useState(false)

  useEffect(() => {
    return () => {
      if (popupCheckRef.current) clearInterval(popupCheckRef.current)
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  // Build the auth URL. `pairCode` is embedded in `state` so the callback
  // page can post tokens back to /api/spotify/pair when there's no opener
  // (i.e. the user finishes auth in a different browser or device).
  async function buildAuthUrl(pairCode: string | null) {
    if (!clientId) return null

    const { codeVerifier, codeChallenge } = await generatePKCE()

    const openerOrigin = window.location.origin
    const redirectOrigin = openerOrigin.replace("://localhost", "://127.0.0.1")
    const callbackPath = isLocal ? "/spotify-callback" : "/api/spotify/callback"
    const redirectUri = `${redirectOrigin}${callbackPath}`

    const state = btoa(
      JSON.stringify({ v: codeVerifier, r: redirectUri, o: openerOrigin, p: pairCode }),
    )

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: "code",
      redirect_uri: redirectUri,
      scope: SPOTIFY_SCOPES,
      code_challenge_method: "S256",
      code_challenge: codeChallenge,
      state,
    })

    return `${SPOTIFY_AUTH_URL}?${params}`
  }

  function generatePairCode() {
    // 16 random hex chars — enough entropy, short enough to URL-encode cleanly.
    const bytes = new Uint8Array(8)
    crypto.getRandomValues(bytes)
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
  }

  // Poll the rendezvous until tokens arrive or we time out. On success we
  // forward the tokens through the existing same-window postMessage handler
  // so the parent's listener can save them just like the popup flow.
  function startPolling(pairCode: string) {
    if (pollRef.current) clearInterval(pollRef.current)
    setWaitingExternal(true)
    const startedAt = Date.now()
    const TIMEOUT = 10 * 60 * 1000 // 10 min, matches server TTL

    pollRef.current = setInterval(async () => {
      if (Date.now() - startedAt > TIMEOUT) {
        clearInterval(pollRef.current!)
        pollRef.current = null
        setWaitingExternal(false)
        toast.error("Spotify pairing timed out")
        return
      }
      try {
        const res = await fetch(`/api/spotify/pair?code=${encodeURIComponent(pairCode)}`)
        const data = await res.json()
        if (!data.pending && data.tokens) {
          clearInterval(pollRef.current!)
          pollRef.current = null
          setWaitingExternal(false)
          window.postMessage(
            { type: "spotify-auth", success: true, tokens: data.tokens },
            window.location.origin,
          )
          onComplete()
        }
      } catch {
        // ignore transient poll failures
      }
    }, 2000)
  }

  const connect = async () => {
    const url = await buildAuthUrl(null)
    if (!url) return

    const popup = window.open(
      url,
      "spotify-auth",
      "width=500,height=700,left=200,top=100",
    )

    if (popup) {
      if (popupCheckRef.current) clearInterval(popupCheckRef.current)
      popupCheckRef.current = setInterval(() => {
        if (popup.closed) {
          clearInterval(popupCheckRef.current!)
          popupCheckRef.current = null
          setTimeout(onComplete, 500)
        }
      }, 500)
    }
  }

  const copyAuthLink = async () => {
    const pairCode = generatePairCode()
    const url = await buildAuthUrl(pairCode)
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      toast.success("Auth link copied — open it in any browser")
    } catch {
      // Fallback: show the link in a prompt for manual copy
      window.prompt("Copy this link and open it in any browser:", url)
    }
    startPolling(pairCode)
  }

  const cancelExternal = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    setWaitingExternal(false)
  }

  return (
    <div className="zone-surface zone-media flex h-full flex-col">
      <div className="flex shrink-0 items-center px-4 py-1.5">
        <div className="flex items-center gap-2">
          <ZoneLabel accentVar="--zone-media-accent" icon={<Music className="size-4" />}>
            Now Playing
          </ZoneLabel>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6">
        <Music className="size-6" style={{ color: "var(--zone-media-accent)", opacity: 0.4 }} />
        {clientId ? (
          <>
            <p className="text-xs text-muted-foreground">
              Connect your Spotify account
            </p>
            {waitingExternal ? (
              <>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="inline-block size-2 animate-pulse rounded-full" style={{ background: "var(--zone-media-accent)" }} />
                  Waiting for sign-in in another browser…
                </div>
                <Button size="sm" variant="ghost" onClick={cancelExternal}>
                  Cancel
                </Button>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Button
                  size="sm"
                  onClick={connect}
                  className="gap-1.5"
                  style={{ background: "var(--zone-media-accent)" }}
                >
                  <Music className="size-3" />
                  Connect Spotify
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={copyAuthLink}
                  className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                  title="Copy a one-time auth link to finish sign-in in another browser or device"
                >
                  <Copy className="size-3" />
                  Copy link for another browser
                  <ExternalLink className="size-3 opacity-60" />
                </Button>
              </div>
            )}
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
