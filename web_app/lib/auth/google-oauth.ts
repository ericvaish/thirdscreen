// Google OAuth (server-side) for app-level authentication.
// Separate from Google Calendar / Gmail / Chat OAuth — different scopes
// and a different client ID.

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"

export const GOOGLE_AUTH_SCOPES = ["openid", "email", "profile"].join(" ")

export function getRedirectUri(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL
  if (!base) {
    throw new Error("NEXT_PUBLIC_APP_URL is not set")
  }
  return `${base.replace(/\/$/, "")}/api/auth/google/callback`
}

export function getClientId(): string {
  const id = process.env.GOOGLE_OAUTH_CLIENT_ID
  if (!id) throw new Error("GOOGLE_OAUTH_CLIENT_ID is not set")
  return id
}

function getClientSecret(): string {
  const s = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  if (!s) throw new Error("GOOGLE_OAUTH_CLIENT_SECRET is not set")
  return s
}

export function buildAuthUrl(state: string, returnTo?: string): string {
  const params = new URLSearchParams({
    client_id: getClientId(),
    redirect_uri: getRedirectUri(),
    response_type: "code",
    scope: GOOGLE_AUTH_SCOPES,
    access_type: "online",
    prompt: "select_account",
    state,
  })
  // returnTo is encoded inside `state` server-side, but we keep this signature
  // for clarity — the caller wraps state with returnTo.
  void returnTo
  return `${GOOGLE_AUTH_URL}?${params.toString()}`
}

export interface GoogleTokens {
  access_token: string
  id_token: string
  expires_in: number
  scope: string
  token_type: string
  refresh_token?: string
}

export async function exchangeCode(code: string): Promise<GoogleTokens> {
  const body = new URLSearchParams({
    code,
    client_id: getClientId(),
    client_secret: getClientSecret(),
    redirect_uri: getRedirectUri(),
    grant_type: "authorization_code",
  })

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Google token exchange failed: ${res.status} ${text}`)
  }
  return (await res.json()) as GoogleTokens
}

export interface GoogleUser {
  sub: string
  email: string
  email_verified?: boolean
  name?: string
  picture?: string
}

export async function fetchUserinfo(
  accessToken: string,
): Promise<GoogleUser> {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Google userinfo failed: ${res.status} ${text}`)
  }
  return (await res.json()) as GoogleUser
}
