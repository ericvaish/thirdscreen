// Centralized API keys read from environment variables.
// On Cloudflare Workers, env vars are accessed via the request context,
// not process.env (which only works for build-time NEXT_PUBLIC_* vars).

import { getRequestContext } from "@cloudflare/next-on-pages"

export const ADMIN_KEYS = {
  spotifyClientId: "SPOTIFY_CLIENT_ID",
  spotifyClientSecret: "SPOTIFY_CLIENT_SECRET",
  googleClientId: "GOOGLE_CLIENT_ID",
  googleClientSecret: "GOOGLE_CLIENT_SECRET",
} as const

export function getAdminConfig(envKey: string): string | null {
  try {
    const { env } = getRequestContext()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const value = (env as any)[envKey]
    if (typeof value === "string" && value) return value
  } catch {
    // Fallback for non-Cloudflare environments (local dev)
  }
  return process.env[envKey] ?? null
}
