"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Label } from "@/components/ui/label"
import { Moon, Sun, Monitor, ZoomIn, Bot, Globe } from "lucide-react"
import { useTheme } from "next-themes"
import { animatedSetTheme } from "@/components/ui/animated-theme-toggler"
import { useScale } from "@/components/scale-provider"
import {
  getIntegrationsByCategory,
} from "@/lib/integrations/registry"
import { useMascot, MASCOT_CHARACTERS } from "@/lib/mascot"
import * as Icons from "lucide-react"
import { listCustomCharacters, deleteCustomCharacter } from "@/lib/data-layer"
import { searchCities, setManualGeo, type GeoSearchResult } from "@/components/zones/StatusBar"
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
              onClick={(e) => animatedSetTheme(setTheme, value, e.currentTarget)}
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

      {/* Location & Timezone */}
      <LocationTimezoneSettings />

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

// ── Location & Timezone Settings ──────────────────────────────────────────────

type LocTzMode = "city" | "timezone"

function LocationTimezoneSettings() {
  const { timezone, detected, override, setOverride } = useTimezone()
  const [mode, setMode] = useState<LocTzMode>("city")
  const [cityQuery, setCityQuery] = useState("")
  const [cityResults, setCityResults] = useState<GeoSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedCity, setSelectedCity] = useState<string | null>(null)
  const [tzSearch, setTzSearch] = useState("")
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load saved city name from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("statusbar-manual-location")
      if (raw) {
        const geo = JSON.parse(raw) as { city?: string }
        if (geo.city) setSelectedCity(geo.city)
      }
    } catch {}
  }, [])

  const handleCitySearch = useCallback((value: string) => {
    setCityQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (value.length < 2) {
      setCityResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    debounceRef.current = setTimeout(async () => {
      const r = await searchCities(value)
      setCityResults(r)
      setSearching(false)
    }, 300)
  }, [])

  const handleCitySelect = (r: GeoSearchResult) => {
    // Set location for weather/AQI
    setManualGeo({ latitude: r.latitude, longitude: r.longitude, city: r.name })
    setSelectedCity(r.name)
    // Set timezone from the city
    if (r.timezone) {
      setOverride(r.timezone)
    }
    setCityQuery("")
    setCityResults([])
  }

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

  const filteredTz = tzSearch.trim()
    ? TIMEZONE_LIST.filter((tz) =>
        tz.toLowerCase().replace(/_/g, " ").includes(tzSearch.toLowerCase()),
      )
    : TIMEZONE_LIST

  const effectiveTz = override ?? detected

  return (
    <section>
      <div className="flex items-center gap-2">
        <Globe className="size-4 text-muted-foreground/60" />
        <Label className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Location & Timezone
        </Label>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Set your city for weather and air quality, or just pick a timezone.
      </p>

      {/* Current state summary */}
      <div className="mt-3 flex items-center gap-2 rounded-xl border border-border/40 px-3 py-2.5">
        <Icons.MapPin className="size-4 shrink-0 text-muted-foreground/40" />
        <div className="min-w-0 flex-1">
          {selectedCity ? (
            <p className="text-sm font-medium">{selectedCity}</p>
          ) : (
            <p className="text-sm text-muted-foreground/60">No city set</p>
          )}
          <p className="font-mono text-xs text-muted-foreground/50">
            {effectiveTz.replace(/_/g, " ")} ({getOffset(effectiveTz)})
          </p>
        </div>
        {(selectedCity || override) && (
          <button
            onClick={() => {
              localStorage.removeItem("statusbar-manual-location")
              setSelectedCity(null)
              setOverride(null)
            }}
            className="text-xs text-muted-foreground/40 hover:text-foreground"
          >
            Reset
          </button>
        )}
      </div>

      {/* Mode tabs */}
      <div className="mt-3 flex gap-1 rounded-lg border border-border/30 p-0.5">
        {([
          { id: "city" as LocTzMode, label: "Search City", icon: Icons.MapPin },
          { id: "timezone" as LocTzMode, label: "Timezone Only", icon: Icons.Clock },
        ]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setMode(id)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-all ${
              mode === id
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground/50 hover:text-muted-foreground"
            }`}
          >
            <Icon className="size-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* City search mode */}
      {mode === "city" && (
        <div className="mt-3">
          <div className="relative">
            <Icons.Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/40" />
            <input
              type="text"
              placeholder="Search for your city..."
              value={cityQuery}
              onChange={(e) => handleCitySearch(e.target.value)}
              className="h-11 w-full rounded-xl border border-border/40 bg-transparent pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground/30 focus:border-primary/30"
            />
            {searching && (
              <Icons.Loader2 className="absolute right-3 top-1/2 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground/40" />
            )}
          </div>

          {cityResults.length > 0 && (
            <div className="mt-1.5 overflow-hidden rounded-xl border border-border/30">
              {cityResults.map((r, i) => (
                <button
                  key={`${r.latitude}-${r.longitude}-${i}`}
                  onClick={() => handleCitySelect(r)}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/30"
                >
                  <Icons.MapPin className="size-3.5 shrink-0 text-muted-foreground/40" />
                  <div className="min-w-0 flex-1">
                    <span className="font-medium">{r.name}</span>
                    <span className="ml-1 text-muted-foreground/50">
                      {r.admin1 ? `${r.admin1}, ` : ""}{r.country}
                    </span>
                  </div>
                  {r.timezone && (
                    <span className="shrink-0 font-mono text-xs text-muted-foreground/40">
                      {getOffset(r.timezone)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {cityQuery.length >= 2 && !searching && cityResults.length === 0 && (
            <p className="mt-2 text-center text-xs text-muted-foreground/40">No cities found</p>
          )}

          <p className="mt-2 text-xs text-muted-foreground/40">
            Sets location for weather, air quality, and timezone.
          </p>
        </div>
      )}

      {/* Timezone-only mode */}
      {mode === "timezone" && (
        <div className="mt-3">
          <div className="relative">
            <Icons.Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/40" />
            <input
              type="text"
              placeholder="Search timezones..."
              value={tzSearch}
              onChange={(e) => setTzSearch(e.target.value)}
              className="h-11 w-full rounded-xl border border-border/40 bg-transparent pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground/30 focus:border-primary/30"
            />
          </div>

          <div className="mt-1.5 max-h-48 overflow-y-auto rounded-xl border border-border/30">
            {/* Auto-detect */}
            <button
              onClick={() => { setOverride(null); setTzSearch("") }}
              className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/30 ${
                override === null ? "bg-primary/8 text-primary" : "text-foreground"
              }`}
            >
              <Icons.Locate className="size-3.5 text-muted-foreground/50" />
              <span className="flex-1">Auto-detect ({detected.replace(/_/g, " ")})</span>
              {override === null && <Icons.Check className="size-3.5 text-primary" />}
            </button>

            {filteredTz.map((tz) => {
              const isSelected = override === tz
              return (
                <button
                  key={tz}
                  onClick={() => { setOverride(tz); setTzSearch("") }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/30 ${
                    isSelected ? "bg-primary/8 text-primary" : "text-foreground"
                  }`}
                >
                  <span className="flex-1">{tz.replace(/_/g, " ")}</span>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground/50">
                    {getOffset(tz)}
                  </span>
                  {isSelected && <Icons.Check className="size-3.5 shrink-0 text-primary" />}
                </button>
              )
            })}
            {filteredTz.length === 0 && (
              <p className="px-3 py-4 text-center text-xs text-muted-foreground/50">
                No timezones match "{tzSearch}"
              </p>
            )}
          </div>

          <p className="mt-2 text-xs text-muted-foreground/40">
            Only sets timezone. No location data shared.
          </p>
        </div>
      )}
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
