import Link from "next/link"
import type { Metadata } from "next"
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler"

export const metadata: Metadata = {
  title: "Terms of Service - Third Screen",
}

const GITHUB_REPO = "https://github.com/ericvaish/thirdscreen"

export default function TermsPage() {
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
        <h1 className="text-3xl font-bold tracking-tight mb-2 font-[family-name:var(--font-display)]">Terms of Service</h1>
        <p className="text-neutral-400 text-sm mb-10 dark:text-white/40">Last updated: April 2, 2026</p>

        <div className="space-y-8 text-neutral-600 text-sm leading-relaxed dark:text-white/70">
          <section>
            <h2 className="text-neutral-900 font-semibold text-lg mb-3 dark:text-white">1. Acceptance of Terms</h2>
            <p>By accessing or using Third Screen (&ldquo;the Service&rdquo;), operated by Eric Vaish (&ldquo;we&rdquo;, &ldquo;us&rdquo;), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.</p>
          </section>

          <section>
            <h2 className="text-neutral-900 font-semibold text-lg mb-3 dark:text-white">2. Description of Service</h2>
            <p>Third Screen is a free, open-source personal dashboard web application that displays your schedule, tasks, notes, health data, and music in a single view. The Service is available as a hosted web application at thirdscr.com and as open-source software you may self-host.</p>
          </section>

          <section>
            <h2 className="text-neutral-900 font-semibold text-lg mb-3 dark:text-white">3. Accounts</h2>
            <p>You may use all features without an account. Signing in via our authentication provider (Clerk) enables cloud sync across devices. You are responsible for maintaining the security of your account credentials and for all activity that occurs under your account.</p>
          </section>

          <section>
            <h2 className="text-neutral-900 font-semibold text-lg mb-3 dark:text-white">4. Your Data</h2>
            <p>You own your data. Third Screen stores data locally on your device by default. When you connect external services (Google Calendar, Spotify, Gmail), you authorize Third Screen to access your data on those services according to the permissions you grant. You can disconnect any service and delete your data at any time.</p>
          </section>

          <section>
            <h2 className="text-neutral-900 font-semibold text-lg mb-3 dark:text-white">5. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc list-inside mt-3 space-y-2">
              <li>Use the Service for any unlawful purpose</li>
              <li>Attempt to gain unauthorized access to the Service or its systems</li>
              <li>Interfere with or disrupt the integrity of the Service</li>
              <li>Use the Service to transmit harmful code or malware</li>
              <li>Abuse API rate limits or scrape content from the Service</li>
            </ul>
          </section>

          <section>
            <h2 className="text-neutral-900 font-semibold text-lg mb-3 dark:text-white">6. Third-Party Services</h2>
            <p>Third Screen integrates with third-party services including Google (Calendar, Gmail, Chat), Spotify, Clerk, and LRCLib. Your use of those services is governed by their respective terms and privacy policies. We are not responsible for the availability, accuracy, or conduct of third-party services.</p>
          </section>

          <section>
            <h2 className="text-neutral-900 font-semibold text-lg mb-3 dark:text-white">7. Account Termination</h2>
            <p>You may delete your account at any time. We reserve the right to suspend or terminate accounts that violate these terms. Upon termination, your server-side data will be deleted. Locally stored data on your device is unaffected.</p>
          </section>

          <section>
            <h2 className="text-neutral-900 font-semibold text-lg mb-3 dark:text-white">8. No Warranty</h2>
            <p>The Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranty of any kind, express or implied. We do not guarantee that the Service will be uninterrupted, error-free, or that defects will be corrected.</p>
          </section>

          <section>
            <h2 className="text-neutral-900 font-semibold text-lg mb-3 dark:text-white">9. Limitation of Liability</h2>
            <p>To the fullest extent permitted by law, we shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Service, including loss of data, profits, or business opportunities.</p>
          </section>

          <section>
            <h2 className="text-neutral-900 font-semibold text-lg mb-3 dark:text-white">10. Governing Law</h2>
            <p>These terms are governed by and construed in accordance with the laws of India. Any disputes shall be resolved in the courts of competent jurisdiction in India.</p>
          </section>

          <section>
            <h2 className="text-neutral-900 font-semibold text-lg mb-3 dark:text-white">11. Changes to Terms</h2>
            <p>We may update these terms from time to time. Material changes will be communicated via the Service or email. Continued use after changes constitutes acceptance of the updated terms.</p>
          </section>

          <section>
            <h2 className="text-neutral-900 font-semibold text-lg mb-3 dark:text-white">12. Contact</h2>
            <p>Questions about these terms can be directed to <a href="mailto:hi@ericvaish.com" className="text-[#3b82f6] hover:underline">hi@ericvaish.com</a>.</p>
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
            <Link href="/privacy" className="text-sm text-neutral-400 transition-colors hover:text-neutral-600 dark:text-white/25 dark:hover:text-white/50">Privacy</Link>
            <a href={GITHUB_REPO} target="_blank" rel="noopener noreferrer" className="text-sm text-neutral-400 transition-colors hover:text-neutral-600 dark:text-white/25 dark:hover:text-white/50">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
