export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
export const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3"
export const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ")

// Settings key for the Google OAuth client ID (user-provided)
export const GOOGLE_CLIENT_ID_KEY = "google_calendar_client_id"
