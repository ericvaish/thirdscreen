import Link from "next/link"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Terms of Service - Third Screen",
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white px-6 py-20" style={{ fontSize: "16px" }}>
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-white/40 hover:text-white/60 transition-colors mb-8">
          &larr; Back to home
        </Link>

        <h1 className="text-3xl font-bold tracking-tight mb-2">Terms of Service</h1>
        <p className="text-white/40 text-sm mb-10">Last updated: March 27, 2026</p>

        <div className="space-y-8 text-white/70 text-sm leading-relaxed">
          <section>
            <h2 className="text-white font-semibold text-lg mb-3">Acceptance</h2>
            <p>By using Third Screen, you agree to these terms. If you do not agree, do not use the application.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">The Service</h2>
            <p>Third Screen is a personal dashboard application provided as-is, free of charge. It displays information from your connected accounts (calendars, music services) and locally stored data (tasks, notes, health tracking).</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">Your Data</h2>
            <p>You own your data. Third Screen stores your data locally on your device by default. When you connect external services, you authorize Third Screen to access your data on those services according to the permissions you grant during the OAuth flow. You can disconnect any service at any time.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">Third-Party Services</h2>
            <p>Third Screen integrates with third-party services (Google, Spotify, Clerk, and others). Your use of those services is governed by their respective terms and privacy policies. Third Screen is not responsible for the availability, accuracy, or conduct of third-party services.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">No Warranty</h2>
            <p>Third Screen is provided &ldquo;as is&rdquo; without warranty of any kind, express or implied. The developer does not guarantee that the service will be uninterrupted, error-free, or that defects will be corrected.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">Limitation of Liability</h2>
            <p>To the fullest extent permitted by law, the developer shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of Third Screen.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">Changes</h2>
            <p>These terms may be updated from time to time. Continued use of Third Screen after changes constitutes acceptance of the updated terms.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">Contact</h2>
            <p>Questions about these terms can be directed to the developer at <a href="https://ericvaish.com" target="_blank" rel="noopener noreferrer" className="text-[#3b82f6] hover:underline">ericvaish.com</a>.</p>
          </section>
        </div>
      </div>
    </div>
  )
}
