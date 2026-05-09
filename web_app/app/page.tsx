import Link from "next/link"
import type { Metadata } from "next"
import type { CSSProperties } from "react"
import { ThemeScreenshot } from "@/components/theme-screenshot"
import { ContainerScroll } from "@/components/ui/container-scroll"

export const metadata: Metadata = {
  title: "Third Screen - Your day, at a glance",
  description:
    "A glanceable personal dashboard. Schedule, tasks, notes, health, music, lyrics. One screen, zero scrolling. Open source.",
}

const GITHUB_REPO = "https://github.com/ericvaish/thirdscreen"

const CONNECTIONS = [
  { icon: "🎵", title: "Spotify", desc: "Now playing, playback controls, synced lyrics, device switching" },
  { icon: "📅", title: "Google Calendar", desc: "Multi-account sync, event colors, all-day events on the timeline" },
  { icon: "📧", title: "Gmail", desc: "Unread count and message previews right on your dashboard" },
  { icon: "💬", title: "Google Chat", desc: "Recent messages from your spaces, always visible" },
  { icon: "🎤", title: "LRCLib Lyrics", desc: "Synced lyrics that scroll with your music, auto-fetched" },
  { icon: "🌤️", title: "Weather", desc: "Current temperature and conditions in your status bar" },
]

// Scope a light glass palette to the landing page only — the rest of the app
// is locked to dark via ThemeProvider, but this page is intentionally light.
const LIGHT_GLASS_VARS: CSSProperties = {
  ["--glass-bg" as string]: "oklch(1 0 0 / 70%)",
  ["--glass-border" as string]: "oklch(0 0 0 / 8%)",
  ["--glass-blur" as string]: "blur(24px) saturate(1.2)",
  fontSize: "16px",
}

