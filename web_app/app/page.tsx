import Link from "next/link"
import type { Metadata } from "next"
import { ThemeScreenshot } from "@/components/theme-screenshot"
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler"
import { ContainerScroll } from "@/components/ui/container-scroll"

export const metadata: Metadata = {
  title: "Third Screen - Your day, at a glance",
  description:
    "A glanceable personal dashboard. Schedule, tasks, notes, health, music, lyrics. One screen, zero scrolling. Open source.",
}

const GITHUB_REPO = "https://github.com/ericvaish/thirdscreen"

const CONNECTIONS = [
  {
    icon: "🎵",
    title: "Spotify",
    desc: "Now playing, playback controls, synced lyrics, device switching",
  },
  {
    icon: "📅",
    title: "Google Calendar",
    desc: "Multi-account sync, event colors, all-day events on the timeline",
  },
  {
    icon: "📧",
    title: "Gmail",
    desc: "Unread count and message previews right on your dashboard",
  },
  {
    icon: "💬",
    title: "Google Chat",
    desc: "Recent messages from your spaces, always visible",
  },
  {
    icon: "🎤",
    title: "LRCLib Lyrics",
    desc: "Synced lyrics that scroll with your music, auto-fetched",
  },
  {
    icon: "🌤️",
    title: "Weather",
    desc: "Current temperature and conditions in your status bar",
  },
]

/* Layout primitives — one container width and one spacing rhythm for every
   section, so the page reads on a single vertical scale. */
const CONTAINER = "mx-auto w-full max-w-6xl px-5 sm:px-6 lg:px-8"
const SECTION = "relative py-20 sm:py-24 lg:py-28"
const EYEBROW =
  "font-[family-name:var(--font-mono)] text-xs font-semibold tracking-[0.18em] uppercase text-blue-600 dark:text-blue-400"
const H2 =
  "font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight text-balance sm:text-4xl lg:text-[2.75rem] lg:leading-[1.1]"

/* One primary action on the page: a solid, high-contrast pill. Everything
   else (nav, secondary CTAs) stays quiet so the hierarchy holds. */
const BTN_PRIMARY =
  "inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-6 py-3 text-base font-semibold text-background shadow-lg shadow-foreground/10 transition-all hover:-translate-y-0.5 hover:opacity-90"

function ArrowRight({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  )
}

function GitHubMark({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  )
}

