"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Rss, Plus, Trash2, RefreshCw, ExternalLink, Settings2, X, ChevronLeft, ChevronRight } from "lucide-react"
import { useRegisterZoneActions, type ZoneAction } from "@/lib/zone-actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { RssFeed, RssArticle } from "@/lib/types"
import { useDashboard } from "@/components/dashboard/DashboardContext"
import { ZoneDragHandle } from "@/components/dashboard/ZoneDragHandle"
import { ZoneLabel } from "@/components/dashboard/ZoneLabel"
import {
  listRssFeeds,
  addRssFeed,
  deleteRssFeed,
  listRssArticles,
  refreshRssFeeds,
} from "@/lib/data-layer"
import { useDataFetch } from "@/lib/use-data-fetch"

const ROTATE_INTERVAL = 8_000
const REFRESH_INTERVAL = 15 * 60 * 1000 // 15 minutes

// Persistent cache for lazily-fetched article previews, keyed by URL.
// Some feeds (Hacker News, Lobsters) have no body text in the RSS item,
// so we fall back to scraping the article's og:description / meta description.
// Hits stay across sessions; misses (null) are also cached for an hour to
// avoid re-fetching pages that legitimately have no description.
const PREVIEW_CACHE_KEY = "rss_preview_cache_v1"
const PREVIEW_NEGATIVE_TTL = 60 * 60 * 1000 // 1 hour

interface PreviewCacheEntry {
  description: string | null
  fetchedAt: number
}

function readPreviewCache(): Record<string, PreviewCacheEntry> {
  if (typeof window === "undefined") return {}
  try {
    return JSON.parse(window.localStorage.getItem(PREVIEW_CACHE_KEY) || "{}")
  } catch {
    return {}
  }
}

function writePreviewCache(cache: Record<string, PreviewCacheEntry>) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(PREVIEW_CACHE_KEY, JSON.stringify(cache))
  } catch {}
}

const inFlightPreviews = new Map<string, Promise<string | null>>()

async function fetchArticlePreview(url: string): Promise<string | null> {
  const cache = readPreviewCache()
  const hit = cache[url]
  if (hit) {
    if (hit.description) return hit.description
    if (Date.now() - hit.fetchedAt < PREVIEW_NEGATIVE_TTL) return null
  }

  const existing = inFlightPreviews.get(url)
  if (existing) return existing

  const promise = (async () => {
    try {
      const res = await fetch(`/api/news?action=preview&url=${encodeURIComponent(url)}`)
      const data: { description: string | null } = await res.json()
      const next = readPreviewCache()
      next[url] = { description: data.description ?? null, fetchedAt: Date.now() }
      writePreviewCache(next)
      return data.description ?? null
    } catch {
      return null
    } finally {
      inFlightPreviews.delete(url)
    }
  })()

  inFlightPreviews.set(url, promise)
  return promise
}

