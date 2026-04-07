import Link from "next/link"
import type { Metadata } from "next"
import { ThemeScreenshot } from "@/components/theme-screenshot"
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler"

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


export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-neutral-900 dark:bg-[#09090b] dark:text-white" style={{ fontSize: "16px" }}>
      {/* Nav */}
      <nav className="fixed inset-x-0 top-0 z-50 border-b border-neutral-200 bg-white/80 backdrop-blur-xl dark:border-white/[0.04] dark:bg-[#09090b]/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <img src="/thirdscreen_logo.svg" alt="Third Screen" className="h-7 w-7" />
            <span className="text-lg font-semibold tracking-tight font-[family-name:var(--font-display)]">Third Screen</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/pricing" className="hidden text-sm text-neutral-400 transition-colors hover:text-neutral-600 sm:block dark:text-white/40 dark:hover:text-white/70">
              Pricing
            </Link>
            <a href={GITHUB_REPO} target="_blank" rel="noopener noreferrer" className="hidden text-sm text-neutral-400 transition-colors hover:text-neutral-600 sm:block dark:text-white/40 dark:hover:text-white/70">
              GitHub
            </a>
            <AnimatedThemeToggler />
            <Link href="/app?sign-in=1" className="text-sm text-neutral-400 transition-colors hover:text-neutral-600 dark:text-white/40 dark:hover:text-white/70">
              Sign In
            </Link>
            <Link href="/app?sign-up=1" className="text-sm font-medium rounded-full bg-neutral-900 px-4 py-1.5 text-white transition-colors hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-white/90">
              Sign Up
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative flex flex-col items-center px-6 pt-28 pb-0">
        <div className="pointer-events-none absolute left-1/2 top-1/3 h-[600px] w-[1000px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/[0.04] blur-[150px] dark:bg-[#3b82f6]/[0.06]" />

        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-4 py-1.5 dark:border-white/[0.08] dark:bg-white/[0.03]">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            <span className="text-xs font-medium tracking-wide text-neutral-500 font-[family-name:var(--font-mono)] dark:text-white/50">Open source</span>
            <span className="text-neutral-300 dark:text-white/10">|</span>
            <span className="text-xs font-medium tracking-wide text-neutral-500 font-[family-name:var(--font-mono)] dark:text-white/50">Self-hostable</span>
          </div>

          <h1 className="font-[family-name:var(--font-display)] text-5xl font-bold tracking-tight leading-[1.08] sm:text-6xl md:text-7xl">
            Your day,{" "}
            <span className="bg-gradient-to-r from-[#3b82f6] to-[#06b6d4] bg-clip-text text-transparent">at a glance.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-lg text-lg text-neutral-500 leading-relaxed sm:text-xl dark:text-white/40">
            Schedule, tasks, health, music, lyrics. One screen, zero scrolling.
            No account required.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/app"
              className="inline-flex items-center gap-2.5 rounded-full bg-neutral-900 px-8 py-3.5 text-base font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-white/90"
            >
              Open Dashboard
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            </Link>
            <a
              href={GITHUB_REPO}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 rounded-full border border-neutral-200 px-8 py-3.5 text-base text-neutral-500 transition-all hover:-translate-y-0.5 hover:border-neutral-300 hover:text-neutral-700 dark:border-white/10 dark:text-white/50 dark:hover:border-white/20 dark:hover:text-white/70"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
              View Source
            </a>
          </div>
        </div>

        {/* Hero screenshot - horizontal */}
        <div className="relative z-10 mx-auto mt-16 w-full max-w-6xl">
          <div className="relative overflow-hidden rounded-xl shadow-2xl shadow-black/20 ring-1 ring-neutral-200 dark:shadow-black/60 dark:ring-white/10">
            <ThemeScreenshot name="horizontal" alt="Third Screen dashboard - landscape" className="h-auto w-full" />
          </div>
          <div className="pointer-events-none absolute -bottom-16 left-1/2 h-32 w-3/4 -translate-x-1/2 rounded-full bg-blue-500/[0.04] blur-[80px] dark:bg-[#3b82f6]/[0.06]" />
        </div>
      </section>

      {/* "Any screen" section with vertical screenshot */}
      <section className="relative py-32 px-6">
        <div className="mx-auto max-w-6xl">
          <div className="grid items-center gap-16 lg:grid-cols-2">
            <div>
              <p className="mb-3 text-sm font-medium uppercase tracking-widest text-[#3b82f6] font-[family-name:var(--font-mono)]">Adaptive layout</p>
              <h2 className="font-[family-name:var(--font-display)] text-4xl font-bold tracking-tight sm:text-5xl">
                Fits any screen shape.
              </h2>
              <p className="mt-5 text-lg text-neutral-500 leading-relaxed dark:text-white/35">
                Landscape monitor, portrait tablet, ultrawide. The dashboard rearranges to fill every pixel. Mount it on a wall, prop it on a desk, or keep it in a browser tab.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                {["Landscape", "Portrait", "Ultrawide", "Tablet"].map((label) => (
                  <span key={label} className="rounded-full border border-neutral-200 bg-neutral-50 px-4 py-1.5 text-xs font-medium text-neutral-500 font-[family-name:var(--font-mono)] dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-white/40">
                    {label}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex justify-center">
              <div className="relative w-72 overflow-hidden rounded-2xl shadow-2xl shadow-black/20 ring-1 ring-neutral-200 dark:shadow-black/50 dark:ring-white/10">
                <ThemeScreenshot name="vertical" alt="Third Screen dashboard - portrait" className="h-auto w-full" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Connections */}
      <section className="relative py-28 px-6">
        <div className="mx-auto max-w-5xl">
          <div className="mb-16 text-center">
            <p className="mb-3 text-sm font-medium uppercase tracking-widest text-[#3b82f6] font-[family-name:var(--font-mono)]">Connections</p>
            <h2 className="font-[family-name:var(--font-display)] text-4xl font-bold tracking-tight sm:text-5xl">Plugs into what you already use.</h2>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CONNECTIONS.map((c) => (
              <div
                key={c.title}
                className="rounded-2xl bg-neutral-50 p-6 ring-1 ring-neutral-200 transition-all hover:-translate-y-0.5 hover:ring-neutral-300 dark:bg-[#111] dark:ring-white/[0.06] dark:hover:ring-white/[0.12]"
              >
                <div className="mb-3 text-2xl">{c.icon}</div>
                <h3 className="mb-1.5 font-semibold">{c.title}</h3>
                <p className="text-sm leading-relaxed text-neutral-500 dark:text-white/35">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Open source + self-host */}
      <section className="relative py-24 px-6">
        <div className="mx-auto max-w-4xl text-center">
          <p className="mb-3 text-sm font-medium uppercase tracking-widest text-[#3b82f6] font-[family-name:var(--font-mono)]">Your data, your way</p>
          <h2 className="font-[family-name:var(--font-display)] text-4xl font-bold tracking-tight sm:text-5xl">Open source. Self-hostable.</h2>
          <p className="mx-auto mt-5 max-w-lg text-lg text-neutral-500 leading-relaxed dark:text-white/35">
            Use the hosted version at thirdscr.com for free. Or clone the repo and run it on your own server. Your dashboard, your rules.
          </p>

          <div className="mx-auto mt-12 grid max-w-2xl gap-4 sm:grid-cols-2">
            <Link
              href="/app"
              className="group rounded-2xl bg-neutral-50 p-8 ring-1 ring-neutral-200 text-left transition-all hover:-translate-y-0.5 hover:ring-neutral-300 dark:bg-[#111] dark:ring-white/[0.06] dark:hover:ring-white/[0.12]"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-[#3b82f6]/10">
                <svg className="h-5 w-5 text-[#3b82f6]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
              </div>
              <h3 className="mb-1 text-lg font-semibold">Use hosted version</h3>
              <p className="text-sm text-neutral-500 dark:text-white/35">Sign in and start using immediately. Free. We handle the infrastructure.</p>
            </Link>
            <a
              href={GITHUB_REPO}
              target="_blank"
              rel="noopener noreferrer"
              className="group rounded-2xl bg-neutral-50 p-8 ring-1 ring-neutral-200 text-left transition-all hover:-translate-y-0.5 hover:ring-neutral-300 dark:bg-[#111] dark:ring-white/[0.06] dark:hover:ring-white/[0.12]"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-200 dark:bg-white/[0.06]">
                <svg className="h-5 w-5 text-neutral-600 dark:text-white/60" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
              </div>
              <h3 className="mb-1 text-lg font-semibold">Self-host</h3>
              <p className="text-sm text-neutral-500 dark:text-white/35">Clone the repo, run one command, own your data entirely. MIT licensed.</p>
            </a>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative py-28 px-6">
        <div className="mx-auto max-w-3xl text-center">
          <div className="pointer-events-none absolute inset-x-0 top-1/2 mx-auto h-[300px] w-[500px] -translate-y-1/2 rounded-full bg-blue-500/[0.03] blur-[100px] dark:bg-[#3b82f6]/[0.05]" />
          <div className="relative z-10">
            <img src="/thirdscreen_logo.svg" alt="" className="mx-auto mb-8 h-14 w-14" />
            <h2 className="font-[family-name:var(--font-display)] text-4xl font-bold tracking-tight sm:text-5xl">Ready to try it?</h2>
            <p className="mx-auto mb-10 mt-4 max-w-md text-lg text-neutral-500 dark:text-white/35">Free. Open source. No account required to start.</p>
            <Link
              href="/app"
              className="inline-flex items-center gap-2.5 rounded-full bg-neutral-900 px-8 py-3.5 text-base font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-white/90"
            >
              Open Dashboard
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-200 py-6 px-6 dark:border-white/[0.04]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <img src="/thirdscreen_logo.svg" alt="" className="h-4 w-4 opacity-30" />
            <span className="text-sm text-neutral-400 dark:text-white/25">Third Screen by <a href="https://ericvaish.com" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-neutral-600 dark:hover:text-white/50">Eric Vaish</a></span>
          </div>
          <div className="flex items-center gap-5">
            <Link href="/privacy" className="text-sm text-neutral-400 transition-colors hover:text-neutral-600 dark:text-white/25 dark:hover:text-white/50">Privacy</Link>
            <Link href="/terms" className="text-sm text-neutral-400 transition-colors hover:text-neutral-600 dark:text-white/25 dark:hover:text-white/50">Terms</Link>
            <a href={GITHUB_REPO} target="_blank" rel="noopener noreferrer" className="text-sm text-neutral-400 transition-colors hover:text-neutral-600 dark:text-white/25 dark:hover:text-white/50">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
