"use client"

import { useEffect, useState } from "react"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Label } from "@/components/ui/label"
import { Moon, Sun, Monitor, ZoomIn, Bot, Globe } from "lucide-react"
import { useTheme } from "next-themes"
import { useScale } from "@/components/scale-provider"
import {
  getIntegrationsByCategory,
} from "@/lib/integrations/registry"
import { useMascot, MASCOT_CHARACTERS } from "@/lib/mascot"
import * as Icons from "lucide-react"
import { listCustomCharacters, deleteCustomCharacter } from "@/lib/data-layer"
import { GoogleCalendarSettings } from "./GoogleCalendarSettings"
import { GoogleServicesSettings } from "./GoogleServicesSettings"
import { HomeAssistantSettings } from "./HomeAssistantSettings"
import { PixelBuddyEditor } from "./PixelBuddyEditor"
import { useTimezone, TIMEZONE_LIST } from "@/lib/timezone"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

function getIcon(name: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Icon = (Icons as any)[name] as React.ComponentType<{ className?: string }> | undefined
  return Icon ?? Icons.Puzzle
}

export function SettingsView() {
  const { theme, setTheme } = useTheme()
  const { scale, setScale, presets } = useScale()
  const categories = getIntegrationsByCategory()

  return (
    <div className="mx-auto max-w-2xl overflow-auto px-6 py-4">
      {/* Appearance */}
      <section>
        <Label className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Appearance
        </Label>
        <div className="mt-3 flex gap-2">
          {[
            { value: "light", icon: Sun, label: "Light" },
            { value: "dark", icon: Moon, label: "Dark" },
            { value: "system", icon: Monitor, label: "System" },
          ].map(({ value, icon: Icon, label }) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              className={`flex flex-1 flex-col items-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs transition-all ${
                theme === value
                  ? "border-primary/30 bg-primary/10 text-foreground shadow-sm"
                  : "border-border text-muted-foreground hover:bg-muted/30"
              }`}
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </div>
      </section>

      <Separator className="my-4 bg-border/30" />

      {/* Display Scale */}
      <section>
        <Label className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Display Scale
        </Label>
        <p className="mt-1 text-xs text-muted-foreground">
          Adjust for viewing distance. Use "TV / Far" or "Kiosk" for
          across-the-room dashboards.
        </p>
        <div className="mt-3 grid grid-cols-5 gap-2">
          {presets.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setScale(value)}
              className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-xs transition-all ${
                scale === value
                  ? "border-primary/30 bg-primary/10 text-foreground shadow-sm"
                  : "border-border text-muted-foreground hover:bg-muted/30"
              }`}
            >
              <ZoomIn className="size-4" />
              {label}
              <span className="font-mono text-xs text-muted-foreground/50">
                {value}px
              </span>
            </button>
          ))}
        </div>
      </section>

      <Separator className="my-4 bg-border/30" />

      {/* Timezone */}
      <TimezoneSettings />

      <Separator className="my-4 bg-border/30" />

      {/* Mascot Buddy */}
      <MascotSettings />

      <Separator className="my-4 bg-border/30" />

      {/* Integrations */}
      <section>
        <Label className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Integrations
        </Label>
        <p className="mt-2 text-xs text-muted-foreground">
          Connect external services to populate your dashboard.
        </p>

        <div className="mt-6 space-y-8">
          {Array.from(categories.entries())
            .map(([category, items]) => {
              const externalItems = items.filter((def) => !def.builtIn)
              if (externalItems.length === 0 && category !== "Calendar" && category !== "Communication") return null
              return (
                <div key={category}>
                  <h3 className="mb-3 font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground/50">
                    {category}
                  </h3>
                  {category === "Calendar" && (
                    <div className="mb-4">
                      <GoogleCalendarSettings />
                    </div>
                  )}
                  {category === "Communication" && (
                    <div className="mb-4">
                      <GoogleServicesSettings />
                    </div>
                  )}
                  {category === "Smart Home" && (
                    <div className="mb-4">
                      <HomeAssistantSettings />
                    </div>
                  )}
                  <div className="space-y-1">
                    {externalItems.map((def) => {
                      const Icon = getIcon(def.icon)

                      return (
                        <div
                          key={def.id}
                          className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/30"
                        >
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted/40">
                            <Icon className="size-4 text-muted-foreground" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">
                                {def.name}
                              </span>
                              {!def.implemented && (
                                <Badge
                                  variant="outline"
                                  className="border-border/30 px-1.5 py-0 font-mono text-xs uppercase text-muted-foreground/50"
                                >
                                  coming soon
                                </Badge>
                              )}
                            </div>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {def.description}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
        </div>
      </section>

      <Separator className="my-4 bg-border/30" />

      {/* Footer */}
      <div className="flex flex-col items-center gap-3 pb-8 text-center">
        <p className="text-xs text-muted-foreground/50">
          Built with love &middot; Free forever &middot; Support the project
        </p>
        <a
          href="https://github.com/sponsors/ericvaish"
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex items-center gap-1.5 rounded-lg border border-pink-500/30 bg-pink-500/10 px-4 py-2 text-sm font-medium text-pink-500 transition-all hover:border-pink-500/50 hover:bg-pink-500/15"
        >
          <Icons.Heart className="size-4 text-pink-500 transition-transform group-hover:scale-125 group-hover:animate-pulse" />
          Support on GitHub
        </a>
      </div>
    </div>
  )
}

// ── Timezone Settings ────────────────────────────────────────────────────────

function TimezoneSettings() {
  const { detected, override, setOverride } = useTimezone()
  const [search, setSearch] = useState("")
  const [open, setOpen] = useState(false)

  const currentLabel = override
    ? override.replace(/_/g, " ")
    : `Auto-detect (${detected.replace(/_/g, " ")})`

  const getOffset = (tz: string) => {
    try {
      return new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        timeZoneName: "shortOffset",
      })
        .formatToParts(new Date())
        .find((p) => p.type === "timeZoneName")?.value ?? ""
    } catch {
      return ""
    }
  }

  const filtered = search.trim()
    ? TIMEZONE_LIST.filter((tz) =>
        tz.toLowerCase().replace(/_/g, " ").includes(search.toLowerCase()),
      )
    : TIMEZONE_LIST

  return (
    <section>
      <div className="flex items-center gap-2">
        <Globe className="size-4 text-muted-foreground/60" />
        <Label className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Timezone
        </Label>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Used for calendar events and schedule display.
      </p>

      <div className="mt-3">
        {/* Current selection */}
        <button
          onClick={() => setOpen((p) => !p)}
          className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm transition-all ${
            open
              ? "border-primary/30 bg-primary/5"
              : "border-border/50 hover:border-border hover:bg-muted/20"
          }`}
        >
          <div className="flex items-center gap-2">
            <Globe className="size-4 text-muted-foreground/50" />
            <span className="font-medium">{currentLabel}</span>
          </div>
          <Icons.ChevronDown
            className={`size-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>

        {open && (
          <div className="mt-2 overflow-hidden rounded-xl border border-border/40">
            {/* Search */}
            <div className="border-b border-border/20 px-3 py-2">
              <div className="flex items-center gap-2">
                <Icons.Search className="size-3.5 text-muted-foreground/40" />
                <input
                  type="text"
                  placeholder="Search timezones..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/30"
                  autoFocus
                />
              </div>
            </div>

            {/* Auto-detect option */}
            <button
              onClick={() => { setOverride(null); setOpen(false); setSearch("") }}
              className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/30 ${
                override === null ? "bg-primary/8 text-primary" : "text-foreground"
              }`}
            >
              <Icons.Locate className="size-3.5 text-muted-foreground/50" />
              <span className="flex-1">Auto-detect ({detected.replace(/_/g, " ")})</span>
              {override === null && <Icons.Check className="size-3.5 text-primary" />}
            </button>

            {/* Timezone list */}
            <div className="max-h-48 overflow-y-auto">
              {filtered.map((tz) => {
                const offset = getOffset(tz)
                const isSelected = override === tz
                return (
                  <button
                    key={tz}
                    onClick={() => { setOverride(tz); setOpen(false); setSearch("") }}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/30 ${
                      isSelected ? "bg-primary/8 text-primary" : "text-foreground"
                    }`}
                  >
                    <span className="flex-1">{tz.replace(/_/g, " ")}</span>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground/50">
                      {offset}
                    </span>
                    {isSelected && <Icons.Check className="size-3.5 shrink-0 text-primary" />}
                  </button>
                )
              })}
              {filtered.length === 0 && (
                <p className="px-3 py-4 text-center text-xs text-muted-foreground/50">
                  No timezones match "{search}"
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

// ── Mascot Settings ──────────────────────────────────────────────────────────

function MascotSettings() {
  const { enabled, setEnabled, soundEnabled, setSoundEnabled, character, setCharacter } = useMascot()
  const [showEditor, setShowEditor] = useState(false)
  const [customChars, setCustomChars] = useState<{ id: string; name: string; emoji: string }[]>([])

  // Load custom characters
  useEffect(() => {
    listCustomCharacters().then((chars) => {
      setCustomChars(chars.map((c) => ({ id: c.id, name: c.name, emoji: c.emoji })))
    }).catch(() => {})
  }, [showEditor]) // re-fetch when editor closes (may have created/edited one)

  const handleDeleteCustom = async (id: string) => {
    await deleteCustomCharacter(id)
    setCustomChars((prev) => prev.filter((c) => c.id !== id))
    // If the deleted character was selected, switch to default
    if (character === id) setCharacter("cat")
  }

  return (
    <section>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="size-4 text-muted-foreground/60" />
          <Label className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Pixel Buddy
          </Label>
        </div>
        <Switch checked={enabled} onCheckedChange={setEnabled} />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        A little companion that reacts when you log water, food, complete tasks, and more.
      </p>

      {enabled && (
        <>
          <div className="mt-4 grid grid-cols-5 gap-2">
            {/* Built-in characters */}
            {MASCOT_CHARACTERS.map((c) => (
              <button
                key={c.id}
                onClick={() => setCharacter(c.id)}
                className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-xs transition-all ${
                  character === c.id
                    ? "border-primary/30 bg-primary/10 text-foreground shadow-sm"
                    : "border-border text-muted-foreground hover:bg-muted/30"
                }`}
              >
                <span className="text-2xl">{c.emoji}</span>
                <span className="font-medium">{c.name}</span>
              </button>
            ))}
            {/* Custom characters */}
            {customChars.map((c) => (
              <div key={c.id} className="relative">
                <button
                  onClick={() => setCharacter(c.id)}
                  className={`flex w-full flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-xs transition-all ${
                    character === c.id
                      ? "border-primary/30 bg-primary/10 text-foreground shadow-sm"
                      : "border-border text-muted-foreground hover:bg-muted/30"
                  }`}
                >
                  <span className="text-2xl">{c.emoji}</span>
                  <span className="max-w-full truncate font-medium">{c.name}</span>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteCustom(c.id) }}
                  className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full border border-border/50 bg-background text-muted-foreground/60 shadow-sm transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <Icons.X className="size-3" />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Icons.Volume2 className="size-4 text-muted-foreground/60" />
                <Label className="text-xs text-muted-foreground">Sound effects</Label>
              </div>
              <p className="mt-0.5 pl-6 text-xs text-muted-foreground/50">Plays short sounds when your buddy reacts to actions.</p>
            </div>
            <Switch checked={soundEnabled} onCheckedChange={setSoundEnabled} />
          </div>

          <Separator className="my-5 bg-border/20" />

          <button
            onClick={() => setShowEditor((p) => !p)}
            className="flex w-full items-center justify-between rounded-lg border border-border/50 px-3 py-2.5 text-left transition-all hover:border-border hover:bg-muted/20"
          >
            <div className="flex items-center gap-2">
              <Icons.Paintbrush className="size-4 text-cyan-400/70" />
              <span className="text-sm font-medium">Pixel Buddy Editor</span>
            </div>
            <Icons.ChevronDown className={`size-4 text-muted-foreground transition-transform ${showEditor ? "rotate-180" : ""}`} />
          </button>
          <p className="mt-1 text-xs text-muted-foreground">
            Design your own character with the 32x32 pixel art editor.
          </p>

          {showEditor && (
            <div className="mt-4">
              <PixelBuddyEditor />
            </div>
          )}
        </>
      )}
    </section>
  )
}
