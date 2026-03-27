export const SPOTIFY_AUTH_URL = "https://accounts.spotify.com/authorize"
export const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token"
export const SPOTIFY_API_BASE = "https://api.spotify.com/v1"

export const SPOTIFY_SCOPES = [
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
  "streaming",
  "user-read-email",
  "user-read-private",
].join(" ")

// Settings keys used in the DB
export const SETTINGS_KEYS = {
  clientId: "spotify_client_id",
  accessToken: "spotify_access_token",
  refreshToken: "spotify_refresh_token",
  tokenExpiry: "spotify_token_expiry",
} as const