// Client-side safety net for already-stored summaries that still contain
// aggregator boilerplate (HN/Reddit "Article URL:", "Comments URL:" etc.).
// New fetches sanitize server-side, but existing local data may pre-date that.
function cleanSummary(raw: string | null | undefined): string | null {
  if (!raw) return null
  const text = raw
    .split(/\r?\n/)
    .filter((line) => {
      const l = line.trim()
      if (!l) return false
      if (/^article url\s*:/i.test(l)) return false
      if (/^comments? url\s*:/i.test(l)) return false
      if (/^points?\s*:/i.test(l)) return false
      if (/^#\s*comments?\s*:/i.test(l)) return false
      if (/^submitted by\b/i.test(l)) return false
      return true
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
  return text || null
}

// ── Suggested feeds ──────────────────────────────────────────────────────

interface SuggestedFeed {
  name: string
  url: string
  category: string
}

const SUGGESTED_FEEDS: SuggestedFeed[] = [
  // Tech
  { name: "Hacker News", url: "https://hnrss.org/frontpage", category: "Tech" },
  { name: "TechCrunch", url: "https://techcrunch.com/feed/", category: "Tech" },
  { name: "The Verge", url: "https://www.theverge.com/rss/index.xml", category: "Tech" },
  { name: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index", category: "Tech" },
  { name: "Wired", url: "https://www.wired.com/feed/rss", category: "Tech" },
  // World News
  { name: "BBC News", url: "https://feeds.bbci.co.uk/news/rss.xml", category: "World" },
  { name: "Reuters", url: "https://www.reutersagency.com/feed/", category: "World" },
  { name: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml", category: "World" },
  // Science
  { name: "NASA Breaking News", url: "https://www.nasa.gov/news-release/feed/", category: "Science" },
  { name: "Nature News", url: "https://www.nature.com/nature.rss", category: "Science" },
  // Design & Dev
  { name: "Smashing Magazine", url: "https://www.smashingmagazine.com/feed/", category: "Design" },
  { name: "CSS-Tricks", url: "https://css-tricks.com/feed/", category: "Design" },
  // Business
  { name: "Bloomberg", url: "https://feeds.bloomberg.com/markets/news.rss", category: "Business" },
]

export function NewsZone() {
  const { editMode, layout } = useDashboard()
  const newsGridSize = layout?.zones.find((z) => z.id === "news")?.size ?? "M"
  // Tier the layout into three buckets the article body can adapt to.
  const tier: "tiny" | "compact" | "full" =
    newsGridSize === "S"
      ? "tiny"
      : newsGridSize === "M" || newsGridSize === "TOWER"
        ? "compact"
        : "full"
  const { data: feeds = [], refetch: refetchFeeds } = useDataFetch(
    () => listRssFeeds() as Promise<RssFeed[]>,
    [],
  )
  const { data: articles = [], refetch: refetchArticles } = useDataFetch(
    () => listRssArticles(40) as Promise<RssArticle[]>,
    [],
  )

  const [currentIndex, setCurrentIndex] = useState(0)
  const [transitioning, setTransitioning] = useState(false)
  const [paused, setPaused] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Auto-rotate headlines ──────────────────────────────────────────────

  useEffect(() => {
    if (paused || articles.length <= 1 || dialogOpen) return
    intervalRef.current = setInterval(() => {
      setTransitioning(true)
      setTimeout(() => {
        setCurrentIndex((i) => (i + 1) % articles.length)
        setTransitioning(false)
      }, 300)
    }, ROTATE_INTERVAL)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [paused, articles.length, dialogOpen])

  // Reset index when articles change
  useEffect(() => {
    setCurrentIndex(0)
  }, [articles.length])

  // ── Background refresh ─────────────────────────────────────────────────

  const doRefresh = useCallback(async (force = false) => {
    setRefreshing(true)
    try {
      const result = await refreshRssFeeds(force)
      // Only refetch local lists if the refresh actually fetched (newCount may be 0
      // even when something ran, but the throttle no-op returns immediately).
      if (force || result.newCount > 0) {
        await refetchArticles()
        await refetchFeeds()
      }
    } catch {}
    setRefreshing(false)
  }, [refetchArticles, refetchFeeds])

  // Refresh on mount (throttled by data-layer) + interval
  useEffect(() => {
    doRefresh()
    const id = setInterval(() => doRefresh(), REFRESH_INTERVAL)
    return () => clearInterval(id)
  }, [doRefresh])

  const zoneActions = useMemo<ZoneAction[]>(
    () => [
      {
        id: "refresh",
        label: refreshing ? "Refreshing…" : "Refresh feeds",
        icon: <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />,
        onSelect: () => doRefresh(true),
        disabled: refreshing,
      },
      {
        id: "feeds",
        label: "Manage feeds…",
        icon: <Settings2 className="size-3.5" />,
        onSelect: () => setDialogOpen(true),
      },
    ],
    [refreshing, doRefresh],
  )
  useRegisterZoneActions("news", zoneActions)

  // ── Feed management ────────────────────────────────────────────────────

  const handleAddFeed = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formEl = e.currentTarget
    const form = new FormData(formEl)
    const url = (form.get("url") as string)?.trim()
    if (!url) return

    try {
      await addRssFeed({ url })
      await refetchFeeds()
      await refetchArticles()
      formEl.reset()
      toast.success("Feed added")
    } catch {
      toast.error("Failed to add feed")
    }
  }

  const handleDeleteFeed = async (id: string) => {
    try {
      await deleteRssFeed(id)
      await refetchFeeds()
      await refetchArticles()
    } catch {
      toast.error("Failed to remove feed")
    }
  }

  // Find which feed an article belongs to
  const getFeedTitle = (feedId: string) => {
    const feed = feeds.find((f) => f.id === feedId)
    if (feed?.title) return feed.title
    if (feed?.url) {
      try { return new URL(feed.url).hostname } catch {}
    }
    return "RSS"
  }

  const current = articles[currentIndex]

  // Which suggested feeds are already added
  const addedUrls = new Set(feeds.map((f) => f.url))

  const handleAddSuggested = async (url: string) => {
    try {
      await addRssFeed({ url })
      await refetchFeeds()
      await refetchArticles()
      toast.success("Feed added")
    } catch {
      toast.error("Failed to add feed")
    }
  }

  // Group suggestions by category
  const suggestionsByCategory = SUGGESTED_FEEDS.reduce<Record<string, SuggestedFeed[]>>(
    (acc, feed) => {
      if (!acc[feed.category]) acc[feed.category] = []
      acc[feed.category].push(feed)
      return acc
    },
    {},
  )

  // ── Main headline view ─────────────────────────────────────────────────

  return (
    <div
      className="zone-surface zone-news flex h-full flex-col"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >

      {/* Headline display — top-anchored layout that adapts per grid size. */}
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col px-3",
          tier === "tiny" ? "py-2" : "py-3",
        )}
      >
        {articles.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
            <Rss className="size-8 opacity-40" />
            <p className="text-xs text-muted-foreground/40">
              {feeds.length === 0
                ? "Add RSS feeds to see headlines"
                : "No articles yet"}
            </p>
            {feeds.length === 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDialogOpen(true)}
                className="text-xs"
                style={{ color: "var(--zone-news-accent)" }}
              >
                Add feeds
              </Button>
            )}
          </div>
        ) : current ? (
          <div
            className={cn(
              "flex min-h-0 flex-1 flex-col transition-opacity duration-300",
              transitioning ? "opacity-0" : "opacity-100",
            )}
          >
            {/* Source badge — always pinned at the very top, never wraps off. */}
            <span
              className={cn(
                "shrink-0 truncate font-mono font-medium uppercase tracking-wider opacity-80",
                tier === "tiny" ? "text-[0.625rem]" : "text-[0.6875rem]",
              )}
            >
              {getFeedTitle(current.feedId)}
            </span>

            {/* Title + summary block. Flexible middle.
                A small external-link icon sits to the RIGHT of the title.
                The title container has a CSS mask that fades long titles into
                transparency at the right edge, so text never collides with
                the icon regardless of length. */}
            <div className={cn("min-h-0 flex-1", tier === "tiny" ? "mt-1" : "mt-2")}>
              <div className="flex items-start gap-2">
                <div
                  className="min-w-0 flex-1"
                  style={{
                    maskImage:
                      "linear-gradient(to right, black 0, black calc(100% - 16px), transparent 100%)",
                    WebkitMaskImage:
                      "linear-gradient(to right, black 0, black calc(100% - 16px), transparent 100%)",
                  }}
                >
                  <h3
                    className={cn(
                      "font-[family-name:var(--font-display)] font-bold leading-snug tracking-tight text-foreground/90",
                      tier === "tiny" ? "text-xs" : "text-sm",
                      tier === "tiny" ? "line-clamp-3" : "line-clamp-2",
                    )}
                  >
                    {current.link ? (
                      <a
                        href={current.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline"
                      >
                        {current.title}
                      </a>
                    ) : (
                      current.title
                    )}
                  </h3>
                </div>
                {current.link && (
                  <a
                    href={current.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Open article"
                    aria-label="Open article"
                    className="mt-1 flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <ExternalLink className={cn(tier === "tiny" ? "size-3" : "size-3.5")} />
                  </a>
                )}
              </div>

              {tier !== "tiny" && (
                <div
                  className={cn(
                    "mt-2 text-xs leading-relaxed text-muted-foreground/70",
                    tier === "compact" ? "line-clamp-2" : "line-clamp-3",
                  )}
                >
                  <ArticleSummary summary={current.summary} link={current.link ?? null} />
                </div>
              )}
            </div>

            {/* Footer — pinned at the bottom. Just the timestamp on full tier. */}
            {tier === "full" && current.pubDate && (
              <div className="mt-2 flex shrink-0 items-center gap-2">
                <span className="font-mono text-[0.6875rem] text-muted-foreground/30">
                  {formatTimeAgo(current.pubDate)}
                </span>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Progress dots + manual nav */}
      {articles.length > 1 && (
        <div
          className={cn(
            "flex shrink-0 items-center justify-center gap-2 px-3",
            tier === "tiny" ? "pb-1.5" : "pb-2",
          )}
        >
          <button
            onClick={() => {
              setTransitioning(true)
              setTimeout(() => {
                setCurrentIndex((i) => (i - 1 + articles.length) % articles.length)
                setTransitioning(false)
              }, 150)
            }}
            className="flex size-7 items-center justify-center rounded-full text-muted-foreground/40 transition-colors hover:bg-foreground/5 hover:text-foreground"
            aria-label="Previous article"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <div className="flex items-center gap-1">
            {(() => {
              const maxDots = tier === "tiny" ? 5 : tier === "compact" ? 8 : 12
              const visible = articles.slice(0, Math.min(articles.length, maxDots))
              return (
                <>
                  {visible.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setTransitioning(true)
                        setTimeout(() => {
                          setCurrentIndex(i)
                          setTransitioning(false)
                        }, 150)
                      }}
                      className={cn(
                        "h-1 rounded-full transition-all duration-300",
                        i === currentIndex
                          ? "w-4 bg-foreground/70"
                          : "w-1 bg-muted-foreground/15 hover:bg-muted-foreground/30",
                      )}
                    />
                  ))}
                  {articles.length > maxDots && (
                    <span className="font-mono text-[0.6875rem] text-muted-foreground/20">
                      +{articles.length - maxDots}
                    </span>
                  )}
                </>
              )
            })()}
          </div>
          <button
            onClick={() => {
              setTransitioning(true)
              setTimeout(() => {
                setCurrentIndex((i) => (i + 1) % articles.length)
                setTransitioning(false)
              }, 150)
            }}
            className="flex size-7 items-center justify-center rounded-full text-muted-foreground/40 transition-colors hover:bg-foreground/5 hover:text-foreground"
            aria-label="Next article"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      )}

      {/* ── Feed management dialog ──────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b border-border/20 px-5 py-4">
            <DialogTitle className="flex items-center gap-2 font-[family-name:var(--font-display)] text-base font-bold tracking-tight">
              <Rss className="size-4" style={{ color: "var(--zone-news-accent)" }} />
              Manage News Feeds
            </DialogTitle>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto">
            {/* Active feeds */}
            {feeds.length > 0 && (
              <div className="border-b border-border/10">
                <p className="px-5 pt-4 pb-1 font-mono text-[0.6875rem] font-medium uppercase tracking-wider text-muted-foreground/40">
                  Your feeds
                </p>
                <div className="divide-y divide-border/5">
                  {feeds.map((feed) => (
                    <div
                      key={feed.id}
                      className="group flex items-center gap-3 px-5 py-2 transition-colors hover:bg-foreground/[0.02]"
                    >
                      <Rss className="size-3.5 shrink-0 text-muted-foreground/30" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {feed.title || feed.url}
                        </p>
                        {feed.title && (
                          <p className="truncate font-mono text-xs text-muted-foreground/40">
                            {feed.url}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteFeed(feed.id)}
                        className="flex size-11 shrink-0 items-center justify-center text-muted-foreground/20 transition-colors hover:text-destructive"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Suggested feeds */}
            <div className="px-5 pt-4 pb-2">
              <p className="font-mono text-[0.6875rem] font-medium uppercase tracking-wider text-muted-foreground/40">
                Popular feeds
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground/30">
                Tap to add, or paste your own URL below
              </p>
            </div>

            {Object.entries(suggestionsByCategory).map(([category, suggestions]) => (
              <div key={category} className="pb-2">
                <p
                  className="px-5 py-1.5 font-mono text-xs font-semibold tracking-wide"
                  style={{ color: "var(--zone-news-accent)" }}
                >
                  {category}
                </p>
                <div className="grid grid-cols-2 gap-1.5 px-5">
                  {suggestions.map((s) => {
                    const isAdded = addedUrls.has(s.url)
                    return (
                      <button
                        key={s.url}
                        disabled={isAdded}
                        onClick={() => handleAddSuggested(s.url)}
                        className={cn(
                          "flex min-h-11 items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-all",
                          isAdded
                            ? "border-border/10 opacity-40 cursor-default"
                            : "border-border/20 hover:border-border/40 hover:bg-foreground/[0.03] cursor-pointer",
                        )}
                      >
                        <Rss className="size-3.5 shrink-0 text-muted-foreground/30" />
                        <span className="flex-1 truncate text-sm">
                          {s.name}
                        </span>
                        {isAdded ? (
                          <span className="font-mono text-[0.6875rem] text-muted-foreground/30">
                            added
                          </span>
                        ) : (
                          <Plus className="size-3.5 shrink-0 text-muted-foreground/20" />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Custom feed URL */}
          <form
            onSubmit={(e) => {
              handleAddFeed(e)
            }}
            className="border-t border-border/20 px-5 py-3"
          >
            <div className="flex items-center gap-3 rounded-lg border border-border/20 px-3">
              <Rss className="size-3.5 shrink-0 text-muted-foreground/30" />
              <Input
                name="url"
                placeholder="Paste any RSS feed URL..."
                className="h-11 rounded-none border-none bg-transparent px-0 text-sm shadow-none focus-visible:ring-0 dark:bg-transparent"
              />
              <Button
                type="submit"
                variant="ghost"
                size="icon-xs"
                className="shrink-0 text-muted-foreground/40 hover:text-foreground"
              >
                <Plus className="size-4" />
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60_000)

  if (diffMin < 1) return "just now"
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay}d ago`
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

// Renders the article summary. Prefers the cleaned RSS-provided summary;
// falls back to a lazy-fetched og:description for feeds (HN, Lobsters) whose
// items are link-only. Uses a stable cache so each link is fetched at most
// once across mounts/sessions.
function ArticleSummary({
  summary,
  link,
}: {
  summary: string | null | undefined
  link: string | null
}) {
  const cleaned = cleanSummary(summary)
  const [fallback, setFallback] = useState<string | null>(null)
  const [loadingFallback, setLoadingFallback] = useState(false)

  useEffect(() => {
    if (cleaned || !link) {
      setFallback(null)
      setLoadingFallback(false)
      return
    }
    let cancelled = false
    setLoadingFallback(true)
    fetchArticlePreview(link)
      .then((desc) => {
        if (!cancelled) setFallback(desc)
      })
      .finally(() => {
        if (!cancelled) setLoadingFallback(false)
      })
    return () => {
      cancelled = true
    }
  }, [cleaned, link])

  const text = cleaned ?? fallback
  if (text) {
    return (
      <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground/70">
        {text}
      </p>
    )
  }
  if (loadingFallback) {
    return (
      <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground/30">
        Loading preview…
      </p>
    )
  }
  return null
}
