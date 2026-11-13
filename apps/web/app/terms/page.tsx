import type { Metadata } from "next"
import Link from "next/link"

import { SiteHeader } from "@/components/site-header"
import { COPYRIGHT_EMAIL, MINIMUM_AGE, SUPPORT_EMAIL } from "@/lib/contact"

export const metadata: Metadata = {
  title: "Terms of use | Prabhat Samgiita AI",
  description:
    "The rules for using Prabhat Samgiita AI: who may use it, what you may upload, what we may do with it, and how to ask us to remove something.",
}

const link = "font-semibold text-navy-950 underline decoration-gold-500 underline-offset-4"

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-ivory-50">
      <SiteHeader />
      <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <p className="eyebrow">Legal</p>
        <h1 className="mt-3 font-serif text-4xl text-navy-950">Terms of use</h1>
        <p className="mt-4 text-sm text-stone-500">Last updated: 10 November 2026</p>
        <p className="mt-4 text-base leading-7 text-stone-600">
          Prabhat Samgiita AI (&ldquo;we&rdquo;, &ldquo;the app&rdquo;) is a free, non-profit app and website for
          devotional music: Prabhat Samgiita, Kiirtan and other songs and mantras. Members can also upload
          recordings. By using the app you agree to these terms. They are short on purpose.
        </p>

        <section className="mt-10 space-y-8 text-sm leading-6 text-stone-600">
          <div>
            <h2 className="font-serif text-2xl text-navy-950">Who may use the app</h2>
            <p className="mt-4">
              You can listen and read without an account. To make an account you must be at least{" "}
              <strong>{MINIMUM_AGE} years old</strong>. If you are younger, please do not make an account. If we learn
              that someone under {MINIMUM_AGE} has one, we may close it.
            </p>
          </div>

          <div>
            <h2 className="font-serif text-2xl text-navy-950">What you may upload</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5">
              <li>Only recordings you made yourself, or recordings you have permission to share.</li>
              <li>Tell the truth about who sings or plays. Do not upload someone else&rsquo;s recording as your own.</li>
              <li>
                No content that is hateful, abusive, harassing, sexual, violent, or that breaks the law. No spam, no
                advertising, no files that are not what they say they are.
              </li>
              <li>Comments follow the same rules. Be kind.</li>
            </ul>
            <p className="mt-4">
              We may hide or remove anything that breaks these rules, and close the account of someone who
              breaks them again and again. You can report a recording or a comment inside the app. A person on our
              team reads the reports.
            </p>
          </div>

          <div>
            <h2 className="font-serif text-2xl text-navy-950">What you allow us to do with your upload</h2>
            <p className="mt-4">
              You keep all rights in your recording. When you upload it, you give Prabhat Samgiita AI a free,
              non-exclusive permission to store it, play it to listeners in the app and on the website, keep an
              offline copy on a listener&rsquo;s phone, and make the technical copies this needs (for example a
              converted file, loudness data, and backups). You can ask us to remove your recording at any time. It
              stops being shown and played; copies in backups and on phones disappear when they are next refreshed.
            </p>
          </div>

          <div>
            <h2 className="font-serif text-2xl text-navy-950">Copyright and removal requests</h2>
            <p className="mt-4">
              If a recording is yours and you did not allow it to be shared here, use the{" "}
              <Link href="/takedown" className={link}>
                copyright notice form
              </Link>{" "}
              or write to{" "}
              <a href={`mailto:${COPYRIGHT_EMAIL}`} className={link}>
                {COPYRIGHT_EMAIL}
              </a>
              . We read every request and act on a complete one.
            </p>
          </div>

          <div>
            <h2 className="font-serif text-2xl text-navy-950">Your account and deleting it</h2>
            <p className="mt-4">
              Keep your password to yourself. You can delete your account at any time from the app (Profile) or on the{" "}
              <Link href="/delete-account" className={link}>
                account deletion page
              </Link>
              . What is deleted and what stays (for example, recordings you uploaded stay in the library under the
              name you gave them, unless you ask us to remove them) is explained in the{" "}
              <Link href="/privacy" className={link}>
                privacy policy
              </Link>
              .
            </p>
          </div>

          <div>
            <h2 className="font-serif text-2xl text-navy-950">Songs, translations and AI answers</h2>
            <p className="mt-4">
              Song texts, translations and meanings are shared for study and devotion. The AI helper can make
              mistakes: check important things in the original sources. Do not copy the app&rsquo;s content in bulk or
              use it for anything commercial without asking us first.
            </p>
          </div>

          <div>
            <h2 className="font-serif text-2xl text-navy-950">No warranty</h2>
            <p className="mt-4">
              The app is given as it is, free of charge, with no promise that it will always work or that everything in
              it is correct. As far as the law allows, we are not responsible for loss that comes from using it or from
              content that members upload.
            </p>
          </div>

          <div>
            <h2 className="font-serif text-2xl text-navy-950">Changes</h2>
            <p className="mt-4">
              We may change these terms. The &ldquo;Last updated&rdquo; date above will change when we do. If you keep
              using the app after a change, you accept the new terms.
            </p>
          </div>

          <div>
            <h2 className="font-serif text-2xl text-navy-950">Contact</h2>
            <p className="mt-4">
              Questions about these terms or your account:{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className={link}>
                {SUPPORT_EMAIL}
              </a>
              .
            </p>
          </div>

          {/* Draft wording written from the product rules. Remove the line below once the owner has checked it. */}
          <p className="border-l-2 border-gold-500 pl-3 italic">[нужна проверка владельцем]</p>
        </section>

        <p className="mt-8 text-sm text-stone-600">
          <Link href="/" className={link}>
            ← Back to home
          </Link>
        </p>
      </article>
    </main>
  )
}
