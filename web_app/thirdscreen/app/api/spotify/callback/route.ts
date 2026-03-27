export const runtime = "edge"

import { NextResponse } from "next/server"
import { exchangeCode } from "@/lib/spotify/service"
import { getAuthUserId } from "@/lib/auth"

// GET /api/spotify/callback?code=...&state=...
// Spotify redirects here after user authorizes
export async function GET(request: Request) {
  const [userId, authError] = await getAuthUserId()
    if (authError) return authError
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const error = searchParams.get("error")

  if (error) {
    // User denied access
    return new Response(callbackPage(false, "Authorization denied"), {
      headers: { "Content-Type": "text/html" },
    })
  }

  if (!code) {
    return new Response(callbackPage(false, "No authorization code received"), {
      headers: { "Content-Type": "text/html" },
    })
  }

  // Retrieve the code verifier from the state parameter
  // We encode it as: codeVerifier:redirectUri
  const state = searchParams.get("state")
  if (!state) {
    return new Response(callbackPage(false, "Missing state parameter"), {
      headers: { "Content-Type": "text/html" },
    })
  }

  let codeVerifier: string
  let redirectUri: string
  try {
    const decoded = JSON.parse(atob(state))
    codeVerifier = decoded.v
    redirectUri = decoded.r
  } catch {
    return new Response(callbackPage(false, "Invalid state parameter"), {
      headers: { "Content-Type": "text/html" },
    })
  }

  const success = await exchangeCode(code, codeVerifier, redirectUri, userId)

  if (!success) {
    return new Response(callbackPage(false, "Token exchange failed"), {
      headers: { "Content-Type": "text/html" },
    })
  }

  return new Response(callbackPage(true, "Connected to Spotify!"), {
    headers: { "Content-Type": "text/html" },
  })
}

// Minimal HTML page that auto-closes and notifies the opener
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

function callbackPage(success: boolean, message: string): string {
  const safeMessage = escapeHtml(message)
  return `<!DOCTYPE html>
<html><head><title>Spotify - Third Screen</title></head>
<body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#111;color:#fff">
<div style="text-align:center">
  <p style="font-size:1.25rem;font-weight:600">${safeMessage}</p>
  <p style="color:#888;margin-top:0.5rem">You can close this window.</p>
</div>
<script>
  if (window.opener) {
    window.opener.postMessage({ type: "spotify-auth", success: ${success} }, window.location.origin);
  }
  setTimeout(() => window.close(), 1500);
</script>
</body></html>`
}
