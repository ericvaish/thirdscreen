import { Auth0Client } from "@auth0/nextjs-auth0/server"
import { NextResponse } from "next/server"

/**
 * Auth0 client for app-level authentication.
 *
 * Config comes from the environment (see .env.example):
 *   AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET, AUTH0_SECRET,
 *   APP_BASE_URL
 *
 * The SDK mounts /auth/login, /auth/callback, /auth/logout and friends via
 * middleware.ts. These are unrelated to the Google Calendar / Gmail OAuth
 * flows under /api/google-*, which use GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET.
 */
export const auth0 = new Auth0Client({
  authorizationParameters: {
    scope: "openid profile email",
  },
  // Send callback failures back to the branded sign-in page instead of the
  // SDK's default plain-text 500.
  async onCallback(error, ctx) {
    // ctx has no base URL when /auth/callback is hit outside a real login
    // transaction, and Next's middleware only accepts absolute redirects.
    const base = ctx.appBaseUrl ?? process.env.APP_BASE_URL
    if (error) {
      const code = (error as { code?: string }).code ?? "callback_failed"
      if (!base) {
        return new NextResponse(`Sign-in failed (${code}).`, { status: 400 })
      }
      return NextResponse.redirect(
        new URL(`/sign-in?error=${encodeURIComponent(code)}`, base),
      )
    }
    // The SDK attaches the session cookie to whatever response comes back.
    return NextResponse.redirect(new URL(ctx.returnTo || "/app", base))
  },
})
