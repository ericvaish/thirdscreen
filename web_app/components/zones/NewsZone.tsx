"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Rss, Plus, Trash2, RefreshCw, ExternalLink, Settings2, X } from "lucide-react"
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
  const { editMode } = useDashboard()
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

  const doRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await refreshRssFeeds()
      await refetchArticles()
      await refetchFeeds()
    } catch {}
    setRefreshing(false)
  }, [refetchArticles, refetchFeeds])

  // Refresh on mount + interval
  useEffect(() => {
    doRefresh()
    const id = setInterval(doRefresh, REFRESH_INTERVAL)
    return () => clearInterval(id)
  }, [doRefresh])

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
      {/* Header */}
      <div
        className={`flex shrink-0 items-center justify-between px-3 py-1.5 ${editMode ? "zone-drag-handle" : ""}`}
      >
        <div className="flex items-center gap-2">
          <ZoneDragHandle />
          <ZoneLabel accentVar="--zone-news-accent" icon={<Rss className="size-4" />}>
            News
          </ZoneLabel>
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={doRefresh}
            disabled={refreshing}
            className="text-muted-foreground/50 hover:text-foreground"
          >
            <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setDialogOpen(true)}
            className="text-muted-foreground/50 hover:text-foreground"
          >
            <Settings2 className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Headline display */}
      <div className="min-h-0 flex-1 flex flex-col justify-center px-4 py-2">
        {articles.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 text-center">
            <Rss className="size-8" style={{ color: "var(--zone-news-accent)", opacity: 0.2 }} />
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
          <a
            href={current.link ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "group block space-y-2 transition-opacity duration-300",
              transitioning ? "opacity-0" : "opacity-100",
            )}
          >
            {/* Source badge */}
            <span
              className="inline-block font-mono text-[0.6875rem] font-medium uppercase tracking-wider"
              style={{ color: "var(--zone-news-accent)" }}
            >
              {getFeedTitle(current.feedId)}
            </span>

            {/* Headline */}
            <h3 className="font-[family-name:var(--font-display)] text-sm font-bold leading-snug tracking-tight text-foreground/90 group-hover:text-foreground">
              {current.title}
            </h3>

            {/* Summary */}
            {current.summary && (
              <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground/50">
                {current.summary}
              </p>
            )}

            {/* Footer */}
            <div className="flex items-center gap-2 pt-1">
              {current.pubDate && (
                <span className="font-mono text-[0.6875rem] text-muted-foreground/30">
                  {formatTimeAgo(current.pubDate)}
                </span>
              )}
              <ExternalLink className="size-3 text-muted-foreground/20 transition-colors group-hover:text-foreground/50" />
            </div>
          </a>
        ) : null}
      </div>

      {/* Progress dots */}
      {articles.length > 1 && (
        <div className="flex shrink-0 items-center justify-center gap-1 px-3 pb-2">
          {articles.slice(0, Math.min(articles.length, 12)).map((_, i) => (
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
                  ? "w-4"
                  : "w-1 bg-muted-foreground/15 hover:bg-muted-foreground/30",
              )}
              style={
                i === currentIndex
                  ? { backgroundColor: "var(--zone-news-accent)" }
                  : undefined
              }
            />
          ))}
          {articles.length > 12 && (
            <span className="font-mono text-[0.6875rem] text-muted-foreground/20">
              +{articles.length - 12}
            </span>
          )}
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
