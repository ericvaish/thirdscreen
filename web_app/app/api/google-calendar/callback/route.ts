export const runtime = "edge"

import { exchangeGoogleCode } from "@/lib/google-calendar/service"
import { getAuthUserId } from "@/lib/auth"

// GET /api/google-calendar/callback?code=...&state=...
// Google redirects here after user authorizes
export async function GET(request: Request) {
  const [userId, authError] = await getAuthUserId()
    if (authError) return authError
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const error = searchParams.get("error")

  if (error) {
    return new Response(callbackPage(false, "Authorization denied"), {
      headers: { "Content-Type": "text/html" },
    })
  }

  if (!code) {
    return new Response(
      callbackPage(false, "No authorization code received"),
      { headers: { "Content-Type": "text/html" } }
    )
  }

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

  const result = await exchangeGoogleCode(code, codeVerifier, redirectUri, userId)

  if (!result) {
    return new Response(callbackPage(false, "Token exchange failed"), {
      headers: { "Content-Type": "text/html" },
    })
  }

  return new Response(
    callbackPage(true, `Connected ${result.email}`),
    { headers: { "Content-Type": "text/html" } }
  )
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

function callbackPage(success: boolean, message: string): string {
  const safeMessage = escapeHtml(message)
  return `<!DOCTYPE html>
<html><head><title>Google Calendar - Third Screen</title></head>
<body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#111;color:#fff">
<div style="text-align:center">
  <p style="font-size:1.25rem;font-weight:600">${safeMessage}</p>
  <p style="color:#888;margin-top:0.5rem">You can close this window.</p>
</div>
<script>
  if (window.opener) {
    window.opener.postMessage({ type: "google-calendar-auth", success: ${success} }, window.location.origin);
  }
  setTimeout(() => window.close(), 1500);
</script>
</body></html>`
}
