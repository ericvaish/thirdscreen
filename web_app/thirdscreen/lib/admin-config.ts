// Centralized API keys read from environment variables.
// Set these in .env.local or your hosting provider's env config.

export const ADMIN_KEYS = {
  spotifyClientId: "SPOTIFY_CLIENT_ID",
  spotifyClientSecret: "SPOTIFY_CLIENT_SECRET",
  googleClientId: "GOOGLE_CLIENT_ID",
  googleClientSecret: "GOOGLE_CLIENT_SECRET",
} as const

export function getAdminConfig(envKey: string): string | null {
  return process.env[envKey] ?? null
}
