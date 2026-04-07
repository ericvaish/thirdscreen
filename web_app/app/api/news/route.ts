import { NextResponse } from "next/server"
import { getDb } from "@/lib/get-db"
import { rssFeeds, rssArticles } from "@/db/schema"
import { eq, and, desc } from "drizzle-orm"
import { v4 as uuidv4 } from "uuid"
import { getAuthUserId } from "@/lib/auth"
import Parser from "rss-parser"

const parser = new Parser()

// GET - list feeds or articles
export async function GET(request: Request) {
  try {
    const [userId, authError] = await getAuthUserId()
    if (authError) return authError
    const { searchParams } = new URL(request.url)
    const action = searchParams.get("action") ?? "articles"

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
      summary: item.contentSnippet?.slice(0, 300) ?? null,
    })
    newCount++
  }

  return newCount
}
