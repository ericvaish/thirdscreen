import Link from "next/link"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Third Screen - Your day, at a glance",
  description:
    "A glanceable personal dashboard. Schedule, tasks, notes, health, music, lyrics. One screen, zero scrolling. Open source.",
}

const GITHUB_RELEASE =
  "https://github.com/ericvaish/thirdscreen/releases/latest/download/ThirdScreen-0.1.0.dmg"
const GITHUB_REPO = "https://github.com/ericvaish/thirdscreen"

const FEATURES = [
  { icon: "📅", title: "Schedule", desc: "Full-day timeline with sun arc, Google Calendar sync, medicine reminders" },
  { icon: "✅", title: "Tasks", desc: "Quick-add tasks with scheduling, inline checkboxes, completion tracking" },
  { icon: "📝", title: "Notes", desc: "Quick notes with pin support, link bookmarks, inline editing" },
  { icon: "🔥", title: "Calories", desc: "Food logging with progress bar, daily goals, quick-add" },
  { icon: "💧", title: "Water", desc: "Glass tracking with visual progress toward daily goal" },
  { icon: "💊", title: "Medicines", desc: "Dose scheduling, checkbox tracking, timeline markers" },
  { icon: "🎵", title: "Spotify", desc: "Now playing with album art, controls, synced lyrics, adaptive colors" },
  { icon: "🌙", title: "Dark + Light", desc: "Beautiful in both. One-click toggle. System-aware." },
]

