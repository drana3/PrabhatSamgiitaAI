import type { Metadata } from "next"
import Link from "next/link"

import { SiteHeader } from "@/components/site-header"
import { TakedownForm } from "@/components/takedown-form"

export const metadata: Metadata = {
  title: "Copyright and takedown requests | Prabhat Samgiita AI",
  description:
    "How a rights holder can ask us to remove a recording from Prabhat Samgiita AI, and what to include in the request.",
}

const link = "font-semibold text-navy-950 underline decoration-gold-500 underline-offset-4"

export default function TakedownPage() {
  return (
    <main className="min-h-screen bg-ivory-50">
      <SiteHeader />
      <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <p className="eyebrow">Legal</p>
        <h1 className="mt-3 font-serif text-4xl text-navy-950">Copyright and takedown requests</h1>
        <p className="mt-4 text-base leading-7 text-stone-600">
          Members of Prabhat Samgiita AI upload Kiirtan and other recordings. If you own the rights in a
          recording and you did not allow it to be shared here, you can ask us to remove it. A person on our
          team reads every request.
        </p>

        <section className="mt-10 space-y-8 text-sm leading-6 text-stone-600">
          <div>
            <h2 className="font-serif text-2xl text-navy-950">How to ask</h2>
            <ol className="mt-4 list-decimal space-y-2 pl-5">
              <li>Fill in the form below. You do not need an account.</li>
              <li>You get a reference number straight away. Keep it.</li>
              <li>We read your request and write to the email address you gave.</li>
            </ol>
          </div>

          <div>
            <h2 className="font-serif text-2xl text-navy-950">What to include</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5">
              <li>Your name and a way to reach you (email is required).</li>
              <li>
                Which recording: the web address of its page in the app or on the website. If you cannot find
                it, the exact title and the name of the uploader.
              </li>
              <li>Which work is yours, and what your right in it is (author, performer, label, or acting for them).</li>
              <li>A statement that you believe in good faith that the use is not allowed.</li>
              <li>A statement that your information is accurate and that you are the owner or authorized to act for the owner.</li>
              <li>Your electronic signature.</li>
            </ul>
            <p className="mt-4">
              A request that leaves these out may be sent back to you for more detail. Please do not send a
              request you know to be false: the person who uploaded the recording will lose it, and a false
              statement can have legal results for the sender.
            </p>
          </div>

          <div>
            <h2 className="font-serif text-2xl text-navy-950">What happens next</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5">
              <li>
                If we find the recording and the request is complete, we hide the recording and block the same
                file from being uploaded again. We tell the person who uploaded it the reason. We do not give
                them your email address.
              </li>
              <li>
                The uploader may answer with a counter-notice, saying that the removal was a mistake or that
                they have the right to share it. If they do, we send you the counter-notice and wait 14 days.
                If you tell us in that time that you have started a legal process, the recording stays down.
                If we hear nothing, we may put the recording back.
              </li>
              <li>If we cannot act on the request, we write to you and say why.</li>
            </ul>
          </div>

          <div>
            <h2 className="font-serif text-2xl text-navy-950">Uploaders</h2>
            <p className="mt-4">
              If a recording of yours was removed, you get a message in the app with the reason and the steps
              to send a counter-notice. This page is general information and is not legal advice. If you are
              not sure of your rights, ask a lawyer.
            </p>
          </div>
        </section>

        <div className="mt-10">
          <TakedownForm />
        </div>

        <p className="mt-6 text-sm leading-6 text-stone-600">
          If the form does not work, write to{" "}
          <a href="mailto:anandamarga01@gmail.com" className={link}>
            anandamarga01@gmail.com
          </a>{" "}
          and include the same information.
        </p>

        <p className="mt-8 text-sm text-stone-600">
          <Link href="/" className={link}>
            ← Back to home
          </Link>
        </p>
      </article>
    </main>
  )
}
