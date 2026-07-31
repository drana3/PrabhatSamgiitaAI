import Link from "next/link"

import { LandingData } from "@/components/landing-data"
import seedInventory from "../../../data/seed/inventory.json"
import seedSongs from "../../../data/seed/songs.json"

export default function HomePage() {
  const featuredSongs = seedSongs.slice(0, 6)
  const featuredInventory = seedInventory.slice(0, 4)

  return (
    <main className="relative min-h-screen overflow-hidden bg-aurora">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-8rem] top-[-6rem] h-72 w-72 rounded-full bg-ember-300/25 blur-3xl" />
        <div className="absolute right-[-6rem] top-24 h-80 w-80 rounded-full bg-ink-400/20 blur-3xl" />
        <div className="absolute bottom-[-8rem] left-1/3 h-96 w-96 rounded-full bg-white/30 blur-3xl" />
      </div>
      <section className="relative mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-12">
        <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="relative overflow-hidden rounded-[2.5rem] border border-white/60 bg-white/80 p-6 shadow-glow backdrop-blur-md md:p-10">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-ember-400 via-amber-200 to-ink-400" />
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-ember-200 bg-ember-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-ember-700">
                Prabhat Samgiita AI
              </span>
              <span className="rounded-full border border-ink-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-ink-600">
                Lyrics, meaning, and listening
              </span>
            </div>
            <h1 className="mt-5 max-w-3xl font-serif text-5xl leading-[0.95] text-ink-900 md:text-7xl">
              A spiritual archive, presented with clarity and reverence.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-ink-700 md:text-lg">
              Find lyrics by number or first line, explore canonical meanings, listen to verified audio or embedded
              video, and read gentle explanations that stay faithful to the source.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="#catalog"
                className="rounded-full bg-ink-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-ink-800"
              >
                Browse catalog
              </Link>
              <Link
                href="#inventory"
                className="rounded-full border border-ink-200 bg-white px-6 py-3 text-sm font-semibold text-ink-900 transition hover:border-ember-300 hover:bg-ember-50"
              >
                View inventory
              </Link>
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <FeaturePill title="5018 songs" text="Complete catalog coverage" />
              <FeaturePill title="Read meaning" text="Lyrics, translation, and purport" />
              <FeaturePill title="Listen & watch" text="Official audio links and video" />
            </div>
          </div>
          <div className="rounded-[2.5rem] border border-ink-200 bg-white/90 p-6 text-ink-900 shadow-glow md:p-10">
            <p className="text-xs uppercase tracking-[0.4em] text-ember-700">What you can do here</p>
            <div className="mt-6 space-y-4">
              <HighlightCard
                title="Find a song fast"
                text="Search by song number, a remembered first line, or a devotional mood."
              />
              <HighlightCard
                title="Read with clarity"
                text="Lyrics, transliteration, meaning, and explanation are arranged in the order a reader expects."
              />
              <HighlightCard
                title="Listen from the source"
                text="Open official audio links and video when you want to hear the song, not store it twice."
              />
            </div>
          </div>
        </div>
        <LandingData initialSongs={featuredSongs} initialInventory={featuredInventory} />
      </section>
    </main>
  )
}

function FeaturePill({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-3xl border border-ink-200 bg-white px-4 py-4 shadow-sm">
      <p className="text-sm font-semibold text-ink-900">{title}</p>
      <p className="mt-1 text-xs uppercase tracking-[0.22em] text-ink-500">{text}</p>
    </div>
  )
}

function HighlightCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-3xl border border-ink-200 bg-gradient-to-br from-white to-ink-50 p-4 shadow-sm">
      <p className="text-sm font-semibold text-ink-900">{title}</p>
      <p className="mt-2 text-sm leading-6 text-ink-700">{text}</p>
    </div>
  )
}
