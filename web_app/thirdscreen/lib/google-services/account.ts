// Shared account management for Google service accounts (Gmail, Chat).
// Mirrors the pattern in google-calendar/service.ts but uses the
// google_service_accounts table.

import { getDb } from "@/lib/get-db"
import { googleServiceAccounts } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { GOOGLE_TOKEN_URL, GOOGLE_USERINFO_URL } from "./constants"
import { getAdminConfig, ADMIN_KEYS } from "@/lib/admin-config"

export type GoogleServiceType = "gmail" | "chat"

export interface GoogleServiceAccount {
  id: string
  userId: string
  service: GoogleServiceType
  email: string
  accessToken: string
  refreshToken: string
  tokenExpiry: number
  createdAt: string
}

// ── Client ID (shared with Calendar) ───────────────────────────────────────

export function getGoogleClientId(): string | null {
  return getAdminConfig(ADMIN_KEYS.googleClientId)
}

// ── Account CRUD ───────────────────────────────────────────────────────────

export async function listServiceAccounts(
  service: GoogleServiceType,
  userId: string = ""
): Promise<GoogleServiceAccount[]> {
  const rows = await getDb()
    .select()
    .from(googleServiceAccounts)
    .where(
      and(
        eq(googleServiceAccounts.service, service),
        eq(googleServiceAccounts.userId, userId)
      )
    )
  return rows as GoogleServiceAccount[]
}

export async function removeServiceAccount(
  id: string,
  service: GoogleServiceType,
  userId: string = ""
): Promise<void> {
  await getDb()
    .delete(googleServiceAccounts)
    .where(
      and(
        eq(googleServiceAccounts.id, id),
        eq(googleServiceAccounts.service, service),
        eq(googleServiceAccounts.userId, userId)
      )
    )
}

// ── Token exchange & refresh ───────────────────────────────────────────────

export async function exchangeCode(
  service: GoogleServiceType,
  code: string,
  codeVerifier: string,
  redirectUri: string,
  userId: string = ""
): Promise<{ accountId: string; email: string } | null> {
  const clientId = getGoogleClientId()
  if (!clientId) return null

  const clientSecret = getAdminConfig(ADMIN_KEYS.googleClientSecret)
  const tokenBody: Record<string, string> = {
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: codeVerifier,
  }
  if (clientSecret) tokenBody.client_secret = clientSecret

  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(tokenBody),
  })

  if (!tokenRes.ok) {
    console.error(`Google ${service} token exchange failed:`, tokenRes.status, await tokenRes.text())
    return null
  }

  const tokenData: { access_token: string; refresh_token: string; expires_in: number } = await tokenRes.json()
  const accessToken = tokenData.access_token
  const refreshToken = tokenData.refresh_token
  const expiresIn = tokenData.expires_in
  const tokenExpiry = Date.now() + expiresIn * 1000

  // Fetch user email
  const userRes = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!userRes.ok) return null
  const userData: { email: string } = await userRes.json()
  const email = userData.email

  // Upsert: update tokens if account exists, else create
  const existing = await getDb()
    .select()
    .from(googleServiceAccounts)
    .where(
      and(
        eq(googleServiceAccounts.service, service),
        eq(googleServiceAccounts.email, email),
        eq(googleServiceAccounts.userId, userId)
      )
    )

  if (existing.length > 0) {
    const accountId = existing[0].id
    await getDb()
      .update(googleServiceAccounts)
      .set({ accessToken, refreshToken, tokenExpiry })
      .where(eq(googleServiceAccounts.id, accountId))
    return { accountId, email }
  }

  const { v4: uuid } = await import("uuid")
  const accountId = uuid()

  await getDb().insert(googleServiceAccounts).values({
    id: accountId,
    userId,
    service,
    email,
    accessToken,
    refreshToken,
    tokenExpiry,
    createdAt: new Date().toISOString(),
  })

  return { accountId, email }
}

async function refreshToken(
  account: GoogleServiceAccount
): Promise<string | null> {
  const clientId = getGoogleClientId()
  if (!clientId) return null

  const refreshBody: Record<string, string> = {
    grant_type: "refresh_token",
    refresh_token: account.refreshToken,
    client_id: clientId,
  }
  const clientSecret = getAdminConfig(ADMIN_KEYS.googleClientSecret)
  if (clientSecret) refreshBody.client_secret = clientSecret

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(refreshBody),
  })

  if (!res.ok) return null
  const data: { access_token: string; expires_in: number; refresh_token?: string } = await res.json()

  const newToken = data.access_token
  const expiresIn = data.expires_in
  const newExpiry = Date.now() + expiresIn * 1000

  await getDb()
    .update(googleServiceAccounts)
    .set({
      accessToken: newToken,
      tokenExpiry: newExpiry,
      ...(data.refresh_token ? { refreshToken: data.refresh_token } : {}),
    })
    .where(eq(googleServiceAccounts.id, account.id))

  return newToken
}

export async function getValidToken(
  account: GoogleServiceAccount
): Promise<string | null> {
  if (Date.now() > account.tokenExpiry - 60_000) {
    return refreshToken(account)
  }
  return account.accessToken
}
