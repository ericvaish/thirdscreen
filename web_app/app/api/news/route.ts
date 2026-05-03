import { NextResponse } from "next/server"
import { getDb } from "@/lib/get-db"
import { rssFeeds, rssArticles } from "@/db/schema"
import { eq, and, desc } from "drizzle-orm"
import { v4 as uuidv4 } from "uuid"
import { getAuthUserId } from "@/lib/auth"
import Parser from "rss-parser"

const parser = new Parser()

// Best-effort summary extraction. RSS feeds vary wildly in what they put in
// `description` / `content` / `contentSnippet`. We strip HTML, drop common
// aggregator-only metadata (HN/Reddit "Article URL:" / "Comments URL:" /
// "Points:" lines), collapse whitespace, and cap length. Returns null when
// nothing readable is left so the UI can hide the field instead of showing
// the raw URL line.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractSummary(item: any): string | null {
  const raw =
    (typeof item.contentSnippet === "string" && item.contentSnippet) ||
    (typeof item["content:encodedSnippet"] === "string" && item["content:encodedSnippet"]) ||
    (typeof item.content === "string" && item.content) ||
    (typeof item.summary === "string" && item.summary) ||
    (typeof item.description === "string" && item.description) ||
    ""
  if (!raw) return null

  let text = String(raw)
    .replace(/<[^>]+>/g, " ") // strip HTML tags
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")

  // Drop boilerplate lines from common aggregator feeds (Hacker News, Reddit, Lobsters).
  text = text
    .split(/\r?\n/)
    .filter((line) => {
      const l = line.trim()
      if (!l) return false
      if (/^article url\s*:/i.test(l)) return false
      if (/^comments? url\s*:/i.test(l)) return false
      if (/^points?\s*:/i.test(l)) return false
      if (/^#\s*comments?\s*:/i.test(l)) return false
      if (/^submitted by\b/i.test(l)) return false
      if (/^\[link\]\s*\[comments\]/i.test(l)) return false
      return true
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()

  if (!text) return null
  return text.slice(0, 400)
}

// Fetches and extracts a short readable description from a web page,
// for feeds (e.g. Hacker News, Lobsters) whose RSS items only contain link
// metadata. Tries og:description → twitter:description → meta description →
// first <p>. Returns null if nothing useful is found or the fetch fails.
async function fetchPagePreview(url: string): Promise<{
  description: string | null
  siteName: string | null
}> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; ThirdScreenBot/1.0; +https://thirdscr.com)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    })
    clearTimeout(timeout)
    if (!res.ok) return { description: null, siteName: null }

    const ct = res.headers.get("content-type") ?? ""
    if (!ct.includes("html")) return { description: null, siteName: null }

    // Cap at 256KB — descriptions live in <head>, no need to download more.
    const reader = res.body?.getReader()
    if (!reader) return { description: null, siteName: null }
    let html = ""
    let received = 0
    const decoder = new TextDecoder()
    while (received < 256 * 1024) {
      const { done, value } = await reader.read()
      if (done) break
      received += value.length
      html += decoder.decode(value, { stream: true })
      if (html.includes("</head>")) break
    }
    try { reader.cancel() } catch {}

    function meta(re: RegExp): string | null {
      const m = html.match(re)
      return m?.[1]?.trim() || null
    }

    const description =
      meta(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ||
      meta(/<meta[^>]+name=["']twitter:description["'][^>]+content=["']([^"']+)["']/i) ||
      meta(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
      meta(/<p[^>]*>([^<]{40,400})<\/p>/i)

    const siteName =
      meta(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i) ||
      meta(/<title[^>]*>([^<]+)<\/title>/i)

    if (!description) return { description: null, siteName }
    const cleaned = description
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/\s+/g, " ")
      .trim()
    return { description: cleaned.slice(0, 400) || null, siteName }
  } catch {
    return { description: null, siteName: null }
  }
}

// GET - list feeds or articles, or fetch a one-off page preview.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get("action") ?? "articles"

    // Page preview is unauthenticated: it only fetches a public URL the
    // client already has and returns its meta description. Used as a fallback
    // for feeds whose RSS items have no body content (e.g. Hacker News).
    if (action === "preview") {
      const target = searchParams.get("url")
      if (!target) {
        return NextResponse.json({ description: null, siteName: null })
      }
      try {
        // Reject anything that isn't an http(s) URL.
        const parsed = new URL(target)
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          return NextResponse.json({ description: null, siteName: null })
        }
      } catch {
        return NextResponse.json({ description: null, siteName: null })
      }
      const preview = await fetchPagePreview(target)
      // Allow the browser to cache previews — descriptions don't change often.
      return NextResponse.json(preview, {
        headers: { "Cache-Control": "public, max-age=86400" },
      })
    }

    const [userId, authError] = await getAuthUserId()
    if (authError) return authError

    if (action === "feeds") {
      const feeds = await getDb()
        .select()
        .from(rssFeeds)
        .where(eq(rssFeeds.userId, userId))
      return NextResponse.json(feeds)
    }

    // Default: return articles
    const limit = parseInt(searchParams.get("limit") ?? "50", 10)
    const articles = await getDb()
      .select()
      .from(rssArticles)
      .where(eq(rssArticles.userId, userId))
      .orderBy(desc(rssArticles.pubDate))
      .limit(limit)
    return NextResponse.json(articles)
  } catch (error) {
    console.error("Failed to fetch news:", error)
    return NextResponse.json({ error: "Failed to fetch news" }, { status: 500 })
  }
}

// POST - add feed or refresh all feeds
export async function POST(request: Request) {
  try {
    const [userId, authError] = await getAuthUserId()
    if (authError) return authError
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: any = await request.json()

    // Parse-only: validate URL + return metadata without touching the DB.
    // Used by local-storage clients that need a CORS-safe parser.
    if (body.action === "parse") {
      const { url } = body
      if (!url) {
        return NextResponse.json({ ok: false, error: "url is required", items: [] })
      }
      try {
        const parsed = await parser.parseURL(url)
        return NextResponse.json({
          ok: true,
          url,
          title: parsed.title ?? null,
          siteUrl: parsed.link ?? null,
          items: (parsed.items ?? []).map((item) => ({
            guid: item.guid || item.link || item.title || "",
            title: item.title ?? "Untitled",
            link: item.link ?? null,
            pubDate: item.pubDate ?? item.isoDate ?? null,
            summary: extractSummary(item),
          })),
        })
      } catch {
        // Always return 200 so client-side fetch doesn't log a network error.
        // Callers check `ok` to distinguish success from failure.
        return NextResponse.json({ ok: false, error: "Could not parse RSS feed", items: [] })
      }
    }

    // Refresh all feeds
    if (body.action === "refresh") {
      const feeds = await getDb()
        .select()
        .from(rssFeeds)
        .where(eq(rssFeeds.userId, userId))

      let newCount = 0
      for (const feed of feeds) {
        try {
          newCount += await fetchAndStoreArticles(feed.id, feed.url, userId)
          await getDb()
            .update(rssFeeds)
            .set({ lastFetchedAt: new Date().toISOString() })
            .where(eq(rssFeeds.id, feed.id))
        } catch (err) {
          console.error(`Failed to refresh feed ${feed.url}:`, err)
        }
      }
      return NextResponse.json({ newCount })
    }

    // Add new feed
    const { url } = body
    if (!url) {
      return NextResponse.json({ error: "url is required" }, { status: 400 })
    }

    // Parse the feed to validate and get metadata
    let parsed
    try {
      parsed = await parser.parseURL(url)
    } catch {
      return NextResponse.json({ error: "Could not parse RSS feed" }, { status: 400 })
    }

    const feedId = uuidv4()
    await getDb().insert(rssFeeds).values({
      id: feedId,
      userId,
      url,
      title: parsed.title ?? null,
      siteUrl: parsed.link ?? null,
    })

    // Fetch initial articles
    await fetchAndStoreArticles(feedId, url, userId)

    await getDb()
      .update(rssFeeds)
      .set({ lastFetchedAt: new Date().toISOString() })
      .where(eq(rssFeeds.id, feedId))

    const [created] = await getDb()
      .select()
      .from(rssFeeds)
      .where(eq(rssFeeds.id, feedId))
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    console.error("Failed to add feed:", error)
    return NextResponse.json({ error: "Failed to add feed" }, { status: 500 })
  }
}

// DELETE - remove a feed
export async function DELETE(request: Request) {
  try {
    const [userId, authError] = await getAuthUserId()
    if (authError) return authError
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }

    await getDb()
      .delete(rssFeeds)
      .where(and(eq(rssFeeds.id, id), eq(rssFeeds.userId, userId)))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete feed:", error)
    return NextResponse.json({ error: "Failed to delete feed" }, { status: 500 })
  }
}

// ── Helper: fetch feed and store new articles ──────────────────────────────

async function fetchAndStoreArticles(
  feedId: string,
  url: string,
  userId: string,
): Promise<number> {
  const parsed = await parser.parseURL(url)

  // Get existing GUIDs for this feed to avoid duplicates
  const existing = await getDb()
    .select({ guid: rssArticles.guid })
    .from(rssArticles)
    .where(eq(rssArticles.feedId, feedId))
  const existingGuids = new Set(existing.map((e) => e.guid))

  let newCount = 0
  for (const item of parsed.items ?? []) {
    const guid = item.guid || item.link || item.title || ""
    if (!guid || existingGuids.has(guid)) continue

    await getDb().insert(rssArticles).values({
      id: uuidv4(),
      userId,
      feedId,
      guid,
      title: item.title ?? "Untitled",
      link: item.link ?? null,
      pubDate: item.pubDate ?? item.isoDate ?? null,
      summary: extractSummary(item),
    })
    newCount++
  }

  return newCount
}
