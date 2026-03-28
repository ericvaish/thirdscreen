"use client"

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Slider } from "@/components/ui/slider"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Palette, RotateCcw, X } from "lucide-react"
import {
  useThemeCustomizer,
  ZONE_KEYS,
  ZONE_META,
  HUE_SWATCHES,
  PRESETS,
  type ThemeZone,
  type GradientStyle,
  type CardBackground,
} from "@/lib/theme-customizer"

// ── Hue to preview color (for swatches) ────────────────────────────────────

function huePreview(hue: number): string {
  return `oklch(0.7 0.17 ${hue})`
}

// ── Gradient style options ─────────────────────────────────────────────────

const GRADIENT_OPTIONS: { value: GradientStyle; label: string }[] = [
  { value: "glow", label: "Glow" },
  { value: "border", label: "Border" },
  { value: "flat", label: "Flat" },
]

const BG_OPTIONS: { value: CardBackground; label: string; desc: string }[] = [
  { value: "default", label: "Default", desc: "Standard dark/light" },
  { value: "oled", label: "OLED", desc: "Pure black" },
  { value: "lighter", label: "Lighter", desc: "Slightly raised" },
  { value: "tinted", label: "Tinted", desc: "Accent-colored" },
]

// ── Component ──────────────────────────────────────────────────────────────

