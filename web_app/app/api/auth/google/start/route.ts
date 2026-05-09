import { NextResponse } from "next/server"
import { buildAuthUrl } from "@/lib/auth/google-oauth"

const STATE_COOKIE = "ts_oauth_state"

function randomState(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const returnTo = url.searchParams.get("return_to") ?? "/app"

  const nonce = randomState()
  // Encode return path inside state so callback can validate + redirect.
  const state = `${nonce}:${encodeURIComponent(returnTo)}`

  const authUrl = buildAuthUrl(state)
  const res = NextResponse.redirect(authUrl)
  res.cookies.set({
    name: STATE_COOKIE,
    value: nonce,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  })
  return res
}
