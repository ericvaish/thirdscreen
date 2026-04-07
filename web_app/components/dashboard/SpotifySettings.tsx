"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Music, CheckCircle2, Loader2, Unplug } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { generatePKCE } from "@/lib/spotify/pkce"
import { SPOTIFY_AUTH_URL, SPOTIFY_SCOPES } from "@/lib/spotify/constants"
import { getLocalSpotifyTokens, clearLocalSpotifyTokens, saveLocalSpotifyTokens } from "@/lib/spotify/local-spotify"
import { isLocal } from "@/lib/data-layer"
import { useAuth } from "@clerk/nextjs"

type Phase = "loading" | "needs-client-id" | "needs-auth" | "connected"

export function SpotifySettings() {
  const { isSignedIn } = useAuth()
  const [phase, setPhase] = useState<Phase>("loading")
  const [clientId, setClientId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const popupCheckRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchState = useCallback(async () => {
    try {
      if (isLocal) {
        const cidRes = await fetch("/api/spotify/client-id")
        const cidData = await cidRes.json()
        const cid = cidData.clientId ?? null
        setClientId(cid)
        if (!cid) { setPhase("needs-client-id"); return }
        const tokens = getLocalSpotifyTokens()
        setPhase(tokens.accessToken ? "connected" : "needs-auth")
        return
      }

      const res = await fetch("/api/spotify")
      if (res.status === 401) { setPhase("needs-auth"); return }
      if (!res.ok) { setPhase("needs-client-id"); return }
      const data = await res.json()
      if (data.needsClientId) {
        setPhase("needs-client-id")
      } else if (!data.connected) {
        setClientId(data.clientId ?? null)
        setPhase("needs-auth")
      } else {
        setPhase("connected")
        if (data.playback?.artist) {
          setUserEmail(null) // we don't get email from playback, but we know it's connected
        }
      }
    } catch {
      setPhase("needs-client-id")
    }
  }, [])

  useEffect(() => { fetchState() }, [fetchState])

  // Listen for auth callback from popup
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return
      if (e.data?.type !== "spotify-auth") return
      if (isLocal && e.data.success && e.data.tokens) {
        saveLocalSpotifyTokens(e.data.tokens)
      }
      if (e.data.success) {
        toast.success("Connected to Spotify")
        fetchState()
      }
    }
    window.addEventListener("message", handler)
    return () => window.removeEventListener("message", handler)
  }, [fetchState])

  useEffect(() => {
    return () => { if (popupCheckRef.current) clearInterval(popupCheckRef.current) }
  }, [])

  const connect = async () => {
    const cid = clientId
    if (!cid) return

    const { codeVerifier, codeChallenge } = await generatePKCE()
    const openerOrigin = window.location.origin
    const redirectOrigin = openerOrigin.replace("://localhost", "://127.0.0.1")
    const callbackPath = isLocal ? "/spotify-callback" : "/api/spotify/callback"
    const redirectUri = `${redirectOrigin}${callbackPath}`
    const state = btoa(JSON.stringify({ v: codeVerifier, r: redirectUri, o: openerOrigin }))

    const params = new URLSearchParams({
      client_id: cid,
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
      if (popupCheckRef.current) clearInterval(popupCheckRef.current)
      popupCheckRef.current = setInterval(() => {
        if (popup.closed) {
          clearInterval(popupCheckRef.current!)
          popupCheckRef.current = null
          setTimeout(fetchState, 500)
        }
      }, 500)
    }
  }

  const disconnect = async () => {
    if (isLocal) {
      clearLocalSpotifyTokens()
    } else {
      await fetch("/api/spotify", { method: "DELETE" })
    }
    toast.success("Disconnected from Spotify")
    fetchState()
  }

  if (phase === "loading") {
    return <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
  }

  if (phase === "needs-client-id") {
    return <span className="text-xs text-muted-foreground/40">Not configured</span>
  }

  if (phase === "connected") {
    return (
      <div className="flex items-center gap-2">
        <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
        <span className="text-xs text-muted-foreground">Connected</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={disconnect}
          className="h-7 gap-1 px-2 text-xs text-muted-foreground/50 hover:text-destructive"
        >
          <Unplug className="size-3" />
        </Button>
      </div>
    )
  }

  // needs-auth
  return (
    <Button
      size="sm"
      onClick={connect}
      className="h-8 gap-1.5 text-xs"
      variant="outline"
    >
      Connect
    </Button>
  )
}