export default function LandingPage() {
  return (
    <div
      className="relative min-h-screen overflow-x-hidden bg-[#f6f7fb] text-neutral-900 [&_*]:[user-select:text] [&_*]:[-webkit-user-select:text]"
      style={LIGHT_GLASS_VARS}
    >
      {/* Ambient backdrop — soft pastel washes for the light theme */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.16),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(6,182,212,0.14),transparent_50%),radial-gradient(ellipse_at_bottom_left,rgba(168,85,247,0.10),transparent_45%)]" />
        <div className="absolute inset-0 bg-white/30" />
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(0,0,0,0.6) 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        />
      </div>

      {/* Nav */}
      <nav className="fixed inset-x-0 top-4 z-50 px-4">
        <div className="ts-pill-glass mx-auto flex max-w-6xl items-center justify-between gap-3 rounded-full px-5 py-2.5">
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/thirdscreen_logo.svg" alt="Third Screen" className="h-7 w-7" />
            <span className="font-[family-name:var(--font-display)] text-base font-semibold tracking-tight text-neutral-900">Third Screen</span>
          </Link>
          <div className="flex items-center gap-1.5">
            <Link href="/pricing" className="hidden rounded-full px-3 py-1.5 text-sm text-neutral-500 transition-colors hover:bg-black/[0.04] hover:text-neutral-900 sm:inline-flex">
              Pricing
            </Link>
            <a href={GITHUB_REPO} target="_blank" rel="noopener noreferrer" className="hidden rounded-full px-3 py-1.5 text-sm text-neutral-500 transition-colors hover:bg-black/[0.04] hover:text-neutral-900 sm:inline-flex">
              GitHub
            </a>
            <Link href="/sign-in" className="rounded-full px-3 py-1.5 text-sm text-neutral-500 transition-colors hover:bg-black/[0.04] hover:text-neutral-900">
              Sign in
            </Link>
            <Link
              href="/sign-in"
              className="rounded-full bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white transition-all hover:-translate-y-0.5 hover:bg-neutral-800"
            >
              Sign up
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero with scroll-tilted screenshot */}
      <section className="relative pt-24">
        <ContainerScroll
          titleComponent={
            <div className="px-6">
              <div className="ts-pill-glass mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                <span className="font-[family-name:var(--font-mono)] text-xs font-medium tracking-wide text-neutral-600">Open source</span>
                <span className="text-neutral-300">|</span>
                <span className="font-[family-name:var(--font-mono)] text-xs font-medium tracking-wide text-neutral-600">Self-hostable</span>
              </div>

              <h1 className="font-[family-name:var(--font-display)] text-5xl font-bold leading-[1.05] tracking-tight text-neutral-900 sm:text-6xl md:text-7xl">
                Your day,
                <br />
                <span className="bg-gradient-to-r from-blue-500 via-cyan-500 to-violet-500 bg-clip-text text-transparent">at a glance.</span>
              </h1>

              <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-neutral-500 sm:text-xl">
                Schedule, tasks, health, music, lyrics. One screen, zero scrolling. No account required.
              </p>

              <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/app"
                  className="inline-flex items-center gap-2.5 rounded-full bg-neutral-900 px-7 py-3 text-base font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-neutral-800"
                >
                  Open Dashboard
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                </Link>
                <a
                  href={GITHUB_REPO}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ts-pill-glass inline-flex items-center gap-2.5 rounded-full px-7 py-3 text-base text-neutral-700 transition-all hover:-translate-y-0.5 hover:text-neutral-900"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                  View Source
                </a>
              </div>
            </div>
          }
        >
          <ThemeScreenshot
            name="horizontal"
            alt="Third Screen dashboard"
            className="h-full w-full object-cover"
          />
        </ContainerScroll>
      </section>

      {/* Adaptive layout */}
      <section className="relative px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="glass-card grid items-center gap-12 rounded-3xl p-8 md:p-12 lg:grid-cols-2">
            <div>
              <p className="mb-3 font-[family-name:var(--font-mono)] text-sm font-medium uppercase tracking-widest text-blue-600">
                Adaptive layout
              </p>
              <h2 className="font-[family-name:var(--font-display)] text-4xl font-bold leading-tight tracking-tight text-neutral-900 sm:text-5xl">
                Fits any screen shape.
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-neutral-500">
                Landscape monitor, portrait tablet, ultrawide. The dashboard rearranges to fill every pixel. Mount it on a wall, prop it on a desk, or keep it in a browser tab.
              </p>
              <div className="mt-8 flex flex-wrap gap-2.5">
                {["Landscape", "Portrait", "Ultrawide", "Tablet"].map((label) => (
                  <span
                    key={label}
                    className="ts-pill-glass rounded-full px-4 py-1.5 font-[family-name:var(--font-mono)] text-xs font-medium text-neutral-700"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex justify-center">
              <div className="glass-card relative w-72 overflow-hidden rounded-2xl p-1.5">
                <ThemeScreenshot name="vertical" alt="Third Screen dashboard - portrait" className="h-auto w-full rounded-xl" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Connections */}
      <section className="relative px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 text-center">
            <p className="mb-3 font-[family-name:var(--font-mono)] text-sm font-medium uppercase tracking-widest text-blue-600">
              Connections
            </p>
            <h2 className="font-[family-name:var(--font-display)] text-4xl font-bold tracking-tight text-neutral-900 sm:text-5xl">
              Plugs into what you already use.
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CONNECTIONS.map((c) => (
              <div
                key={c.title}
                className="glass-card group rounded-2xl p-6 transition-all hover:-translate-y-0.5"
              >
                <div className="mb-3 text-2xl">{c.icon}</div>
                <h3 className="mb-1.5 font-semibold text-neutral-900">{c.title}</h3>
                <p className="text-sm leading-relaxed text-neutral-500">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Open source + self-host */}
      <section className="relative px-6 py-24">
        <div className="mx-auto max-w-4xl text-center">
          <p className="mb-3 font-[family-name:var(--font-mono)] text-sm font-medium uppercase tracking-widest text-blue-600">
            Your data, your way
          </p>
          <h2 className="font-[family-name:var(--font-display)] text-4xl font-bold tracking-tight text-neutral-900 sm:text-5xl">
            Open source. Self-hostable.
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-lg leading-relaxed text-neutral-500">
            Use the hosted version at thirdscr.com for free. Or clone the repo and run it on your own server. Your dashboard, your rules.
          </p>

          <div className="mx-auto mt-12 grid max-w-2xl gap-4 sm:grid-cols-2">
            <Link
              href="/app"
              className="glass-card group rounded-2xl p-8 text-left transition-all hover:-translate-y-0.5"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/15 ring-1 ring-blue-500/20">
                <svg className="h-5 w-5 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
              </div>
              <h3 className="mb-1 text-lg font-semibold text-neutral-900">Use hosted version</h3>
              <p className="text-sm text-neutral-500">Sign in and start using immediately. Free. We handle the infrastructure.</p>
            </Link>
            <a
              href={GITHUB_REPO}
              target="_blank"
              rel="noopener noreferrer"
              className="glass-card group rounded-2xl p-8 text-left transition-all hover:-translate-y-0.5"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-black/[0.06] ring-1 ring-black/10">
                <svg className="h-5 w-5 text-neutral-700" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
              </div>
              <h3 className="mb-1 text-lg font-semibold text-neutral-900">Self-host</h3>
              <p className="text-sm text-neutral-500">Clone the repo, run one command, own your data entirely. MIT licensed.</p>
            </a>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative px-6 py-28">
        <div className="mx-auto max-w-3xl">
          <div className="glass-card relative overflow-hidden rounded-3xl p-12 text-center md:p-16">
            <div className="pointer-events-none absolute inset-0 -z-0 bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.16),transparent_60%)]" />
            <div className="relative z-10">
              <img src="/thirdscreen_logo.svg" alt="" className="mx-auto mb-6 h-14 w-14" />
              <h2 className="font-[family-name:var(--font-display)] text-4xl font-bold tracking-tight text-neutral-900 sm:text-5xl">
                Ready to try it?
              </h2>
              <p className="mx-auto mb-10 mt-4 max-w-md text-lg text-neutral-500">
                Free. Open source. No account required to start.
              </p>
              <Link
                href="/app"
                className="inline-flex items-center gap-2.5 rounded-full bg-neutral-900 px-8 py-3.5 text-base font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-neutral-800"
              >
                Open Dashboard
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative px-4 pb-6">
        <div className="ts-pill-glass mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 rounded-full px-6 py-3 sm:flex-row">
          <div className="flex items-center gap-2">
            <img src="/thirdscreen_logo.svg" alt="" className="h-4 w-4 opacity-60" />
            <span className="text-sm text-neutral-500">
              Third Screen by{" "}
              <a href="https://ericvaish.com" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-neutral-900">
                Eric Vaish
              </a>
            </span>
          </div>
          <div className="flex items-center gap-5">
            <Link href="/privacy" className="text-sm text-neutral-500 transition-colors hover:text-neutral-900">Privacy</Link>
            <Link href="/terms" className="text-sm text-neutral-500 transition-colors hover:text-neutral-900">Terms</Link>
            <a href={GITHUB_REPO} target="_blank" rel="noopener noreferrer" className="text-sm text-neutral-500 transition-colors hover:text-neutral-900">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
