import type { Metadata } from "next"
import Link from "next/link"

import { SiteHeader } from "@/components/site-header"

export const metadata: Metadata = {
  title: "Privacy policy | Prabhat Samgiita AI",
  description: "How Prabhat Samgiita AI collects, uses, and protects your information.",
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-ivory-50">
      <SiteHeader />
      <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <p className="eyebrow">Legal</p>
        <h1 className="mt-3 font-serif text-4xl text-navy-950">Privacy policy</h1>
        <p className="mt-4 text-sm text-stone-500">Last updated: 15 August 2026</p>
        <p className="mt-4 text-base leading-7 text-stone-600">
          Prabhat Samgiita AI (&ldquo;we&rdquo;, &ldquo;the app&rdquo;) helps devotees explore songs, meanings,
          and learning tools. This policy explains what information we collect and how you can control it.
        </p>

        <section className="mt-10 space-y-8 text-sm leading-6 text-stone-600">
          <div>
            <h2 className="font-serif text-2xl text-navy-950">Information we collect</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5">
              <li>
                <strong>Account details</strong> — email address, display name, and sign-in method (email/password,
                Google, or Microsoft) when you create a member account.
              </li>
              <li>
                <strong>App activity</strong> — saved songs, quiz progress, preferences, and AI chat history linked
                to your account.
              </li>
              <li>
                <strong>Feedback</strong> — messages you send through the in-app or website feedback form, optionally
                with your contact email.
              </li>
              <li>
                <strong>Usage analytics</strong> — anonymous page views and feature usage to improve the product.
              </li>
            </ul>
            <p className="mt-4">
              <strong>We do not collect</strong> precise location, contacts, photos, or payment information. Harmonium
              practice recordings are analysed on your device and are not uploaded to our servers.
            </p>
          </div>

          <div>
            <h2 className="font-serif text-2xl text-navy-950">How we use information</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5">
              <li>Provide sign-in, saved songs, quiz certificates, and personalised AI context</li>
              <li>Answer your questions using retrieved song content (not invented lyrics or meanings)</li>
              <li>Respond to feedback and improve reliability and performance</li>
              <li>Protect the service from abuse and spam</li>
            </ul>
          </div>

          <div>
            <h2 className="font-serif text-2xl text-navy-950">Sharing</h2>
            <p className="mt-4">
              We do not sell your personal information. We use trusted infrastructure and authentication providers
              (for example Google and Microsoft sign-in, and cloud hosting) only to operate the service. AI features
              may send your questions and relevant song excerpts to configured language-model providers to generate
              answers.
            </p>
          </div>

          <div>
            <h2 className="font-serif text-2xl text-navy-950">Retention</h2>
            <p className="mt-4">
              Raw AI chat turns are retained for up to 30 days, then expire automatically. A compact interest summary
              may remain until you clear chat memory or delete your account. Account data is removed when you delete
              your account.
            </p>
          </div>

          <div>
            <h2 className="font-serif text-2xl text-navy-950">Security</h2>
            <p className="mt-4">
              Data is transmitted over encrypted connections (HTTPS/TLS). Passwords are stored using industry-standard
              hashing. Access to member data is limited to what is needed to run the service.
            </p>
          </div>

          <div>
            <h2 className="font-serif text-2xl text-navy-950">Your choices</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5">
              <li>Use the app as a guest without creating an account (limited features)</li>
              <li>Clear AI chat memory from your account page or mobile Profile tab</li>
              <li>
                Delete your account — see our{" "}
                <Link href="/delete-account" className="font-semibold text-navy-950 underline decoration-gold-500 underline-offset-4">
                  account deletion page
                </Link>
              </li>
              <li>
                Email us at{" "}
                <a href="mailto:anandamarga01@gmail.com" className="font-semibold text-navy-950 underline decoration-gold-500 underline-offset-4">
                  anandamarga01@gmail.com
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="font-serif text-2xl text-navy-950">Contact</h2>
            <p className="mt-4">
              For privacy questions, account help, or deletion requests, email{" "}
              <a href="mailto:anandamarga01@gmail.com" className="font-semibold text-navy-950 underline decoration-gold-500 underline-offset-4">
                anandamarga01@gmail.com
              </a>
              .
            </p>
          </div>

          <div>
            <h2 className="font-serif text-2xl text-navy-950">Children</h2>
            <p className="mt-4">
              The app is not directed at children under 13. We do not knowingly collect personal information from
              children under 13.
            </p>
          </div>

          <div>
            <h2 className="font-serif text-2xl text-navy-950">Changes</h2>
            <p className="mt-4">
              We may update this policy as the product evolves. The &ldquo;Last updated&rdquo; date at the top will
              change when we do.
            </p>
          </div>
        </section>

        <p className="mt-8 text-sm text-stone-600">
          <Link href="/" className="font-semibold text-navy-950 underline decoration-gold-500 underline-offset-4">
            ← Back to home
          </Link>
        </p>
      </article>
    </main>
  )
}
