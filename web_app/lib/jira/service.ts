import { getDb } from "@/lib/get-db"
import { jiraAccounts } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import {
  ATLASSIAN_TOKEN_URL,
  ATLASSIAN_RESOURCES_URL,
  JIRA_API_BASE,
} from "./constants"
import { getAdminConfig, ADMIN_KEYS } from "@/lib/admin-config"

// ── Types ──────────────────────────────────────────────────────────────────

export interface JiraAccount {
  id: string
  userId: string
  email: string
  displayName: string | null
  cloudId: string
  siteUrl: string | null
  accessToken: string
  refreshToken: string
  tokenExpiry: number
  createdAt: string
}

export interface JiraIssue {
  id: string
  key: string
  summary: string
  status: string
  statusCategory: "todo" | "in_progress" | "done"
  priority: string | null
  projectName: string
  projectKey: string
  issueType: string
  htmlLink: string
  accountEmail: string
  source: "jira"
}

// ── Client ID ──────────────────────────────────────────────────────────────

export function getClientId(): string | null {
  return getAdminConfig(ADMIN_KEYS.jiraClientId)
}

function getClientSecret(): string | null {
  return getAdminConfig(ADMIN_KEYS.jiraClientSecret)
}

// ── Account CRUD ───────────────────────────────────────────────────────────

export async function listJiraAccounts(userId: string = ""): Promise<JiraAccount[]> {
  const rows = await getDb()
    .select()
    .from(jiraAccounts)
    .where(eq(jiraAccounts.userId, userId))

  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    email: r.email,
    displayName: r.displayName,
    cloudId: r.cloudId,
    siteUrl: r.siteUrl,
    accessToken: r.accessToken,
    refreshToken: r.refreshToken,
    tokenExpiry: r.tokenExpiry,
    createdAt: r.createdAt,
  }))
}

export async function removeJiraAccount(id: string, userId: string = ""): Promise<void> {
  await getDb()
    .delete(jiraAccounts)
    .where(and(eq(jiraAccounts.id, id), eq(jiraAccounts.userId, userId)))
}

// ── Token exchange ─────────────────────────────────────────────────────────

export async function exchangeJiraCode(
  code: string,
  redirectUri: string,
  userId: string = ""
): Promise<{ accountId: string; email: string } | null> {
  const clientId = getClientId()
  const clientSecret = getClientSecret()
  if (!clientId || !clientSecret) return null

  // Exchange code for tokens
  const tokenRes = await fetch(ATLASSIAN_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  })

  if (!tokenRes.ok) {
    console.error("Jira token exchange failed:", tokenRes.status, await tokenRes.text())
    return null
  }

  const tokenData = await tokenRes.json()
  const accessToken = tokenData.access_token as string
  const refreshToken = tokenData.refresh_token as string
  const expiresIn = tokenData.expires_in as number
  const tokenExpiry = Date.now() + expiresIn * 1000

  // Fetch accessible resources to get cloud ID
  const resourcesRes = await fetch(ATLASSIAN_RESOURCES_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!resourcesRes.ok) {
    console.error("Jira resources fetch failed:", resourcesRes.status)
    return null
  }

  const resources = await resourcesRes.json()
  if (!resources.length) {
    console.error("No accessible Jira sites found")
    return null
  }

  const site = resources[0]
  const cloudId = site.id as string
  const siteUrl = site.url as string

  // Fetch user profile
  const profileRes = await fetch(`${JIRA_API_BASE}/${cloudId}/rest/api/3/myself`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!profileRes.ok) {
    console.error("Jira profile fetch failed:", profileRes.status)
    return null
  }

  const profile = await profileRes.json()
  const email = profile.emailAddress as string
  const displayName = (profile.displayName as string) ?? null

  // Upsert: check if this account already exists
  const existing = await getDb()
    .select()
    .from(jiraAccounts)
    .where(
      and(
        eq(jiraAccounts.cloudId, cloudId),
        eq(jiraAccounts.email, email),
        eq(jiraAccounts.userId, userId)
      )
    )

  if (existing.length > 0) {
    const accountId = existing[0].id
    await getDb()
      .update(jiraAccounts)
      .set({ accessToken, refreshToken, tokenExpiry, displayName, siteUrl })
      .where(eq(jiraAccounts.id, accountId))
    return { accountId, email }
  }

  const { v4: uuid } = await import("uuid")
  const accountId = uuid()

  await getDb().insert(jiraAccounts).values({
    id: accountId,
    userId,
    email,
    displayName,
    cloudId,
    siteUrl,
    accessToken,
    refreshToken,
    tokenExpiry,
    createdAt: new Date().toISOString(),
  })

  return { accountId, email }
}

