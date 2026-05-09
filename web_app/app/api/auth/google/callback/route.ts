import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { exchangeCode, fetchUserinfo } from "@/lib/auth/google-oauth"
import { setSessionCookie } from "@/lib/auth/session"
import { getDb } from "@/lib/get-db"
import { users } from "@/db/schema"
import { eq } from "drizzle-orm"

const STATE_COOKIE = "ts_oauth_state"

function appBase(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "")
}

function errorRedirect(reason: string): NextResponse {
  const base = appBase() || ""
  return NextResponse.redirect(
    `${base}/sign-in?error=${encodeURIComponent(reason)}`,
  )
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get("code")
  const stateParam = url.searchParams.get("state")
  const errorParam = url.searchParams.get("error")

  if (errorParam) return errorRedirect(errorParam)
  if (!code || !stateParam) return errorRedirect("missing_code")

  const [nonce, returnToEnc] = stateParam.split(":")
  const returnTo = returnToEnc ? decodeURIComponent(returnToEnc) : "/app"

  const cookieStore = await cookies()
  const expectedNonce = cookieStore.get(STATE_COOKIE)?.value
  if (!expectedNonce || expectedNonce !== nonce) {
    return errorRedirect("state_mismatch")
  }

  let tokens
  try {
    tokens = await exchangeCode(code)
  } catch {
    return errorRedirect("token_exchange_failed")
  }

  let userInfo
  try {
    userInfo = await fetchUserinfo(tokens.access_token)
  } catch {
    return errorRedirect("userinfo_failed")
  }

  if (!userInfo.email) return errorRedirect("missing_email")

  const now = Date.now()
  const db = getDb()
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.id, userInfo.sub))
    .limit(1)

  if (existing.length === 0) {
    await db.insert(users).values({
      id: userInfo.sub,
      email: userInfo.email,
      name: userInfo.name ?? null,
      avatarUrl: userInfo.picture ?? null,
      createdAt: now,
      lastLoginAt: now,
    })
  } else {
    await db
      .update(users)
      .set({
        email: userInfo.email,
        name: userInfo.name ?? null,
        avatarUrl: userInfo.picture ?? null,
        lastLoginAt: now,
      })
      .where(eq(users.id, userInfo.sub))
  }

  const safeReturnTo = returnTo.startsWith("/") ? returnTo : "/app"
  const res = NextResponse.redirect(`${appBase()}${safeReturnTo}`)
  await setSessionCookie(res, {
    sub: userInfo.sub,
    email: userInfo.email,
    name: userInfo.name ?? null,
    picture: userInfo.picture ?? null,
  })
  res.cookies.set({
    name: STATE_COOKIE,
    value: "",
    httpOnly: true,
    path: "/",
    maxAge: 0,
  })
  return res
}