export function ThemeCustomizer() {
  const { theme, loaded, updateTheme, applyPreset, resetTheme } = useThemeCustomizer()

  if (!loaded) return null

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground hover:text-foreground"
          title="Customize theme"
        >
          <Palette className="size-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-80 p-0" showCloseButton={false} overlayClassName="!bg-transparent !backdrop-blur-none">
        <SheetHeader className="px-4 pt-4 pb-2">
          <div className="flex items-center justify-between">
            <SheetTitle className="font-[family-name:var(--font-display)] text-sm font-bold tracking-tight">
              Theme
            </SheetTitle>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={resetTheme}
                className="text-muted-foreground/50 hover:text-foreground"
                title="Reset to defaults"
              >
                <RotateCcw className="size-4" />
              </Button>
              <SheetClose asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground/50 hover:text-foreground"
                  title="Close"
                >
                  <X className="size-4" />
                </Button>
              </SheetClose>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-4rem)]">
          <div className="space-y-6 px-4 pb-8">
            {/* ── Presets ─────────────────────────────────────────────── */}
            <section>
              <SectionLabel>Presets</SectionLabel>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {Object.entries(PRESETS).map(([id, preset]) => (
                  <button
                    key={id}
                    onClick={() => applyPreset(id)}
                    className={`rounded-lg border px-3 py-1.5 font-mono text-xs font-medium transition-all active:scale-95 ${
                      theme.preset === id
                        ? "border-primary/40 bg-primary/15 text-primary"
                        : "border-border/20 bg-muted/10 text-muted-foreground hover:border-border/40 hover:bg-muted/20"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </section>

            <Separator className="bg-border/15" />

            {/* ── Card Background ─────────────────────────────────────── */}
            <section>
              <SectionLabel>Card Background</SectionLabel>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {BG_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() =>
                      updateTheme((t) => ({
                        ...t,
                        cardBackground: opt.value,
                        preset: null,
                      }))
                    }
                    className={`flex flex-col items-start rounded-lg border px-3 py-2 text-left transition-all active:scale-[0.98] ${
                      theme.cardBackground === opt.value
                        ? "border-primary/40 bg-primary/10"
                        : "border-border/20 bg-muted/10 hover:border-border/30 hover:bg-muted/15"
                    }`}
                  >
                    <span className={`text-xs font-semibold ${
                      theme.cardBackground === opt.value ? "text-primary" : "text-foreground/80"
                    }`}>
                      {opt.label}
                    </span>
                    <span className="text-xs text-muted-foreground/50">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </section>

            <Separator className="bg-border/15" />

            {/* ── Zone Colors ─────────────────────────────────────────── */}
            <section>
              <SectionLabel>Zone Colors</SectionLabel>
              <div className="mt-3 space-y-4">
                {ZONE_KEYS.filter((z) => z !== "status").map((zone) => (
                  <ZoneColorControl
                    key={zone}
                    zone={zone}
                    hue={theme.zoneAccents[zone] ?? null}
                    gradientStyle={theme.zoneGradients[zone] ?? "glow"}
                    onHueChange={(hue) =>
                      updateTheme((t) => ({
                        ...t,
                        zoneAccents: { ...t.zoneAccents, [zone]: hue },
                        preset: null,
                      }))
                    }
                    onGradientChange={(style) =>
                      updateTheme((t) => ({
                        ...t,
                        zoneGradients: { ...t.zoneGradients, [zone]: style },
                        preset: null,
                      }))
                    }
                  />
                ))}
              </div>
            </section>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground/50">
      {children}
    </p>
  )
}

function ZoneColorControl({
  zone,
  hue,
  gradientStyle,
  onHueChange,
  onGradientChange,
}: {
  zone: ThemeZone
  hue: number | null
  gradientStyle: GradientStyle
  onHueChange: (hue: number | null) => void
  onGradientChange: (style: GradientStyle) => void
}) {
  const meta = ZONE_META[zone]
  const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark")
  const effectiveHue = hue ?? meta.defaultHue[isDark ? "dark" : "light"]

  return (
    <div className="space-y-2">
      {/* Zone label + accent preview */}
      <div className="flex items-center gap-2">
        <div
          className="size-3 rounded-full"
          style={{ backgroundColor: huePreview(effectiveHue) }}
        />
        <span className="text-xs font-semibold text-foreground/80">{meta.label}</span>
        {hue != null && (
          <button
            onClick={() => onHueChange(null)}
            className="ml-auto font-mono text-xs text-muted-foreground/30 hover:text-foreground"
          >
            reset
          </button>
        )}
      </div>

      {/* Color swatches */}
      <div className="flex flex-wrap gap-1">
        {HUE_SWATCHES.map((s) => (
          <button
            key={s.hue}
            onClick={() => onHueChange(s.hue)}
            className={`size-6 rounded-full border-2 transition-all active:scale-90 ${
              effectiveHue === s.hue && hue != null
                ? "border-foreground/60 scale-110"
                : "border-transparent hover:border-foreground/20"
            }`}
            style={{ backgroundColor: huePreview(s.hue) }}
            title={s.label}
          />
        ))}
      </div>

      {/* Hue slider for fine control */}
      <div
        className="rounded-md p-1"
        style={{
          background: "linear-gradient(to right, oklch(0.7 0.17 0), oklch(0.7 0.17 60), oklch(0.7 0.17 120), oklch(0.7 0.17 180), oklch(0.7 0.17 240), oklch(0.7 0.17 300), oklch(0.7 0.17 360))",
        }}
      >
        <Slider
          min={0}
          max={360}
          step={1}
          value={[effectiveHue]}
          onValueChange={([v]) => onHueChange(v)}
          className="[&_[data-slot=slider-track]]:bg-transparent [&_[data-slot=slider-range]]:bg-transparent [&_[data-slot=slider-thumb]]:size-4 [&_[data-slot=slider-thumb]]:border-2 [&_[data-slot=slider-thumb]]:border-white [&_[data-slot=slider-thumb]]:shadow-md"
        />
      </div>

      {/* Gradient style */}
      <div className="flex gap-1">
        {GRADIENT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onGradientChange(opt.value)}
            className={`flex-1 rounded-md px-2 py-1 font-mono text-xs transition-all active:scale-95 ${
              gradientStyle === opt.value
                ? "bg-foreground/10 text-foreground/80"
                : "text-muted-foreground/40 hover:bg-foreground/5 hover:text-muted-foreground/60"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