const INTEGRATIONS = [
  { name: "Spotify", color: "#1DB954" },
  { name: "Google Calendar", color: "#4285F4" },
  { name: "Apple Calendar", color: "#999" },
  { name: "LRCLib Lyrics", color: "#FF6B9D" },
  { name: "More coming", color: "#666" },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white" style={{ fontSize: "16px" }}>
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 backdrop-blur-xl bg-[#0a0a0a]/80 border-b border-white/[0.04]">
        <div className="flex items-center justify-between max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <img src="/thirdscreen_logo.svg" alt="Third Screen" className="w-7 h-7" />
            <span className="font-semibold text-lg tracking-tight">Third Screen</span>
          </div>
          <div className="flex items-center gap-5">
            <a href={GITHUB_REPO} target="_blank" rel="noopener noreferrer" className="text-sm text-white/40 hover:text-white/70 transition-colors hidden sm:block">
              GitHub
            </a>
            <Link href="/app" className="text-sm font-medium text-white/80 hover:text-white transition-colors">
              Open Dashboard
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center min-h-screen px-6 pt-20 overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/3 w-[900px] h-[500px] rounded-full bg-[#3b82f6]/8 blur-[120px] pointer-events-none" />

        <div className="relative z-10 text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-3 mb-5">
            <span className="text-[#3b82f6] text-sm font-medium tracking-widest uppercase">Personal Dashboard</span>
            <span className="text-white/15">|</span>
            <a href={GITHUB_REPO} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-white/35 hover:text-white/60 text-sm font-medium tracking-wide uppercase transition-colors">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
              Open Source
            </a>
          </div>

          <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-[1.08]">
            Your day, at a glance.
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-white/45 max-w-xl mx-auto leading-relaxed">
            One screen. Zero scrolling. Schedule, tasks, health, music, lyrics. All in a single glanceable dashboard.
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/app"
              className="inline-flex items-center gap-2.5 bg-white text-black font-semibold px-8 py-3.5 rounded-full hover:bg-white/90 transition-all hover:-translate-y-0.5 text-base"
            >
              Open Dashboard
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            </Link>
            <a
              href={GITHUB_RELEASE}
              className="inline-flex items-center gap-2.5 text-white/50 hover:text-white/70 border border-white/10 hover:border-white/20 px-8 py-3.5 rounded-full transition-all hover:-translate-y-0.5 text-base"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
              Download for Mac
            </a>
          </div>

          {/* Platform badges */}
          <div className="mt-6 flex items-center justify-center gap-4 text-xs text-white/25">
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-green-500" />
              Browser
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-green-500" />
              macOS Native
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-amber-500" />
              Electron (soon)
            </span>
          </div>
        </div>

        {/* Screenshot */}
        <div className="relative z-10 mt-16 mb-8 w-full max-w-5xl mx-auto">
          <div className="relative rounded-xl overflow-hidden shadow-2xl shadow-black/50 ring-1 ring-white/10">
            <img src="/third_screen_demo.png" alt="Third Screen dashboard" className="w-full h-auto" />
          </div>
          <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 w-3/4 h-24 bg-[#3b82f6]/6 blur-[60px] rounded-full pointer-events-none" />
        </div>
      </section>

      {/* Features */}
      <section className="relative bg-[#0a0a0a] py-28 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[#3b82f6] text-sm font-medium tracking-widest uppercase mb-3">What you see</p>
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight">Everything in one view.</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="bg-[#111] rounded-2xl p-6 ring-1 ring-white/[0.06] hover:ring-white/[0.12] transition-all hover:-translate-y-0.5"
              >
                <div className="text-2xl mb-3">{f.icon}</div>
                <h3 className="text-white font-semibold mb-1.5">{f.title}</h3>
                <p className="text-white/35 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Integrations */}
      <section className="relative bg-[#0a0a0a] py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-[#3b82f6] text-sm font-medium tracking-widest uppercase mb-3">Integrations</p>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-5">Connects to what you use.</h2>
          <p className="text-white/35 text-lg mb-12 max-w-md mx-auto">Sign in, connect your accounts, and your data flows in automatically.</p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            {INTEGRATIONS.map((i) => (
              <div
                key={i.name}
                className="flex items-center gap-2 bg-[#151515] rounded-full px-5 py-2.5 ring-1 ring-white/[0.06]"
              >
                <span className="size-2 rounded-full" style={{ backgroundColor: i.color }} />
                <span className="text-white/60 text-sm font-medium">{i.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative bg-[#0a0a0a] py-28 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 mx-auto w-[500px] h-[300px] bg-[#3b82f6]/5 blur-[100px] rounded-full pointer-events-none" />

          <div className="relative z-10">
            <img src="/thirdscreen_logo.svg" alt="Third Screen" className="w-14 h-14 mx-auto mb-8" />
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">Ready to try Third Screen?</h2>
            <p className="text-white/35 text-lg mb-10 max-w-md mx-auto">Free. Open source. No account required to start.</p>

            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/app"
                className="inline-flex items-center gap-2.5 bg-white text-black font-semibold px-8 py-3.5 rounded-full hover:bg-white/90 transition-all hover:-translate-y-0.5 text-base"
              >
                Open Dashboard
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
              </Link>
              <a
                href={GITHUB_RELEASE}
                className="inline-flex items-center gap-2.5 text-white/50 hover:text-white/70 border border-white/10 hover:border-white/20 px-8 py-3.5 rounded-full transition-all text-base"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
                Download for Mac
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Developer */}
      <section className="relative bg-[#0a0a0a] py-20 px-6 border-t border-white/[0.04]">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-[#3b82f6] text-sm font-medium tracking-widest uppercase mb-3">Developer</p>
          <h2 className="text-3xl font-bold tracking-tight mb-3">Eric Vaish</h2>
          <p className="text-white/35 text-base mb-6">Designing and building software that stays out of the way.</p>
          <div className="flex items-center justify-center gap-4">
            <a href="https://ericvaish.com" target="_blank" rel="noopener noreferrer" className="text-white/30 hover:text-white/60 text-sm transition-colors">ericvaish.com</a>
            <a href={GITHUB_REPO} target="_blank" rel="noopener noreferrer" className="text-white/30 hover:text-white/60 text-sm transition-colors">GitHub</a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0a0a0a] border-t border-white/[0.04] py-6 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/thirdscreen_logo.svg" alt="Third Screen" className="w-4 h-4 opacity-30" />
            <span className="text-white/25 text-sm">Third Screen</span>
          </div>
          <div className="flex items-center gap-5">
            <Link href="/privacy" className="text-white/25 hover:text-white/50 text-sm transition-colors">Privacy</Link>
            <Link href="/terms" className="text-white/25 hover:text-white/50 text-sm transition-colors">Terms</Link>
            <a href={GITHUB_REPO} target="_blank" rel="noopener noreferrer" className="text-white/25 hover:text-white/50 text-sm transition-colors">GitHub</a>
            <span className="text-white/15 text-sm">&copy; 2026 Eric Vaish</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
