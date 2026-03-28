import { getDb } from "@/lib/get-db"
import { calendarAccounts, settings } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import {
  GOOGLE_TOKEN_URL,
  GOOGLE_CALENDAR_API,
  GOOGLE_USERINFO_URL,
  GOOGLE_CLIENT_ID_KEY,
} from "./constants"
import { getAdminConfig, ADMIN_KEYS } from "@/lib/admin-config"

// ── DB helpers ──────────────────────────────────────────────────────────────

async function getSetting(key: string, userId: string): Promise<unknown> {
  const [row] = await getDb()
    .select()
    .from(settings)
    .where(and(eq(settings.key, key), eq(settings.userId, userId)))
  return row?.value ?? null
}

export async function getClientId(userId: string = ""): Promise<string | null> {
  // Admin-provided env var takes priority, then per-user DB setting
  const envClientId = getAdminConfig(ADMIN_KEYS.googleClientId)
  if (envClientId) return envClientId
  return (await getSetting(GOOGLE_CLIENT_ID_KEY, userId)) as string | null
}

// ── Account types ───────────────────────────────────────────────────────────

export interface GoogleCalendarAccount {
  id: string
  userId: string
  provider: "google"
  email: string
  accessToken: string
  refreshToken: string
  tokenExpiry: number
  calendarIds: string[]
  color: string | null
  createdAt: string
}

export interface GoogleCalendarEvent {
  id: string
  title: string
  startTime: string // HH:MM
  endTime: string // HH:MM
  allDay: boolean
  color: string | null
  location: string | null
  description: string | null
  date: string // YYYY-MM-DD
  accountEmail: string
  meetingLink: string | null
  htmlLink: string | null
  organizer: string | null
  attendees: { email: string; name: string | null; status: string }[] | null
  source: "google"
}

// ── Account CRUD ────────────────────────────────────────────────────────────

export async function listGoogleAccounts(userId: string = ""): Promise<GoogleCalendarAccount[]> {
  const rows = await getDb()
    .select()
    .from(calendarAccounts)
    .where(
      and(
        eq(calendarAccounts.provider, "google"),
        eq(calendarAccounts.userId, userId)
      )
    )

  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    provider: "google" as const,
    email: r.email,
    accessToken: r.accessToken,
    refreshToken: r.refreshToken,
    tokenExpiry: r.tokenExpiry,
    calendarIds: r.calendarIds as string[],
    color: r.color,
    createdAt: r.createdAt,
  }))
}

export async function getGoogleAccount(
  id: string,
  userId: string = ""
): Promise<GoogleCalendarAccount | null> {
  const [row] = await getDb()
    .select()
    .from(calendarAccounts)
    .where(
      and(
        eq(calendarAccounts.id, id),
        eq(calendarAccounts.provider, "google"),
        eq(calendarAccounts.userId, userId)
      )
    )

  if (!row) return null
  return {
    id: row.id,
    userId: row.userId,
    provider: "google",
    email: row.email,
    accessToken: row.accessToken,
    refreshToken: row.refreshToken,
    tokenExpiry: row.tokenExpiry,
    calendarIds: row.calendarIds as string[],
    color: row.color,
    createdAt: row.createdAt,
  }
}

export async function removeGoogleAccount(id: string, userId: string = ""): Promise<void> {
  await getDb()
    .delete(calendarAccounts)
    .where(
      and(
        eq(calendarAccounts.id, id),
        eq(calendarAccounts.provider, "google"),
        eq(calendarAccounts.userId, userId)
      )
    )
}

// ── Token exchange & refresh ────────────────────────────────────────────────

export async function exchangeGoogleCode(
  code: string,
  codeVerifier: string,
  redirectUri: string,
  userId: string = ""
): Promise<{ accountId: string; email: string } | null> {
  const clientId = await getClientId(userId)
  if (!clientId) return null

  // Exchange authorization code for tokens
  // Google requires client_secret for web app token exchange (unlike Spotify PKCE)
  const clientSecret = getAdminConfig(ADMIN_KEYS.googleClientSecret)
  const tokenBody: Record<string, string> = {
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: codeVerifier,
  }
  if (clientSecret) {
    tokenBody.client_secret = clientSecret
  }

  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(tokenBody),
  })

  if (!tokenRes.ok) {
    console.error("Google token exchange failed:", tokenRes.status, await tokenRes.text())
    return null
  }
  const tokenData = await tokenRes.json()

  const accessToken = tokenData.access_token as string
  const refreshToken = tokenData.refresh_token as string
  const expiresIn = tokenData.expires_in as number
  const tokenExpiry = Date.now() + expiresIn * 1000

  // Fetch user email
  const userRes = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!userRes.ok) return null
  const userData = await userRes.json()
  const email = userData.email as string

  // Check if this account already exists (same email + userId)
  const existing = await getDb()
    .select()
    .from(calendarAccounts)
    .where(
      and(
        eq(calendarAccounts.provider, "google"),
        eq(calendarAccounts.email, email),
        eq(calendarAccounts.userId, userId)
      )
    )

  if (existing.length > 0) {
    // Update tokens for existing account
    const accountId = existing[0].id
    await getDb()
      .update(calendarAccounts)
      .set({ accessToken, refreshToken, tokenExpiry })
      .where(eq(calendarAccounts.id, accountId))
    return { accountId, email }
  }

  // Create new account
  const { v4: uuid } = await import("uuid")
  const accountId = uuid()

  // Assign a color based on how many Google accounts exist
  const accountColors = [
    "#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#ec4899", "#06b6d4",
  ]
  const count = existing.length
  const color = accountColors[count % accountColors.length]

  await getDb().insert(calendarAccounts).values({
    id: accountId,
    userId,
    provider: "google",
    email,
    accessToken,
    refreshToken,
    tokenExpiry,
    calendarIds: [],
    color,
    createdAt: new Date().toISOString(),
  })

  return { accountId, email }
}

