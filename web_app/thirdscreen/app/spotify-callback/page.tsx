"use client"

import { useEffect, useState } from "react"
import { exchangeCodeLocally } from "@/lib/spotify/local-spotify"

export default function SpotifyCallbackPage() {
  const [message, setMessage] = useState("Connecting to Spotify...")
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    async function handleCallback() {
      const params = new URLSearchParams(window.location.search)
      const code = params.get("code")
      const error = params.get("error")
      const stateParam = params.get("state")

      if (error) {
        setMessage("Authorization denied")
        notifyOpener(false)
        return
      }

      if (!code || !stateParam) {
        setMessage("Missing authorization data")
        notifyOpener(false)
        return
      }

      let codeVerifier: string
      let redirectUri: string
      try {
        const decoded = JSON.parse(atob(stateParam))
        codeVerifier = decoded.v
        redirectUri = decoded.r
      } catch {
        setMessage("Invalid state parameter")
        notifyOpener(false)
        return
      }

      // Fetch client ID from public endpoint
      let clientId: string | null = null
      try {
        const res = await fetch("/api/spotify/client-id")
        const data = await res.json()
        clientId = data.clientId
      } catch {}

      if (!clientId) {
        setMessage("Could not retrieve Spotify configuration")
        notifyOpener(false)
        return
      }

      const ok = await exchangeCodeLocally(code, codeVerifier, redirectUri, clientId)

      if (ok) {
        setMessage("Connected to Spotify!")
        setSuccess(true)
        notifyOpener(true)
      } else {
        setMessage("Token exchange failed")
        notifyOpener(false)
      }
    }

    handleCallback()
  }, [])

  return (
    <div
      style={{
        fontFamily: "system-ui",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        margin: 0,
        background: "#111",
        color: "#fff",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: "1.25rem", fontWeight: 600 }}>{message}</p>
        <p style={{ color: "#888", marginTop: "0.5rem" }}>
          {success ? "You can close this window." : "Please wait..."}
        </p>
      </div>
    </div>
  )
}

function notifyOpener(success: boolean) {
  if (window.opener) {
    window.opener.postMessage(
      { type: "spotify-auth", success },
      window.location.origin
    )
  }
  setTimeout(() => window.close(), 1500)
}