export default function LandingPage() {
  return (
    <div className="ts-landing relative min-h-screen overflow-x-hidden bg-background text-foreground [&_*]:[-webkit-user-select:text] [&_*]:[user-select:text]">
      {/* Ambient backdrop — one soft brand wash plus a faint dot grid. The dots
          use currentColor so they invert with the theme. */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_55%_at_50%_-10%,rgba(59,130,246,0.18),transparent_60%),radial-gradient(ellipse_60%_45%_at_100%_100%,rgba(6,182,212,0.14),transparent_55%),radial-gradient(ellipse_55%_45%_at_0%_85%,rgba(168,85,247,0.12),transparent_55%)] dark:opacity-80" />
        <div className="absolute inset-0 bg-white/30 dark:bg-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,currentColor_1px,transparent_0)] [background-size:24px_24px] opacity-[0.06] dark:opacity-[0.08]" />
      </div>

      {/* Nav — deliberately low-contrast: it frames the page, it doesn't
          compete with the hero's call to action. */}
      <nav className="fixed inset-x-0 top-3 z-50 px-4 sm:top-4">
        <div className="glass-card mx-auto flex max-w-6xl items-center justify-between gap-2 rounded-full px-3 py-2 shadow-sm sm:px-5 sm:py-2.5">
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <img
              src="/thirdscreen_logo.svg"
              alt="Third Screen"
              className="h-7 w-7"
            />
            <span className="font-[family-name:var(--font-display)] text-base font-semibold tracking-tight">
              Third Screen
            </span>
          </Link>
          <div className="flex items-center gap-0.5 sm:gap-1.5">
            <Link
              href="/pricing"
              className="hidden rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground sm:inline-flex"
            >
              Pricing
            </Link>
            <a
              href={GITHUB_REPO}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground sm:inline-flex"
            >
              GitHub
            </a>
            <AnimatedThemeToggler className="size-8 shrink-0 sm:size-9" />
            <Link
              href="/sign-in"
              className="rounded-full px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground sm:px-3"
            >
              Sign in
            </Link>
            <Link
              href="/sign-in"
              className="rounded-full border border-foreground/15 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-foreground/5 sm:px-3.5"
            >
              Sign up
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero — headline, one line of support, one primary action, then the
          product shot. Top padding clears the fixed nav at every width. */}
      <section className="relative pt-28 pb-20 sm:pt-32 sm:pb-24 lg:pt-36 lg:pb-28">
        <div className={CONTAINER}>
          <div className="flex flex-col items-center text-center">
            <div className="glass-card inline-flex items-center gap-2 rounded-full px-3.5 py-1.5">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              <span className="font-[family-name:var(--font-mono)] text-xs font-medium tracking-wide text-muted-foreground">
                Open source
              </span>
              <span className="text-muted-foreground/40">|</span>
              <span className="font-[family-name:var(--font-mono)] text-xs font-medium tracking-wide text-muted-foreground">
                Self-hostable
              </span>
            </div>

            <h1 className="mt-7 max-w-3xl font-[family-name:var(--font-display)] text-[2.75rem] leading-[1.05] font-bold tracking-tight text-balance sm:text-6xl lg:text-7xl">
              Your day,{" "}
              <span className="bg-gradient-to-r from-blue-500 via-cyan-500 to-violet-500 bg-clip-text text-transparent">
                at a glance.
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-relaxed text-pretty text-muted-foreground sm:text-xl">
              Schedule, tasks, health, music, lyrics. One screen, zero
              scrolling. No account required.
            </p>

            <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
              <Link href="/app" className={BTN_PRIMARY}>
                Open Dashboard
                <ArrowRight />
              </Link>
              <a
                href={GITHUB_REPO}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-base text-muted-foreground transition-colors hover:text-foreground"
              >
                <GitHubMark />
                View Source
              </a>
            </div>
          </div>
        </div>

        {/* The product shot sits outside the text container so it can run a
            little wider than the copy on very large screens. */}
        <div className="mt-16 px-5 sm:mt-20 sm:px-6 lg:px-8">
          <ContainerScroll>
            <ThemeScreenshot
              name="horizontal"
              alt="The Third Screen dashboard: timeline, tasks, notes, vitals and music on one screen"
              className="block h-auto w-full"
            />
          </ContainerScroll>
        </div>
      </section>

      {/* Adaptive layout */}
      <section className={SECTION}>
        <div className={CONTAINER}>
          <div className="glass-card grid items-center gap-10 rounded-3xl p-7 sm:p-10 lg:grid-cols-2 lg:gap-14 lg:p-14">
            <div>
              <p className={EYEBROW}>Adaptive layout</p>
              <h2 className={`mt-3 ${H2}`}>Fits any screen shape.</h2>
              <p className="mt-5 max-w-prose text-lg leading-relaxed text-muted-foreground">
                Landscape monitor, portrait tablet, ultrawide. The dashboard
                rearranges to fill every pixel. Mount it on a wall, prop it on a
                desk, or keep it in a browser tab.
              </p>
              <div className="mt-8 flex flex-wrap gap-2.5">
                {["Landscape", "Portrait", "Ultrawide", "Tablet"].map(
                  (label) => (
                    <span
                      key={label}
                      className="rounded-full border border-foreground/10 px-3.5 py-1.5 font-[family-name:var(--font-mono)] text-xs font-medium text-muted-foreground"
                    >
                      {label}
                    </span>
                  )
                )}
              </div>
            </div>
            <div className="flex justify-center">
              <div className="w-56 overflow-hidden rounded-2xl border border-foreground/10 p-1.5 shadow-lg shadow-black/5 sm:w-64 dark:shadow-black/40">
                <ThemeScreenshot
                  name="vertical"
                  alt="The Third Screen dashboard in portrait orientation"
                  className="block h-auto w-full rounded-xl"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Connections */}
      <section className={SECTION}>
        <div className={CONTAINER}>
          <div className="mx-auto max-w-2xl text-center">
            <p className={EYEBROW}>Connections</p>
            <h2 className={`mt-3 ${H2}`}>Plugs into what you already use.</h2>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-4 sm:mt-14 sm:grid-cols-2 lg:grid-cols-3">
            {CONNECTIONS.map((c) => (
              <div
                key={c.title}
                className="glass-card rounded-2xl p-6 transition-transform hover:-translate-y-0.5"
              >
                <div className="mb-3 text-2xl">{c.icon}</div>
                <h3 className="mb-1.5 font-semibold">{c.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {c.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Open source + self-host */}
      <section className={SECTION}>
        <div className={CONTAINER}>
          <div className="mx-auto max-w-2xl text-center">
            <p className={EYEBROW}>Your data, your way</p>
            <h2 className={`mt-3 ${H2}`}>Open source. Self-hostable.</h2>
            <p className="mx-auto mt-5 max-w-lg text-lg leading-relaxed text-pretty text-muted-foreground">
              Use the hosted version at thirdscr.com for free. Or clone the repo
              and run it on your own server. Your dashboard, your rules.
            </p>
          </div>

          <div className="mx-auto mt-12 grid max-w-3xl gap-4 sm:grid-cols-2">
            <Link
              href="/app"
              className="glass-card rounded-2xl p-7 text-left transition-transform hover:-translate-y-0.5"
            >
              <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-blue-500/15 ring-1 ring-blue-500/20">
                <ArrowRight className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="mb-1 text-lg font-semibold">Use hosted version</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Sign in and start using immediately. Free. We handle the
                infrastructure.
              </p>
            </Link>
            <a
              href={GITHUB_REPO}
              target="_blank"
              rel="noopener noreferrer"
              className="glass-card rounded-2xl p-7 text-left transition-transform hover:-translate-y-0.5"
            >
              <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-foreground/[0.06] ring-1 ring-foreground/10">
                <GitHubMark className="h-5 w-5" />
              </div>
              <h3 className="mb-1 text-lg font-semibold">Self-host</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Clone the repo, run one command, own your data entirely. MIT
                licensed.
              </p>
            </a>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className={SECTION}>
        <div className={CONTAINER}>
          <div className="glass-card relative mx-auto max-w-3xl overflow-hidden rounded-3xl px-6 py-12 text-center sm:px-12 sm:py-16">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.16),transparent_60%)]" />
            <div className="relative">
              <img
                src="/thirdscreen_logo.svg"
                alt=""
                className="mx-auto mb-6 h-12 w-12"
              />
              <h2 className={H2}>Ready to try it?</h2>
              <p className="mx-auto mt-4 max-w-md text-lg text-muted-foreground">
                Free. Open source. No account required to start.
              </p>
              <Link href="/app" className={`mt-9 ${BTN_PRIMARY}`}>
                Open Dashboard
                <ArrowRight />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative px-4 pb-6">
        <div className="glass-card mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 rounded-3xl px-6 py-4 sm:flex-row sm:rounded-full sm:py-3">
          <div className="flex items-center gap-2">
            <img
              src="/thirdscreen_logo.svg"
              alt=""
              className="h-4 w-4 opacity-60"
            />
            <span className="text-sm text-muted-foreground">
              Third Screen by{" "}
              <a
                href="https://ericvaish.com"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-foreground"
              >
                Eric Vaish
              </a>
            </span>
          </div>
          <div className="flex items-center gap-5">
            <Link
              href="/privacy"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Terms
            </Link>
            <a
              href={GITHUB_REPO}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