async function refreshGoogleToken(
  account: GoogleCalendarAccount
): Promise<string | null> {
  const clientId = await getClientId(account.userId)
  if (!clientId) return null

  const refreshBody: Record<string, string> = {
    grant_type: "refresh_token",
    refresh_token: account.refreshToken,
    client_id: clientId,
  }
  const clientSecret = getAdminConfig(ADMIN_KEYS.googleClientSecret)
  if (clientSecret) {
    refreshBody.client_secret = clientSecret
  }

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(refreshBody),
  })

  if (!res.ok) return null
  const data = await res.json()

  const newToken = data.access_token as string
  const expiresIn = data.expires_in as number
  const newExpiry = Date.now() + expiresIn * 1000

  await getDb()
    .update(calendarAccounts)
    .set({
      accessToken: newToken,
      tokenExpiry: newExpiry,
      ...(data.refresh_token ? { refreshToken: data.refresh_token } : {}),
    })
    .where(eq(calendarAccounts.id, account.id))

  return newToken
}

async function getValidToken(
  account: GoogleCalendarAccount
): Promise<string | null> {
  // Refresh 60s before expiry
  if (Date.now() > account.tokenExpiry - 60_000) {
    return refreshGoogleToken(account)
  }
  return account.accessToken
}

// ── Event fetching ──────────────────────────────────────────────────────────

function parseGoogleDateTime(
  dt: { dateTime?: string; date?: string },
  fallbackDate: string
): { time: string; date: string; allDay: boolean } {
  if (dt.date) {
    // All-day event
    return { time: "00:00", date: dt.date, allDay: true }
  }
  if (dt.dateTime) {
    const d = new Date(dt.dateTime)
    const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    return { time, date, allDay: false }
  }
  return { time: "00:00", date: fallbackDate, allDay: true }
}

export async function fetchEventsForAccount(
  account: GoogleCalendarAccount,
  date: string
): Promise<GoogleCalendarEvent[]> {
  const token = await getValidToken(account)
  if (!token) return []

  // Build time range for the day
  const dayStart = `${date}T00:00:00Z`
  const dayEnd = `${date}T23:59:59Z`

  // Determine which calendars to fetch
  const calendarIds =
    account.calendarIds.length > 0 ? account.calendarIds : ["primary"]

  const allEvents: GoogleCalendarEvent[] = []

  for (const calId of calendarIds) {
    try {
      const params = new URLSearchParams({
        timeMin: dayStart,
        timeMax: dayEnd,
        singleEvents: "true",
        orderBy: "startTime",
        maxResults: "50",
      })

      const res = await fetch(
        `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calId)}/events?${params}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )

      if (!res.ok) continue
      const data = await res.json()

      for (const item of data.items ?? []) {
        if (item.status === "cancelled") continue

        const start = parseGoogleDateTime(item.start, date)
        const end = parseGoogleDateTime(item.end, date)

        // Extract meeting link from conferenceData or description
        let meetingLink: string | null = null
        if (item.conferenceData?.entryPoints) {
          const videoEntry = item.conferenceData.entryPoints.find(
            (ep: { entryPointType: string; uri: string }) => ep.entryPointType === "video"
          )
          if (videoEntry) meetingLink = videoEntry.uri
        }
        if (!meetingLink && item.hangoutLink) {
          meetingLink = item.hangoutLink
        }

        // Extract attendees
        const attendees = item.attendees
          ? item.attendees.map((a: { email: string; displayName?: string; responseStatus?: string }) => ({
              email: a.email,
              name: a.displayName ?? null,
              status: a.responseStatus ?? "needsAction",
            }))
          : null

        allEvents.push({
          id: `gcal-${account.id}-${item.id}`,
          title: item.summary ?? "(No title)",
          startTime: start.time,
          endTime: end.time,
          allDay: start.allDay,
          color: account.color,
          location: item.location ?? null,
          description: item.description ?? null,
          date: start.date,
          accountEmail: account.email,
          meetingLink,
          htmlLink: item.htmlLink ?? null,
          organizer: item.organizer?.displayName ?? item.organizer?.email ?? null,
          attendees,
          source: "google",
        })
      }
    } catch {
      // Skip failed calendar, continue with others
    }
  }

  return allEvents
}

/** Fetch events from ALL connected Google accounts for a given date */
export async function fetchAllGoogleEvents(
  date: string,
  userId: string = ""
): Promise<GoogleCalendarEvent[]> {
  const accounts = await listGoogleAccounts(userId)
  const results = await Promise.all(
    accounts.map((a) => fetchEventsForAccount(a, date))
  )
  return results.flat()
}
