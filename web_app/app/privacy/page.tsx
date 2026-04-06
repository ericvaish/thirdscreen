import Link from "next/link"
import type { Metadata } from "next"
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler"

export const metadata: Metadata = {
  title: "Privacy Policy - Third Screen",
}

const GITHUB_REPO = "https://github.com/ericvaish/thirdscreen"

export default function PrivacyPage() {
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
            <AnimatedThemeToggler />
            <Link href="/app" className="text-sm font-medium text-neutral-700 transition-colors hover:text-neutral-900 dark:text-white/80 dark:hover:text-white">
              Open App
            </Link>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="mx-auto max-w-2xl px-6 pt-28 pb-16">
        <h1 className="text-3xl font-bold tracking-tight mb-2 font-[family-name:var(--font-display)]">Privacy Policy</h1>
        <p className="text-neutral-400 text-sm mb-10 dark:text-white/40">Last updated: April 2, 2026</p>

        <div className="space-y-8 text-neutral-600 text-sm leading-relaxed dark:text-white/70">
          <section>
            <h2 className="text-neutral-900 font-semibold text-lg mb-3 dark:text-white">1. What Third Screen Is</h2>
            <p>Third Screen is a personal dashboard web application that displays your schedule, tasks, notes, health data, and music in a single glanceable view. It is operated by Eric Vaish and available at thirdscr.com.</p>
          </section>

          <section>
            <h2 className="text-neutral-900 font-semibold text-lg mb-3 dark:text-white">2. Data Storage</h2>
            <p>Third Screen is local-first. Your data (tasks, notes, calendar events, calorie logs, medicine schedules, habits) is stored locally on your device by default using your browser's localStorage. No account is required to use the core features.</p>
            <p className="mt-3">When you sign in and use the hosted version, your data is stored on our servers in a SQLite database, isolated by your authenticated user ID. No other user can access your data.</p>
            <p className="mt-3">When you connect external services, authentication tokens are stored securely and scoped to your user account. We do not store your passwords.</p>
          </section>

          <section>
            <h2 className="text-neutral-900 font-semibold text-lg mb-3 dark:text-white">3. Third-Party Services</h2>
            <p>Third Screen integrates with the following services when you choose to connect them:</p>
            <ul className="list-disc list-inside mt-3 space-y-2">
              <li><strong className="text-neutral-900 dark:text-white">Google Calendar</strong> - We request access to your calendar events to display them on your timeline. We use Google OAuth 2.0 with PKCE. Supports multiple accounts.</li>
              <li><strong className="text-neutral-900 dark:text-white">Gmail</strong> - We request access to read your unread count and message previews. Only metadata is displayed; we do not store email content.</li>
              <li><strong className="text-neutral-900 dark:text-white">Google Chat</strong> - We request access to display recent messages from your spaces.</li>
              <li><strong className="text-neutral-900 dark:text-white">Spotify</strong> - We request access to your playback state to display currently playing music and control playback. We use Spotify OAuth with PKCE.</li>
              <li><strong className="text-neutral-900 dark:text-white">LRCLib</strong> - We fetch song lyrics from LRCLib (lrclib.net), an open-source lyrics database. Only the song title, artist, and album name are sent in the request.</li>
              <li><strong className="text-neutral-900 dark:text-white">Clerk</strong> - We use Clerk for user authentication. Clerk handles your account data (email, profile) according to their <a href="https://clerk.com/legal/privacy" target="_blank" rel="noopener noreferrer" className="text-[#3b82f6] hover:underline">privacy policy</a>.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-neutral-900 font-semibold text-lg mb-3 dark:text-white">4. Cookies and Local Storage</h2>
            <p>Third Screen uses browser localStorage to store your dashboard data, UI preferences (theme, layout), and authentication tokens for connected services. We do not use tracking cookies. Clerk may set cookies for session management.</p>
          </section>

          <section>
            <h2 className="text-neutral-900 font-semibold text-lg mb-3 dark:text-white">5. Data We Do Not Collect</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>We do not sell or share your data with third parties for advertising or marketing purposes</li>
              <li>We do not serve advertisements</li>
              <li>We do not use analytics or behavioral tracking</li>
              <li>We do not collect data from minors under 13</li>
            </ul>
          </section>

          <section>
            <h2 className="text-neutral-900 font-semibold text-lg mb-3 dark:text-white">6. Data Retention</h2>
            <p>Locally stored data persists until you clear your browser storage. Server-side data for signed-in users is retained as long as your account is active. If you delete your account, all associated server-side data is permanently deleted. OAuth tokens for disconnected services are deleted immediately upon disconnection.</p>
          </section>

          <section>
            <h2 className="text-neutral-900 font-semibold text-lg mb-3 dark:text-white">7. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc list-inside mt-3 space-y-2">
              <li><strong className="text-neutral-900 dark:text-white">Access</strong> your data at any time through the application</li>
              <li><strong className="text-neutral-900 dark:text-white">Export</strong> your data from the application</li>
              <li><strong className="text-neutral-900 dark:text-white">Delete</strong> your data and account at any time</li>
              <li><strong className="text-neutral-900 dark:text-white">Disconnect</strong> any third-party service integration at any time</li>
              <li><strong className="text-neutral-900 dark:text-white">Withdraw consent</strong> for data processing by deleting your account</li>
            </ul>
            <p className="mt-3">If you are in the EU/EEA, you may also exercise rights under the GDPR including the right to rectification, restriction of processing, and lodging a complaint with a supervisory authority.</p>
          </section>

          <section>
            <h2 className="text-neutral-900 font-semibold text-lg mb-3 dark:text-white">8. Data Security</h2>
            <p>We use HTTPS for all data transmission. OAuth tokens are stored server-side with user-scoped access controls. Authentication is handled by Clerk with industry-standard security practices. However, no method of transmission or storage is 100% secure, and we cannot guarantee absolute security.</p>
          </section>

          <section>
            <h2 className="text-neutral-900 font-semibold text-lg mb-3 dark:text-white">9. Infrastructure</h2>
            <p>Third Screen is hosted on <a href="https://vercel.com/" target="_blank" rel="noopener noreferrer" className="text-[#3b82f6] hover:underline">Vercel</a> with a <a href="https://turso.tech/" target="_blank" rel="noopener noreferrer" className="text-[#3b82f6] hover:underline">Turso</a> SQLite database for signed-in users. Here is a complete breakdown of what we use:</p>
            <div className="mt-3 overflow-hidden rounded-lg border border-neutral-200 dark:border-white/[0.06]">
              <table className="w-full text-xs">
                <tbody>
                  {[
                    ["Hosting", "Vercel", "Next.js serverless functions"],
                    ["Database", "Turso (SQLite)", "Only used when signed in"],
                    ["Authentication", "Clerk", "Handles login, email, sessions"],
                    ["AI Models", "On-device (WebGPU)", "Runs in your browser, no cloud API"],
                    ["Analytics", "None", "Zero tracking, zero telemetry"],
                    ["Cookies", "Auth session only", "No advertising or tracking cookies"],
                  ].map(([service, provider, note]) => (
                    <tr key={service} className="border-b border-neutral-100 last:border-0 dark:border-white/[0.04]">
                      <td className="whitespace-nowrap px-3 py-2 font-medium text-neutral-900 dark:text-white/70">{service}</td>
                      <td className="px-3 py-2 font-[family-name:var(--font-mono)] text-neutral-500 dark:text-white/40">{provider}</td>
                      <td className="px-3 py-2 text-neutral-400 dark:text-white/25">{note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-neutral-900 font-semibold text-lg mb-3 dark:text-white">10. Open Source</h2>
            <p>Third Screen is open source under the MIT license. You can inspect the complete source code at <a href={GITHUB_REPO} target="_blank" rel="noopener noreferrer" className="text-[#3b82f6] hover:underline">github.com/ericvaish/thirdscreen</a> to verify exactly what the application does with your data. Every line of code that touches your data is open for inspection. If you find a vulnerability, please report it to <a href="mailto:hi@ericvaish.com" className="text-[#3b82f6] hover:underline">hi@ericvaish.com</a>.</p>
          </section>

          <section>
            <h2 className="text-neutral-900 font-semibold text-lg mb-3 dark:text-white">11. Self-Hosting</h2>
            <p>If you want zero dependency on our infrastructure, you can self-host Third Screen on your own server. Clone the repository, run it locally or deploy to your own Cloudflare account, and your data never touches our systems at all.</p>
          </section>

          <section>
            <h2 className="text-neutral-900 font-semibold text-lg mb-3 dark:text-white">12. Changes to This Policy</h2>
            <p>We may update this privacy policy from time to time. Material changes will be communicated via the Service or email. The &ldquo;Last updated&rdquo; date at the top reflects the most recent revision.</p>
          </section>

          <section>
            <h2 className="text-neutral-900 font-semibold text-lg mb-3 dark:text-white">13. Contact</h2>
            <p>If you have questions about this privacy policy, you can reach us at <a href="mailto:hi@ericvaish.com" className="text-[#3b82f6] hover:underline">hi@ericvaish.com</a>.</p>
          </section>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-neutral-200 py-6 px-6 dark:border-white/[0.04]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <img src="/thirdscreen_logo.svg" alt="" className="h-4 w-4 opacity-30" />
            <span className="text-sm text-neutral-400 dark:text-white/25">Third Screen by <a href="https://ericvaish.com" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-neutral-600 dark:hover:text-white/50">Eric Vaish</a></span>
          </div>
          <div className="flex items-center gap-5">
            <Link href="/pricing" className="text-sm text-neutral-400 transition-colors hover:text-neutral-600 dark:text-white/25 dark:hover:text-white/50">Pricing</Link>
            <Link href="/terms" className="text-sm text-neutral-400 transition-colors hover:text-neutral-600 dark:text-white/25 dark:hover:text-white/50">Terms</Link>
            <a href={GITHUB_REPO} target="_blank" rel="noopener noreferrer" className="text-sm text-neutral-400 transition-colors hover:text-neutral-600 dark:text-white/25 dark:hover:text-white/50">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
