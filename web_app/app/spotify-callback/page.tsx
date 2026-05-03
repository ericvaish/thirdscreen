"use client"

import { useEffect, useState } from "react"
import { SPOTIFY_TOKEN_URL } from "@/lib/spotify/constants"

// Client-side OAuth callback for local-mode Spotify.
// Exchanges the code for tokens, then sends them back to the opener
// via postMessage so the opener saves them to its own localStorage
// (avoids cross-origin localStorage issues with localhost vs 127.0.0.1).

export default function SpotifyCallbackPage() {
  const [message, setMessage] = useState("Connecting to Spotify...")
  const [done, setDone] = useState(false)

  useEffect(() => {
    async function handleCallback() {
      const params = new URLSearchParams(window.location.search)
      const code = params.get("code")
      const error = params.get("error")
      const stateParam = params.get("state")

      if (error) {
        finish(false, "Authorization denied")
        return
      }

      if (!code || !stateParam) {
        finish(false, "Missing authorization data")
        return
      }

      let codeVerifier: string
      let redirectUri: string
      let openerOrigin: string
      let pairCode: string | null = null
      try {
        const decoded = JSON.parse(atob(stateParam))
        codeVerifier = decoded.v
        redirectUri = decoded.r
        openerOrigin = decoded.o
        pairCode = decoded.p ?? null
      } catch {
        finish(false, "Invalid state parameter")
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
        finish(false, "Could not retrieve Spotify configuration")
        return
      }

      // Exchange code for tokens directly with Spotify (CORS-enabled for PKCE)
      try {
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

        if (!res.ok) {
          finish(false, "Token exchange failed")
          return
        }

        const tokens = await res.json()

        const tokenPayload = {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_in: tokens.expires_in,
        }

        // Same-browser flow: postMessage straight back to the opener.
        if (window.opener) {
          window.opener.postMessage(
            { type: "spotify-auth", success: true, tokens: tokenPayload },
            openerOrigin,
          )
        }

        // Cross-browser flow: hand the tokens off via the pairing rendezvous
        // so a different browser/device that started the flow can pick them up.
        if (pairCode) {
          try {
            await fetch("/api/spotify/pair", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ code: pairCode, tokens: tokenPayload }),
            })
          } catch {}
        }

        setMessage("Connected to Spotify!")
        setDone(true)
        // Only auto-close if a popup opened us; otherwise leave the page so
        // the user can confirm visually before closing the tab themselves.
        if (window.opener) setTimeout(() => window.close(), 1200)
      } catch {
        finish(false, "Token exchange failed")
      }
    }

    handleCallback()
  }, [])

  function finish(success: boolean, msg: string) {
    setMessage(msg)
    setDone(!success) // show "Please wait..." only while working
    if (window.opener) {
      window.opener.postMessage(
        { type: "spotify-auth", success },
        window.location.origin
      )
    }
    setTimeout(() => window.close(), 2000)
  }

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
          {done ? "You can close this window." : "Please wait..."}
        </p>
      </div>
    </div>
  )
}
