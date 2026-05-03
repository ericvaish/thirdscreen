"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Link as LinkIcon, Upload } from "lucide-react"
import { toast } from "sonner"
import {
  WALLPAPER_PRESETS,
  loadWallpaper,
  saveWallpaper,
  type WallpaperKind,
} from "@/lib/wallpaper"

// ── Sub-components ─────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground/50">
      {children}
    </p>
  )
}

export function WallpaperSection() {
  const [kind, setKind] = useState<WallpaperKind>("none")
  const [url, setUrl] = useState("")
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    loadWallpaper().then(({ kind, url }) => {
      setKind(kind)
      setUrl(url ?? "")
      setLoaded(true)
    })
  }, [])

  if (!loaded) return null

  const choose = async (next: WallpaperKind) => {
    setKind(next)
    await saveWallpaper(next, next === "custom" ? (url || null) : null)
  }

  const commitUrl = async (next: string) => {
    setUrl(next)
    const trimmed = next.trim()
    if (!trimmed) return
    // Pasting/applying a URL implicitly switches to Custom mode.
    setKind("custom")
    await saveWallpaper("custom", trimmed)
  }

  return (
    <section>
      <SectionLabel>Wallpaper</SectionLabel>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        <button
          onClick={() => choose("none")}
          className={`h-12 rounded-lg border text-xs font-medium transition-all active:scale-95 ${
            kind === "none"
              ? "border-primary/50 bg-primary/10 text-primary"
              : "border-border/20 bg-muted/10 text-muted-foreground hover:border-border/40"
          }`}
          style={{ background: kind === "none" ? undefined : "repeating-linear-gradient(45deg, transparent 0 6px, rgba(255,255,255,0.04) 6px 12px)" }}
        >
          None
        </button>
        {Object.entries(WALLPAPER_PRESETS).map(([id, preset]) => (
          <button
            key={id}
            onClick={() => choose(id as WallpaperKind)}
            className={`relative h-12 overflow-hidden rounded-lg border text-xs font-semibold transition-all active:scale-95 ${
              kind === id
                ? "border-primary/60 ring-2 ring-primary/40"
                : "border-border/20 hover:border-border/40"
            }`}
            style={{ background: preset.css }}
            title={preset.label}
          >
            <span className="absolute inset-x-0 bottom-0 bg-black/40 px-1 py-0.5 text-[10px] text-white/90">
              {preset.label}
            </span>
          </button>
        ))}
        <button
          onClick={() => choose("custom")}
          className={`h-12 rounded-lg border text-xs font-medium transition-all active:scale-95 ${
            kind === "custom"
              ? "border-primary/50 bg-primary/10 text-primary"
              : "border-border/20 bg-muted/10 text-muted-foreground hover:border-border/40"
          }`}
        >
          Custom
        </button>
      </div>
      {/* URL input + Upload — always visible so users can paste a link any time */}
      <div className="mt-3 space-y-1.5">
        <label className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground/50">
          <LinkIcon className="size-3" />
          Image URL
        </label>
        <div className="flex gap-1.5">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onBlur={(e) => commitUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                commitUrl((e.target as HTMLInputElement).value)
              }
            }}
            placeholder="https://images.unsplash.com/..."
            className="h-9 flex-1 text-xs"
          />
          <Button
            size="sm"
            variant="secondary"
            disabled={!url.trim()}
            onClick={() => commitUrl(url.trim())}
            className="h-9 px-3 text-xs"
          >
            Apply
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          disabled
          onClick={() =>
            toast.info("Image upload is coming soon — paste a URL for now.")
          }
          title="Image upload requires storage backend (coming soon)"
          className="h-9 w-full justify-start gap-2 text-xs text-muted-foreground/60"
        >
          <Upload className="size-3.5" />
          Upload image (coming soon)
        </Button>
      </div>
    </section>
  )
}
