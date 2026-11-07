import type { Metadata } from "next"
import Link from "next/link"

import { SiteHeader } from "@/components/site-header"
import { authorPath, authorPhotoUrl, fetchAuthorDirectory, formatCount, siteOrigin } from "@/lib/authors"

export const revalidate = 300

export const metadata: Metadata = {
  title: "Authors | Prabhat Samgiita",
  description: "Singers and groups who share Kiirtan, bhajans and Prabhat Samgiita recordings on Prabhat Samgiita AI.",
  alternates: { canonical: `${siteOrigin()}/authors` },
  robots: { index: true, follow: true },
}

export default async function AuthorsPage() {
  const directory = await fetchAuthorDirectory()
  return (
    <main className="min-h-screen bg-ivory-100">
      <SiteHeader active="Explore" />
      <section className="mx-auto max-w-[90rem] px-4 py-12 sm:px-6 lg:px-10">
        <p className="eyebrow">Authors</p>
        <h1 className="mt-3 max-w-4xl font-serif text-5xl font-bold leading-tight text-navy-950 sm:text-7xl">Singers and groups</h1>
        <div className="mt-6 h-px w-24 bg-gold-500" />
        <p className="mt-6 max-w-2xl text-lg leading-8 text-navy-800">
          Each author has one page with all their Kiirtan, bhajans and Prabhat Samgiita recordings. To make your own page, open the Prabhat Samgiita app and choose Become an author.
        </p>

        {directory === null ? (
          <p className="mt-12 text-stone-700">The list could not be loaded. Please try again in a moment.</p>
        ) : directory.items.length === 0 ? (
          <p className="mt-12 text-stone-700">No author pages yet.</p>
        ) : (
          <ul className="mt-12 grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
            {directory.items.map((a) => {
              const photo = authorPhotoUrl(a.photo_url)
              return (
                <li key={a.slug} className="border-t border-gold-500/30">
                  <Link href={authorPath(a.slug)} className="flex items-center gap-4 py-5 transition hover:bg-gold-50">
                    {photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photo} alt="" width={64} height={64} className="h-16 w-16 shrink-0 rounded-full object-cover" />
                    ) : (
                      <span aria-hidden="true" className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-navy-950 font-serif text-2xl text-gold-300">
                        {a.display_name.trim().slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block truncate font-serif text-2xl text-navy-950">{a.display_name}</span>
                      <span className="mt-0.5 block text-xs font-semibold uppercase tracking-[0.14em] text-navy-700">
                        {[a.verified ? "Verified" : null, `${a.recordings_count} ${a.recordings_count === 1 ? "recording" : "recordings"}`, a.monthly_listeners ? `${formatCount(a.monthly_listeners)} monthly listeners` : null].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </main>
  )
}
