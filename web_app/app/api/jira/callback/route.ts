import { exchangeJiraCode } from "@/lib/jira/service"
import { getAuthUserId } from "@/lib/auth"

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
    return new Response(callbackPage(false, "No authorization code received"), {
      headers: { "Content-Type": "text/html" },
    })
  }

  const state = searchParams.get("state")
  if (!state) {
    return new Response(callbackPage(false, "Missing state parameter"), {
      headers: { "Content-Type": "text/html" },
    })
  }

  let redirectUri: string
  try {
    const decoded = JSON.parse(atob(state))
    redirectUri = decoded.r
  } catch {
    return new Response(callbackPage(false, "Invalid state parameter"), {
      headers: { "Content-Type": "text/html" },
    })
  }

  const result = await exchangeJiraCode(code, redirectUri, userId)

  if (!result) {
    return new Response(callbackPage(false, "Token exchange failed"), {
      headers: { "Content-Type": "text/html" },
    })
  }

  return new Response(callbackPage(true, `Connected ${result.email}`), {
    headers: { "Content-Type": "text/html" },
  })
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

function callbackPage(success: boolean, message: string): string {
  const safeMessage = escapeHtml(message)
  return `<!DOCTYPE html>
<html><head><title>Jira - Third Screen</title></head>
<body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#111;color:#fff">
<div style="text-align:center">
  <p style="font-size:1.25rem;font-weight:600">${safeMessage}</p>
  <p style="color:#888;margin-top:0.5rem">You can close this window.</p>
</div>
<script>
  if (window.opener) {
    window.opener.postMessage({ type: "jira-auth", success: ${success} }, window.location.origin);
  }
  setTimeout(() => window.close(), 1500);
</script>
</body></html>`
}
