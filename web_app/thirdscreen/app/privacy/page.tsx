import Link from "next/link"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Privacy Policy - Third Screen",
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white px-6 py-20" style={{ fontSize: "16px" }}>
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-white/40 hover:text-white/60 transition-colors mb-8">
          &larr; Back to home
        </Link>

        <h1 className="text-3xl font-bold tracking-tight mb-2">Privacy Policy</h1>
        <p className="text-white/40 text-sm mb-10">Last updated: March 27, 2026</p>

        <div className="space-y-8 text-white/70 text-sm leading-relaxed">
          <section>
            <h2 className="text-white font-semibold text-lg mb-3">What Third Screen Is</h2>
            <p>Third Screen is a personal dashboard application that displays your schedule, tasks, notes, health data, and music in a single glanceable view. It is available as a web application, a native macOS app, and a desktop Electron app.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">Data Storage</h2>
            <p>Third Screen is local-first. Your data (tasks, notes, calendar events, calorie logs, medicine schedules) is stored locally on your device by default. No account is required to use the core features.</p>
            <p className="mt-3">When you choose to connect external services (Google Calendar, Spotify), authentication tokens are stored securely and scoped to your user account. We do not store your passwords.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">Third-Party Services</h2>
            <p>Third Screen integrates with the following services when you choose to connect them:</p>
            <ul className="list-disc list-inside mt-3 space-y-2">
              <li><strong className="text-white">Google Calendar</strong> - We request read-only access to your calendar events. We use Google OAuth 2.0 with PKCE for authentication.</li>
              <li><strong className="text-white">Spotify</strong> - We request access to your playback state to display currently playing music and control playback. We use Spotify OAuth with PKCE.</li>
              <li><strong className="text-white">LRCLib</strong> - We fetch song lyrics from LRCLib (lrclib.net), an open-source lyrics database. Only the song title, artist, and album name are sent.</li>
              <li><strong className="text-white">Clerk</strong> - We use Clerk for authentication when you sign in. Clerk handles your account data according to their privacy policy.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">Data We Do Not Collect</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>We do not sell or share your data with third parties</li>
              <li>We do not serve advertisements</li>
              <li>We do not use analytics or tracking beyond what Clerk provides for authentication</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">Multi-Tenancy and Data Isolation</h2>
            <p>When using the hosted version with an account, your data is isolated by your user ID. No other user can access your data. All database queries are scoped to your authenticated user ID.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">Open Source</h2>
            <p>Third Screen is open source. You can inspect the complete source code at <a href="https://github.com/ericvaish/thirdscreen" target="_blank" rel="noopener noreferrer" className="text-[#3b82f6] hover:underline">github.com/ericvaish/thirdscreen</a> to verify exactly what the application does with your data.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">Contact</h2>
            <p>If you have questions about this privacy policy, you can reach the developer at <a href="https://ericvaish.com" target="_blank" rel="noopener noreferrer" className="text-[#3b82f6] hover:underline">ericvaish.com</a>.</p>
          </section>
        </div>
      </div>
    </div>
  )
}
