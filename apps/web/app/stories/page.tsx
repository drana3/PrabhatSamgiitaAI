import Link from "next/link"

import { SiteHeader } from "@/components/site-header"
import seedStories from "../../../data/generated/stories.json"
import type { InspirationStory } from "@/lib/api"

const stories: InspirationStory[] = seedStories.map((row) => ({
  slug: row.slug,
  title: row.title,
  author: row.author,
  teaser: row.teaser,
  read_path: `/stories/${row.slug}`,
  source_url: row.source_url ?? row.url,
  themes: row.themes ?? [],
  song_numbers: (row.song_numbers ?? []).map(Number),
}))

export default function StoriesPage() {
  return (
    <main className="min-h-screen bg-ivory-50">
      <SiteHeader active="Stories" />

      <section className="mx-auto max-w-[90rem] px-4 py-10 sm:px-6 lg:px-10">
        <p className="eyebrow">Stories &amp; inspiration</p>
        <h1 className="mt-3 max-w-4xl font-serif text-5xl leading-tight text-navy-950 sm:text-6xl">
          Stories and memories related to Prabhat Samgiita
        </h1>
        <p className="mt-5 max-w-3xl text-base leading-7 text-stone-700">
          Read devotee experiences and interviews here in Prabhat Samgiita AI. Each story is sourced from the official archive and opens in this app.
        </p>
      </section>

      <section className="mx-auto grid max-w-[90rem] gap-4 px-4 pb-20 sm:grid-cols-2 sm:px-6 lg:grid-cols-3 lg:px-10">
        {stories.map((story) => (
          <article key={story.slug} className="rounded-[1.35rem] border border-navy-900/10 bg-white p-5 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gold-700">{story.author}</p>
            <h2 className="mt-2 font-serif text-2xl leading-snug text-navy-950">
              <Link href={story.read_path} className="hover:text-gold-700">
                {story.title}
              </Link>
            </h2>
            <p className="mt-3 text-sm leading-6 text-stone-600">{story.teaser}</p>
            {story.themes?.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {story.themes.slice(0, 3).map((theme) => (
                  <span key={theme} className="rounded-full bg-ivory-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-navy-800">
                    {theme}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {story.song_numbers?.map((number) => (
                <Link key={number} href={`/songs/${number}#ask`} className="soft-chip">
                  Song {number}
                </Link>
              ))}
              <Link href={story.read_path} className="text-sm font-semibold text-gold-700 underline decoration-gold-400 underline-offset-4">
                Read story →
              </Link>
            </div>
          </article>
        ))}
      </section>
    </main>
  )
}
