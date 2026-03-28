// Shared Google OAuth constants for Gmail and Chat integrations
// Reuses the same OAuth endpoints as Google Calendar but with different scopes.

export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
export const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"

export const GMAIL_API = "https://gmail.googleapis.com/gmail/v1"
export const CHAT_API = "https://chat.googleapis.com/v1"

export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ")

export const CHAT_SCOPES = [
  "https://www.googleapis.com/auth/chat.messages.readonly",
  "https://www.googleapis.com/auth/chat.spaces.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ")
