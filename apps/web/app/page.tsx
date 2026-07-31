import Image from "next/image"
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
        <div className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="relative overflow-hidden rounded-[2.75rem] border border-white/60 bg-white/82 p-6 shadow-glow backdrop-blur-md md:p-10">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-ember-400 via-amber-200 to-ink-400" />
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-ember-200 bg-ember-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-ember-700">
                Prabhat Samgiita AI BOT
              </span>
              <span className="rounded-full border border-ink-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-ink-600">
                Lyrics, meaning, audio, and video
              </span>
            </div>
            <div className="mt-8 grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
              <div className="space-y-5">
                <div className="flex items-center gap-4">
                  <Image
                    src="/brand/prabhat-samgiita-logo.png"
                    alt="Prabhat Samgiita logo"
                    width={104}
                    height={104}
                    className="h-20 w-20 rounded-2xl border border-ink-100 bg-white object-contain p-2 shadow-sm"
                    priority
                  />
                  <div>
                    <p className="text-xs uppercase tracking-[0.4em] text-ember-700">Songs of the new dawn</p>
                    <h2 className="mt-2 font-serif text-3xl text-ink-900">Prabhat Samgiita</h2>
                  </div>
                </div>
                <h1 className="max-w-2xl font-serif text-5xl leading-[0.95] text-ink-900 md:text-7xl">
                  The divine songs for a new dawn.
                </h1>
                <p className="max-w-2xl text-base leading-8 text-ink-700 md:text-lg">
                  Search by number or first line, read the canonical meaning, listen to verified audio or embedded
                  video, and ask the Prabhat Samgiita AI BOT for a grounded explanation in your language.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link
                    href="#search"
                    className="rounded-full bg-ink-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-ink-800"
                  >
                    Search songs
                  </Link>
                  <Link
                    href="#catalog"
                    className="rounded-full border border-ink-200 bg-white px-6 py-3 text-sm font-semibold text-ink-900 transition hover:border-ember-300 hover:bg-ember-50"
                  >
                    Browse catalog
                  </Link>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <FeaturePill title="5018 songs" text="Complete catalog coverage" />
                  <FeaturePill title="Multilingual" text="English, Hindi, Bengali, Tamil, Urdu, Maithili, Magahi" />
                  <FeaturePill title="Audio + video" text="Verified source playback" />
                </div>
              </div>
              <div className="relative overflow-hidden rounded-[2rem] border border-ink-200 bg-gradient-to-br from-white via-white to-ember-50 p-3 shadow-sm">
                <Image
                  src="/brand/shrii-shrii-anandamurti.jpg"
                  alt="Shrii Shrii Anandamurti"
                  width={900}
                  height={1200}
                  className="h-full min-h-[18rem] w-full rounded-[1.5rem] object-cover object-top"
                />
                <div className="absolute inset-x-6 bottom-6 rounded-[1.5rem] border border-white/60 bg-white/82 p-4 backdrop-blur-sm">
                  <p className="text-xs uppercase tracking-[0.35em] text-ember-700">About the composer</p>
                  <p className="mt-2 text-sm leading-6 text-ink-700">
                    Prabhat Samgiita was composed by Shrii Shrii Anandamurti ji, expressing devotion, wisdom, and
                    the spirit of service in song.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="rounded-[2.75rem] border border-ink-200 bg-white/92 p-6 text-ink-900 shadow-glow md:p-10">
            <p className="text-xs uppercase tracking-[0.4em] text-ember-700">What you can do here</p>
            <h2 className="mt-3 font-serif text-4xl text-ink-900">A calm, guided entry point for devotees and listeners.</h2>
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
            <div className="mt-6 rounded-[1.75rem] border border-amber-100 bg-gradient-to-br from-ember-50 to-white p-5">
              <p className="text-xs uppercase tracking-[0.35em] text-ember-700">Why it feels premium</p>
              <p className="mt-2 text-sm leading-7 text-ink-700">
                The page is designed like an editorial listening room: large serif headlines, warm space, direct
                actions, and the song content placed before any technical detail.
              </p>
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
