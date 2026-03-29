"use client"

import { useCallback, useEffect, useState } from "react"
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
import type { EnabledIntegration } from "@/lib/integrations/types"
import { listIntegrations, toggleIntegration } from "@/lib/data-layer"
import { useMascot, MASCOT_CHARACTERS } from "@/lib/mascot"
import * as Icons from "lucide-react"
import { GoogleCalendarSettings } from "./GoogleCalendarSettings"
import { GoogleServicesSettings } from "./GoogleServicesSettings"
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
  const [integrations, setIntegrations] = useState<EnabledIntegration[]>([])
  const categories = getIntegrationsByCategory()

  const fetchIntegrations = useCallback(async () => {
    try {
      const data = await listIntegrations()
      setIntegrations(data as EnabledIntegration[])
    } catch {}
  }, [])

  useEffect(() => {
    fetchIntegrations()
  }, [fetchIntegrations])

  const isEnabled = (integrationId: string): boolean => {
    const record = integrations.find((i) => i.integrationId === integrationId)
    return record?.enabled ?? false
  }

  const toggle = async (integrationId: string, enabled: boolean) => {
    setIntegrations((prev) => {
      const existing = prev.find((i) => i.integrationId === integrationId)
      if (existing) {
        return prev.map((i) =>
          i.integrationId === integrationId ? { ...i, enabled } : i
        )
      }
      return [
        ...prev,
        {
          id: integrationId,
          integrationId,
          enabled,
          config: null,
          createdAt: new Date().toISOString(),
        },
      ]
    })

    try {
      await toggleIntegration(integrationId, enabled)
      fetchIntegrations()
    } catch {
      fetchIntegrations()
    }
  }

  return (
    <div className="mx-auto max-w-2xl overflow-auto px-6 py-8">
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

      <Separator className="my-8 bg-border/30" />

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

      <Separator className="my-8 bg-border/30" />

      {/* Timezone */}
      <TimezoneSettings />

      <Separator className="my-8 bg-border/30" />

      {/* Mascot Buddy */}
      <MascotSettings />

      <Separator className="my-8 bg-border/30" />

      {/* Integrations */}
      <section>
        <Label className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Integrations
        </Label>
        <p className="mt-2 text-xs text-muted-foreground">
          Enable data sources to populate your dashboard. Built-in integrations
          work out of the box. External ones will require connecting your
          account.
        </p>

        <div className="mt-6 space-y-8">
          {Array.from(categories.entries()).map(([category, items]) => (
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
              <div className="space-y-1">
                {items.map((def) => {
                  const Icon = getIcon(def.icon)
                  const enabled = isEnabled(def.id)

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
                          {def.builtIn && (
                            <Badge
                              variant="secondary"
                              className="px-1 py-0 font-mono text-xs uppercase"
                            >
                              built-in
                            </Badge>
                          )}
                          {!def.builtIn && !def.implemented && (
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
                      <Switch

                        checked={enabled}
                        onCheckedChange={(checked) => toggle(def.id, checked)}
                        disabled={!def.builtIn && !def.implemented}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <Separator className="my-8 bg-border/30" />

      {/* About */}
      <section className="pb-8">
        <Label className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          About
        </Label>
        <div className="mt-3 space-y-1 text-sm text-muted-foreground">
          <p className="font-[family-name:var(--font-display)] font-medium text-foreground">
            Third Screen
          </p>
          <p className="font-mono text-xs text-muted-foreground/50">v1.0.0</p>
        </div>
      </section>
    </div>
  )
}

// ── Timezone Settings ────────────────────────────────────────────────────────

function TimezoneSettings() {
  const { timezone, detected, override, setOverride } = useTimezone()
  const isAuto = override === null

  return (
    <section>
      <div className="flex items-center gap-2">
        <Globe className="size-4 text-muted-foreground/60" />
        <Label className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Timezone
        </Label>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Used for calendar events and schedule display. Auto-detected from your
        browser.
      </p>

      <div className="mt-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{timezone.replace(/_/g, " ")}</p>
          {isAuto && (
            <p className="text-xs text-muted-foreground/50">Auto-detected</p>
          )}
          {!isAuto && (
            <p className="text-xs text-muted-foreground/50">
              Manual override (detected: {detected.replace(/_/g, " ")})
            </p>
          )}
        </div>
        {!isAuto && (
          <button
            onClick={() => setOverride(null)}
            className="rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/30"
          >
            Reset to auto
          </button>
        )}
      </div>

      <div className="mt-3">
        <Select
          value={override ?? "__auto__"}
          onValueChange={(val) => setOverride(val === "__auto__" ? null : val)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select timezone" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__auto__">
              Auto-detect ({detected.replace(/_/g, " ")})
            </SelectItem>
            {TIMEZONE_LIST.map((tz) => {
              const now = new Date()
              const offset = new Intl.DateTimeFormat("en-US", {
                timeZone: tz,
                timeZoneName: "shortOffset",
              })
                .formatToParts(now)
                .find((p) => p.type === "timeZoneName")?.value ?? ""
              return (
                <SelectItem key={tz} value={tz}>
                  {tz.replace(/_/g, " ")} ({offset})
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
      </div>
    </section>
  )
}

// ── Mascot Settings ──────────────────────────────────────────────────────────

function MascotSettings() {
  const { enabled, setEnabled, soundEnabled, setSoundEnabled, character, setCharacter } = useMascot()

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
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icons.Volume2 className="size-4 text-muted-foreground/60" />
              <Label className="text-xs text-muted-foreground">Sound effects</Label>
            </div>
            <Switch checked={soundEnabled} onCheckedChange={setSoundEnabled} />
          </div>
        </>
      )}
    </section>
  )
}
