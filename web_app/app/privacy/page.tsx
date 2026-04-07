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
        <p className="text-neutral-400 text-sm mb-10 dark:text-white/40">Last updated: April 7, 2026</p>

        <div className="space-y-8 text-neutral-600 text-sm leading-relaxed dark:text-white/70">
          <section>
            <h2 className="text-neutral-900 font-semibold text-lg mb-3 dark:text-white">1. Overview</h2>
            <p>Third Screen is a personal dashboard application operated by Eric Vaish. This policy describes how we handle your data when you use the hosted service at thirdscr.com. The application is also available as open-source software for self-hosting, in which case your data is entirely under your control.</p>
          </section>

          <section>
            <h2 className="text-neutral-900 font-semibold text-lg mb-3 dark:text-white">2. Data We Collect</h2>
            <p>Third Screen is local-first. Without an account, your data is stored in your browser and never leaves your device.</p>
            <p className="mt-3">When you create an account, we store your dashboard data (tasks, notes, settings, etc.) on our servers, isolated by your user ID.</p>
            <p className="mt-3">When you connect third-party services, we store OAuth tokens necessary to access those services on your behalf. We do not store your passwords. Tokens are deleted when you disconnect a service.</p>
          </section>

          <section>
            <h2 className="text-neutral-900 font-semibold text-lg mb-3 dark:text-white">3. Third-Party Services</h2>
            <p>The Service may integrate with third-party services (such as calendar, email, music, and productivity platforms). When you connect a service, you authorize us to access your data on that service according to the permissions you grant. Your use of those services is governed by their own terms and privacy policies.</p>
          </section>

          <section>
            <h2 className="text-neutral-900 font-semibold text-lg mb-3 dark:text-white">4. What We Do Not Do</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>We do not sell or share your data with third parties</li>
              <li>We do not serve advertisements</li>
              <li>We do not use analytics or behavioral tracking</li>
            </ul>
          </section>

          <section>
            <h2 className="text-neutral-900 font-semibold text-lg mb-3 dark:text-white">5. Cookies and Local Storage</h2>
            <p>We use browser localStorage to store dashboard data and UI preferences. Our authentication provider may set cookies for session management. We do not use tracking cookies.</p>
          </section>

          <section>
            <h2 className="text-neutral-900 font-semibold text-lg mb-3 dark:text-white">6. Data Security</h2>
            <p>We use HTTPS for all data transmission. Server-side data is isolated per user. However, no method of transmission or storage is completely secure, and we cannot guarantee absolute security.</p>
          </section>

          <section>
            <h2 className="text-neutral-900 font-semibold text-lg mb-3 dark:text-white">7. Data Retention</h2>
            <p>Locally stored data persists until you clear your browser storage. Server-side data is retained while your account is active. You may disconnect services or contact us to request deletion of your data.</p>
          </section>

          <section>
            <h2 className="text-neutral-900 font-semibold text-lg mb-3 dark:text-white">8. Open Source</h2>
            <p>Third Screen is open source. You can inspect the source code at <a href={GITHUB_REPO} target="_blank" rel="noopener noreferrer" className="text-[#3b82f6] hover:underline">github.com/ericvaish/thirdscreen</a> to verify how the application handles your data.</p>
          </section>

          <section>
            <h2 className="text-neutral-900 font-semibold text-lg mb-3 dark:text-white">9. Changes</h2>
            <p>We may update this policy at any time. The updated version will be posted on this page with a revised date. Continued use of the Service after changes constitutes acceptance.</p>
          </section>

          <section>
            <h2 className="text-neutral-900 font-semibold text-lg mb-3 dark:text-white">10. Contact</h2>
            <p>If you have questions about this privacy policy, contact us at <a href="mailto:hi@ericvaish.com" className="text-[#3b82f6] hover:underline">hi@ericvaish.com</a>.</p>
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
