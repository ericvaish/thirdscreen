import Link from "next/link"
import type { Metadata } from "next"
import { LandingThemeToggle } from "@/components/landing-theme-toggle"

export const metadata: Metadata = {
  title: "Pricing - Third Screen",
  description: "Simple pricing for Third Screen. Free forever with optional Pro upgrade.",
}

const GITHUB_REPO = "https://github.com/ericvaish/thirdscreen"

const FREE_FEATURES = [
  "Full dashboard with all zones",
  "Tasks, notes, habits, vitals",
  "Clock, weather, status bar",
  "Pixel Buddy mascot",
  "Dark and light themes",
  "Local storage (no account needed)",
  "Open source, self-hostable",
]

const PRO_FEATURES = [
  "Everything in Free, plus:",
  "Google Calendar sync (multi-account)",
  "Gmail notifications",
  "Google Chat messages",
  "Spotify playback + synced lyrics",
  "Cloud sync across devices",
  "Priority support",
]

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-white text-neutral-900 dark:bg-[#09090b] dark:text-white" style={{ fontSize: "16px" }}>
      {/* Nav */}
      <nav className="fixed inset-x-0 top-0 z-50 border-b border-neutral-200 bg-white/80 backdrop-blur-xl dark:border-white/[0.04] dark:bg-[#09090b]/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-3">
              <img src="/thirdscreen_logo.svg" alt="Third Screen" className="h-7 w-7" />
              <span className="text-lg font-semibold tracking-tight font-[family-name:var(--font-display)]">Third Screen</span>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <a href={GITHUB_REPO} target="_blank" rel="noopener noreferrer" className="hidden text-sm text-neutral-400 transition-colors hover:text-neutral-600 sm:block dark:text-white/40 dark:hover:text-white/70">
              GitHub
            </a>
            <LandingThemeToggle />
            <Link href="/app" className="text-sm font-medium text-neutral-700 transition-colors hover:text-neutral-900 dark:text-white/80 dark:hover:text-white">
              Open App
            </Link>
          </div>
        </div>
      </nav>

      {/* Header */}
      <section className="relative px-6 pt-32 pb-4 text-center">
        <div className="pointer-events-none absolute left-1/2 top-1/3 h-[400px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/[0.04] blur-[150px] dark:bg-[#3b82f6]/[0.06]" />
        <div className="relative z-10">
          <h1 className="font-[family-name:var(--font-display)] text-4xl font-bold tracking-tight sm:text-5xl">
            Simple, transparent pricing.
          </h1>
          <p className="mx-auto mt-4 max-w-md text-lg text-neutral-500 dark:text-white/40">
            Free forever for the core dashboard. Upgrade to Pro for integrations and cloud sync.
          </p>
        </div>
      </section>

      {/* Pricing cards */}
      <section className="relative px-6 py-16">
        <div className="mx-auto grid max-w-4xl gap-6 lg:grid-cols-2">
          {/* Free */}
          <div className="rounded-2xl bg-neutral-50 p-8 ring-1 ring-neutral-200 dark:bg-[#111] dark:ring-white/[0.06]">
            <div className="mb-6">
              <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">Free</h2>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="font-[family-name:var(--font-display)] text-4xl font-bold">$0</span>
                <span className="text-sm text-neutral-400 dark:text-white/30">/ forever</span>
              </div>
              <p className="mt-2 text-sm text-neutral-500 dark:text-white/35">
                The full dashboard experience. No account required.
              </p>
            </div>

            <Link
              href="/app"
              className="mb-8 flex w-full items-center justify-center rounded-full border border-neutral-200 px-6 py-3 text-sm font-semibold transition-all hover:-translate-y-0.5 hover:border-neutral-300 dark:border-white/10 dark:hover:border-white/20"
            >
              Get started
            </Link>

            <ul className="space-y-3">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                  <span className="text-neutral-600 dark:text-white/60">{f}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Pro */}
          <div className="relative rounded-2xl bg-neutral-50 p-8 ring-2 ring-[#3b82f6] dark:bg-[#111]">
            <div className="absolute -top-3 left-6 rounded-full bg-[#3b82f6] px-3 py-0.5 text-xs font-semibold text-white font-[family-name:var(--font-mono)]">
              PRO
            </div>

            <div className="mb-6">
              <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">Pro</h2>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="font-[family-name:var(--font-display)] text-4xl font-bold">$5</span>
                <span className="text-sm text-neutral-400 dark:text-white/30">/ month</span>
              </div>
              <p className="mt-2 text-sm text-neutral-500 dark:text-white/35">
                Connect your services. Sync across devices.
              </p>
            </div>

            <Link
              href="/app"
              className="mb-8 flex w-full items-center justify-center rounded-full bg-[#3b82f6] px-6 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-[#2563eb]"
            >
              Upgrade to Pro
            </Link>

            <ul className="space-y-3">
              {PRO_FEATURES.map((f, i) => (
                <li key={f} className="flex items-start gap-3 text-sm">
                  {i === 0 ? (
                    <span className="mt-0.5 h-4 w-4 shrink-0" />
                  ) : (
                    <svg className="mt-0.5 h-4 w-4 shrink-0 text-[#3b82f6]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                  )}
                  <span className={i === 0 ? "font-medium text-neutral-500 dark:text-white/40" : "text-neutral-600 dark:text-white/60"}>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-2xl">
          <h2 className="mb-10 text-center font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">
            Frequently asked questions
          </h2>

          <div className="space-y-6">
            {[
              {
                q: "Can I use Third Screen without paying?",
                a: "Yes. The free tier gives you the full dashboard with tasks, notes, habits, vitals, clock, and themes. Your data is stored locally in your browser. No account needed.",
              },
              {
                q: "What do I get with Pro?",
                a: "Pro unlocks integrations (Google Calendar, Gmail, Google Chat, Spotify with synced lyrics) and cloud sync so your dashboard works across devices.",
              },
              {
                q: "How does billing work?",
                a: "Billing is handled by Paddle, our payment processor. You can pay with credit card or PayPal. Subscriptions renew monthly and can be cancelled anytime.",
              },
              {
                q: "Can I cancel anytime?",
                a: "Yes. Cancel from your account settings. You keep Pro access until the end of your billing period. No questions asked.",
              },
              {
                q: "Is there a refund policy?",
                a: "Yes. Full refund within 14 days of purchase or renewal. Contact eric@thirdscr.com.",
              },
              {
                q: "Is Third Screen open source?",
                a: "Yes. The entire codebase is MIT licensed on GitHub. You can self-host it if you prefer to run your own infrastructure.",
              },
            ].map((item) => (
              <div key={item.q} className="border-b border-neutral-200 pb-6 dark:border-white/[0.06]">
                <h3 className="mb-2 font-semibold">{item.q}</h3>
                <p className="text-sm text-neutral-500 leading-relaxed dark:text-white/40">{item.a}</p>
              </div>
            ))}
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
