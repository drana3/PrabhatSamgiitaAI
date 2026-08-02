"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

import { fetchFeaturedStory, fetchStories } from "@/lib/api"
import type { InspirationStory } from "@/lib/api"
import seedStories from "../../../data/generated/stories.json"

function toFallbackStory(row: (typeof seedStories)[number]): InspirationStory {
  return {
    slug: row.slug,
    title: row.title,
    author: row.author,
    teaser: row.teaser,
    read_path: `/stories/${row.slug}`,
    source_url: row.source_url ?? row.url,
    themes: row.themes ?? [],
    song_numbers: (row.song_numbers ?? []).map(Number),
  }
}

const fallbackStories = seedStories.map(toFallbackStory)

function StoryCard({ story, compact = false }: { story: InspirationStory; compact?: boolean }) {
  return (
    <article className={compact ? "rounded-2xl border border-navy-900/10 bg-white p-4" : "rounded-[1.35rem] border border-navy-900/10 bg-white p-5 shadow-sm"}>
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gold-700">{story.author}</p>
      <h3 className={`mt-2 font-serif font-semibold text-navy-950 ${compact ? "text-lg leading-snug" : "text-xl leading-snug"}`}>
        <Link href={story.read_path} className="hover:text-gold-700">
          {story.title}
        </Link>
      </h3>
      <p className={`mt-2 text-sm leading-6 text-stone-600 ${compact ? "line-clamp-2" : "line-clamp-3"}`}>{story.teaser}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {story.song_numbers?.map((number) => (
          <Link key={number} href={`/songs/${number}#ask`} className="soft-chip">
            Song {number}
          </Link>
        ))}
        <Link href={story.read_path} className="text-xs font-semibold text-gold-700 underline decoration-gold-400 underline-offset-4">
          Read in app →
        </Link>
      </div>
    </article>
  )
}

export function StoriesInspiration() {
  const [featured, setFeatured] = useState<InspirationStory | null>(fallbackStories[0] ?? null)
  const [stories, setStories] = useState<InspirationStory[]>(fallbackStories.slice(0, 6))

  useEffect(() => {
    void Promise.all([fetchFeaturedStory(), fetchStories({ limit: 6 })]).then(([nextFeatured, nextStories]) => {
      if (nextFeatured) setFeatured(nextFeatured)
      if (nextStories.length) setStories(nextStories)
    })
  }, [])

  if (!featured) return null

  const highlights = stories.filter((story) => story.slug !== featured.slug).slice(0, 3)

  return (
    <section aria-labelledby="stories-inspiration-title" className="mx-auto max-w-[90rem] px-4 py-16 sm:px-6 lg:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <p className="eyebrow">Stories &amp; inspiration</p>
          <h2 id="stories-inspiration-title" className="mt-3 font-serif text-4xl text-navy-950 sm:text-5xl">
            Memories from the Prabhat Samgiita journey
          </h2>
          <p className="mt-4 text-sm leading-7 text-stone-700">
            Devotee experiences, interviews, and reflections — read here in Prabhat Samgiita AI, sourced from the official archive with attribution.
          </p>
        </div>
        <Link href="/stories" className="outline-button">Browse all stories →</Link>
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="overflow-hidden rounded-[2rem] border border-gold-500/25 bg-gradient-to-br from-navy-950 via-[#0c3564] to-navy-900 p-6 text-white shadow-xl sm:p-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold-300">Featured today</p>
          <p className="mt-3 text-sm font-semibold text-gold-100">{featured.author}</p>
          <h3 className="mt-2 font-serif text-3xl leading-tight sm:text-4xl">{featured.title}</h3>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-navy-100">{featured.teaser}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={featured.read_path} className="gold-button px-5 py-2.5 text-navy-950">
              Read the story →
            </Link>
            {featured.song_numbers?.[0] ? (
              <Link href={`/songs/${featured.song_numbers[0]}#ask`} className="rounded-full border border-white/25 px-5 py-2.5 text-sm font-semibold hover:bg-white/10">
                Open song {featured.song_numbers[0]}
              </Link>
            ) : null}
          </div>
        </article>

        <div className="grid gap-4">
          {highlights.map((story) => (
            <StoryCard key={story.slug} story={story} compact />
          ))}
        </div>
      </div>
    </section>
  )
}

export function SongStoriesPanel({ songNumber }: { songNumber: number }) {
  const [stories, setStories] = useState<InspirationStory[]>(
    fallbackStories.filter((story) => story.song_numbers?.includes(songNumber)),
  )

  useEffect(() => {
    void fetchStories({ songNumber, limit: 4 }).then((items) => {
      if (items.length) setStories(items)
    })
  }, [songNumber])

  if (!stories.length) return null

  return (
    <section className="surface-card p-5 sm:p-6">
      <p className="eyebrow">Stories &amp; inspiration</p>
      <h2 className="mt-2 font-serif text-3xl text-navy-950">Connected to this song</h2>
      <p className="mt-2 text-sm leading-6 text-stone-600">
        Devotee stories linked to song {songNumber}, available to read in the app.
      </p>
      <div className="mt-5 space-y-4">
        {stories.map((story) => (
          <StoryCard key={story.slug} story={story} compact />
        ))}
      </div>
      <Link href="/stories" className="mt-4 inline-flex text-sm font-semibold text-gold-700">
        Browse all inspiration stories →
      </Link>
    </section>
  )
}
