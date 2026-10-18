import Link from "next/link"
import { notFound } from "next/navigation"

import { SiteHeader } from "@/components/site-header"
import { fetchStory } from "@/lib/api"
import seedStories from "../../../../../data/generated/stories.json"
import type { InspirationStoryDetail } from "@/lib/api"

function fallbackStory(slug: string): InspirationStoryDetail | null {
  const row = seedStories.find((item) => item.slug === slug)
  if (!row) return null
  return {
    slug: row.slug,
    title: row.title,
    author: row.author,
    teaser: row.teaser,
    read_path: `/stories/${row.slug}`,
    source_url: row.source_url ?? row.url,
    themes: row.themes ?? [],
    song_numbers: (row.song_numbers ?? []).map(Number),
    body_paragraphs: row.body_paragraphs ?? [row.teaser],
  }
}

export default async function StoryDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const story = (await fetchStory(slug)) ?? fallbackStory(slug)
  if (!story) notFound()

  return (
    <main className="min-h-screen bg-ivory-50">
      <SiteHeader active="Stories" />

      <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <Link href="/stories" className="text-sm font-semibold text-gold-700">← All stories</Link>
        <p className="eyebrow mt-6">Stories &amp; inspiration</p>
        <p className="mt-3 text-sm font-semibold text-gold-800">{story.author}</p>
        <h1 className="mt-2 font-serif text-4xl leading-tight text-navy-950 sm:text-5xl">{story.title}</h1>
        <p className="mt-4 text-base leading-7 text-stone-700">{story.teaser}</p>

        {story.song_numbers.length ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {story.song_numbers.map((number) => (
              <Link key={number} href={`/songs/${number}#ask`} className="soft-chip">
                Explore song {number}
              </Link>
            ))}
          </div>
        ) : null}

        <div className="prose-story mt-10 space-y-5">
          {story.body_paragraphs.map((paragraph, index) => (
            <p key={index} className="text-base leading-8 text-navy-950">
              {paragraph}
            </p>
          ))}
        </div>

        <footer className="mt-12 rounded-2xl border border-navy-900/10 bg-white p-5 text-sm leading-6 text-stone-600">
          <p>
            Source archive:{" "}
            <a href={story.source_url} target="_blank" rel="noreferrer" className="font-semibold text-gold-700 underline decoration-gold-400 underline-offset-4">
              prabhatasamgiita.net
            </a>
          </p>
          <p className="mt-2">Content is reproduced here for reading convenience with attribution to the original publisher.</p>
        </footer>
      </article>
    </main>
  )
}
