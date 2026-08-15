import type { Metadata } from "next"
import Link from "next/link"

import { SiteHeader } from "@/components/site-header"

export const metadata: Metadata = {
  title: "Delete your account | Prabhat Samgiita AI",
  description:
    "How to delete your Prabhat Samgiita AI member account and associated data from the mobile app or website.",
}

export default function DeleteAccountPage() {
  return (
    <main className="min-h-screen bg-ivory-50">
      <SiteHeader />
      <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <p className="eyebrow">Account</p>
        <h1 className="mt-3 font-serif text-4xl text-navy-950">Delete your account</h1>
        <p className="mt-4 text-base leading-7 text-stone-600">
          You can delete your Prabhat Samgiita AI member account and the data linked to it at any time.
          Deletion is permanent and cannot be undone.
        </p>

        <section className="mt-10 rounded-3xl border border-navy-900/10 bg-white p-6 sm:p-8">
          <h2 className="font-serif text-2xl text-navy-950">What gets deleted</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-stone-600">
            <li>Your member profile and sign-in identity</li>
            <li>Saved songs and playlists</li>
            <li>Quiz progress and certificates</li>
            <li>AI chat memory and conversation history</li>
            <li>Personal preferences stored with your account</li>
          </ul>
          <p className="mt-4 text-sm leading-6 text-stone-600">
            Raw AI chat turns expire automatically after 30 days. Your compact interest summary is removed
            when you delete your account or clear chat memory.
          </p>
        </section>

        <section className="mt-6 rounded-3xl border border-navy-900/10 bg-white p-6 sm:p-8">
          <h2 className="font-serif text-2xl text-navy-950">Delete from the mobile app</h2>
          <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-6 text-stone-600">
            <li>Open the Prabhat Samgiita AI app and sign in to your member account.</li>
            <li>Go to the <strong>Profile</strong> tab.</li>
            <li>Tap <strong>Delete account data</strong>.</li>
            <li>Confirm the prompt to permanently delete your account.</li>
          </ol>
        </section>

        <section className="mt-6 rounded-3xl border border-navy-900/10 bg-white p-6 sm:p-8">
          <h2 className="font-serif text-2xl text-navy-950">Delete from the website</h2>
          <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-6 text-stone-600">
            <li>
              <Link href="/signin?next=/account" className="font-semibold text-navy-950 underline decoration-gold-500 underline-offset-4">
                Sign in
              </Link>{" "}
              to your member account.
            </li>
            <li>
              Open your{" "}
              <Link href="/account" className="font-semibold text-navy-950 underline decoration-gold-500 underline-offset-4">
                account page
              </Link>
              .
            </li>
            <li>
              In <strong>Privacy and memory</strong>, choose <strong>Delete account data</strong> and confirm.
            </li>
          </ol>
          <p className="mt-4 text-sm leading-6 text-stone-600">
            To remove only AI chat history without deleting your full account, use <strong>Clear chat memory</strong> on the same page or in the mobile app Profile tab.
          </p>
        </section>

        <section className="mt-6 rounded-3xl border border-navy-900/10 bg-white p-6 sm:p-8">
          <h2 className="font-serif text-2xl text-navy-950">Need help?</h2>
          <p className="mt-3 text-sm leading-6 text-stone-600">
            If you cannot sign in or delete your account using the steps above, use the Feedback button on this
            website or in the app. Include the email address linked to your account and ask for account deletion.
          </p>
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