// ── Token refresh ──────────────────────────────────────────────────────────

async function refreshJiraToken(account: JiraAccount): Promise<string | null> {
  const clientId = getClientId()
  const clientSecret = getClientSecret()
  if (!clientId || !clientSecret) return null

  const res = await fetch(ATLASSIAN_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: account.refreshToken,
    }),
  })

  if (!res.ok) return null
  const data = await res.json()

  const newToken = data.access_token as string
  const expiresIn = data.expires_in as number
  const newExpiry = Date.now() + expiresIn * 1000

  await getDb()
    .update(jiraAccounts)
    .set({
      accessToken: newToken,
      tokenExpiry: newExpiry,
      ...(data.refresh_token ? { refreshToken: data.refresh_token } : {}),
    })
    .where(eq(jiraAccounts.id, account.id))

  return newToken
}

async function getValidToken(account: JiraAccount): Promise<string | null> {
  if (Date.now() > account.tokenExpiry - 60_000) {
    return refreshJiraToken(account)
  }
  return account.accessToken
}

// ── Issue fetching ─────────────────────────────────────────────────────────

function mapStatusCategory(raw: string): "todo" | "in_progress" | "done" {
  switch (raw) {
    case "done": return "done"
    case "indeterminate": return "in_progress"
    default: return "todo" // "new" or "undefined"
  }
}

export async function fetchIssuesForAccount(account: JiraAccount): Promise<JiraIssue[]> {
  const token = await getValidToken(account)
  if (!token) return []

  const jql = "assignee=currentUser() AND resolution=Unresolved ORDER BY updated DESC"
  const fields = "summary,status,priority,project,issuetype"
  const params = new URLSearchParams({
    jql,
    fields,
    maxResults: "50",
  })

  try {
    const res = await fetch(
      `${JIRA_API_BASE}/${account.cloudId}/rest/api/3/search?${params}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )

    if (!res.ok) return []
    const data = await res.json()

    const siteBase = account.siteUrl?.replace(/\/$/, "") ?? `https://jira.atlassian.com`

    return (data.issues ?? []).map((issue: Record<string, unknown>) => {
      const fields = issue.fields as Record<string, unknown>
      const status = fields.status as { name: string; statusCategory: { key: string } }
      const priority = fields.priority as { name: string } | null
      const project = fields.project as { name: string; key: string }
      const issueType = fields.issuetype as { name: string }

      return {
        id: `jira-${account.id}-${issue.key}`,
        key: issue.key as string,
        summary: fields.summary as string,
        status: status.name,
        statusCategory: mapStatusCategory(status.statusCategory.key),
        priority: priority?.name ?? null,
        projectName: project.name,
        projectKey: project.key,
        issueType: issueType.name,
        htmlLink: `${siteBase}/browse/${issue.key}`,
        accountEmail: account.email,
        source: "jira" as const,
      }
    })
  } catch {
    return []
  }
}

export async function fetchAllJiraIssues(userId: string = ""): Promise<JiraIssue[]> {
  const accounts = await listJiraAccounts(userId)
  const results = await Promise.all(accounts.map(fetchIssuesForAccount))
  return results.flat()
}
