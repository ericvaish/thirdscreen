// Centralized API keys read from environment variables.

export const ADMIN_KEYS = {
  spotifyClientId: "SPOTIFY_CLIENT_ID",
  spotifyClientSecret: "SPOTIFY_CLIENT_SECRET",
  googleClientId: "GOOGLE_CLIENT_ID",
  googleClientSecret: "GOOGLE_CLIENT_SECRET",
} as const

export function getAdminConfig(envKey: string): string | null {
  return process.env[envKey] ?? null
}
