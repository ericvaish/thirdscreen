import Link from "next/link"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Terms of Service - Third Screen",
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white text-neutral-900 px-6 py-20 dark:bg-[#0a0a0a] dark:text-white" style={{ fontSize: "16px" }}>
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-neutral-600 transition-colors mb-8 dark:text-white/40 dark:hover:text-white/60">
          &larr; Back to home
        </Link>

        <h1 className="text-3xl font-bold tracking-tight mb-2">Terms of Service</h1>
        <p className="text-neutral-400 text-sm mb-10 dark:text-white/40">Last updated: April 2, 2026</p>

        <div className="space-y-8 text-neutral-600 text-sm leading-relaxed dark:text-white/70">
          <section>
            <h2 className="text-neutral-900 font-semibold text-lg mb-3 dark:text-white">1. Acceptance of Terms</h2>
            <p>By accessing or using Third Screen (&ldquo;the Service&rdquo;), operated by Eric Vaish (&ldquo;we&rdquo;, &ldquo;us&rdquo;), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.</p>
          </section>

          <section>
            <h2 className="text-neutral-900 font-semibold text-lg mb-3 dark:text-white">2. Description of Service</h2>
            <p>Third Screen is a personal dashboard web application that displays your schedule, tasks, notes, health data, and music in a single view. The Service is available as a hosted web application at thirdscr.com and as open-source software you may self-host.</p>
          </section>

          <section>
            <h2 className="text-neutral-900 font-semibold text-lg mb-3 dark:text-white">3. Accounts</h2>
            <p>You may use basic features without an account. Certain features (cloud sync, integrations) require signing in via our authentication provider (Clerk). You are responsible for maintaining the security of your account credentials and for all activity that occurs under your account.</p>
          </section>

          <section>
            <h2 className="text-neutral-900 font-semibold text-lg mb-3 dark:text-white">4. Subscriptions and Billing</h2>
            <p>Third Screen offers both free and paid subscription tiers. Paid subscriptions are billed through our payment processor, Paddle.com. By subscribing to a paid plan, you agree to pay the applicable fees.</p>
            <ul className="list-disc list-inside mt-3 space-y-2">
              <li>Subscriptions renew automatically at the end of each billing period unless cancelled before the renewal date.</li>
              <li>You may cancel your subscription at any time through your account settings. Cancellation takes effect at the end of the current billing period.</li>
              <li>Paddle acts as the Merchant of Record for all payments. Your billing relationship for payment processing is with Paddle, and their terms apply to payment transactions.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-neutral-900 font-semibold text-lg mb-3 dark:text-white">5. Refund Policy</h2>
            <p>If you are unsatisfied with a paid subscription, you may request a refund within 14 days of your initial purchase or most recent renewal. Refund requests can be made by contacting us at the email below. Refunds are processed through Paddle.</p>
          </section>

          <section>
            <h2 className="text-neutral-900 font-semibold text-lg mb-3 dark:text-white">6. Your Data</h2>
            <p>You own your data. Third Screen stores data locally on your device by default. When you connect external services (Google Calendar, Spotify, Gmail), you authorize Third Screen to access your data on those services according to the permissions you grant. You can disconnect any service and delete your data at any time.</p>
          </section>

          <section>
            <h2 className="text-neutral-900 font-semibold text-lg mb-3 dark:text-white">7. Acceptable Use</h2>
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
            <h2 className="text-neutral-900 font-semibold text-lg mb-3 dark:text-white">8. Third-Party Services</h2>
            <p>Third Screen integrates with third-party services including Google (Calendar, Gmail, Chat), Spotify, Clerk, LRCLib, and Paddle. Your use of those services is governed by their respective terms and privacy policies. We are not responsible for the availability, accuracy, or conduct of third-party services.</p>
          </section>

          <section>
            <h2 className="text-neutral-900 font-semibold text-lg mb-3 dark:text-white">9. Account Termination</h2>
            <p>You may delete your account at any time. We reserve the right to suspend or terminate accounts that violate these terms. Upon termination, your server-side data will be deleted. Locally stored data on your device is unaffected.</p>
          </section>

          <section>
            <h2 className="text-neutral-900 font-semibold text-lg mb-3 dark:text-white">10. No Warranty</h2>
            <p>The Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranty of any kind, express or implied. We do not guarantee that the Service will be uninterrupted, error-free, or that defects will be corrected.</p>
          </section>

          <section>
            <h2 className="text-neutral-900 font-semibold text-lg mb-3 dark:text-white">11. Limitation of Liability</h2>
            <p>To the fullest extent permitted by law, we shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Service, including loss of data, profits, or business opportunities.</p>
          </section>

          <section>
            <h2 className="text-neutral-900 font-semibold text-lg mb-3 dark:text-white">12. Governing Law</h2>
            <p>These terms are governed by and construed in accordance with the laws of the United States. Any disputes shall be resolved in the courts of competent jurisdiction.</p>
          </section>

          <section>
            <h2 className="text-neutral-900 font-semibold text-lg mb-3 dark:text-white">13. Changes to Terms</h2>
            <p>We may update these terms from time to time. Material changes will be communicated via the Service or email. Continued use after changes constitutes acceptance of the updated terms.</p>
          </section>

          <section>
            <h2 className="text-neutral-900 font-semibold text-lg mb-3 dark:text-white">14. Contact</h2>
            <p>Questions about these terms can be directed to <a href="mailto:eric@thirdscr.com" className="text-[#3b82f6] hover:underline">eric@thirdscr.com</a>.</p>
          </section>
        </div>
      </div>
    </div>
  )
}
