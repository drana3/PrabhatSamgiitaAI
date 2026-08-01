"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

import { SongCard } from "@/components/song-card"
import { fetchSongs } from "@/lib/api"
import type { SongSummary } from "@/lib/api"

export function LandingData({ initialSongs }: { initialSongs: SongSummary[]; initialInventory?: unknown[] }) {
  const [songs, setSongs] = useState(initialSongs)

  useEffect(() => {
    let active = true
    void fetchSongs().then((nextSongs) => {
      if (active && nextSongs.length > 0) setSongs(nextSongs)
    })
    return () => { active = false }
  }, [])

  return (
    <div className="mx-auto max-w-[90rem] space-y-20 px-4 py-20 sm:px-6 lg:px-10">
      <section aria-labelledby="featured-title">
        <div className="flex flex-wrap items-end justify-between gap-5 border-b border-navy-900/10 pb-5">
          <div>
            <p className="eyebrow">Featured today</p>
            <h2 id="featured-title" className="mt-3 font-serif text-4xl text-navy-950 sm:text-5xl">Listen, read, and reflect</h2>
          </div>
          <Link href="/explore" className="outline-button">View all 5,018 songs →</Link>
        </div>
        <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {songs.slice(0, 6).map((song, index) => <SongCard key={song.number} song={song} index={index} />)}
        </div>
      </section>

      <section aria-labelledby="guidance-title" className="overflow-hidden rounded-[2rem] bg-navy-950 text-white shadow-2xl">
        <div className="grid lg:grid-cols-[1fr_0.82fr]">
          <div className="p-7 sm:p-10 lg:p-14">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.24em] text-gold-300">Ask Prabhat Samgiita AI</p>
            <h2 id="guidance-title" className="mt-4 max-w-2xl font-serif text-4xl leading-tight sm:text-5xl">Meaning and guidance, grounded in the songs</h2>
            <p className="mt-5 max-w-2xl text-base leading-8 text-navy-100">
              Ask what a song means, find music for a spiritual occasion, compare themes, or explore an idea in your preferred language. Every answer points back to the song sources.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/songs/1#ask" className="gold-button px-6 py-3">Ask about Song 1 →</Link>
              <Link href="/explore" className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold hover:bg-white/10">Find another song</Link>
            </div>
          </div>
          <div className="relative flex min-h-[25rem] items-end overflow-hidden bg-[url('/brand/dawn-hero.png')] bg-cover bg-right lg:min-h-full">
            <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/55 to-transparent lg:bg-gradient-to-r lg:from-navy-950/75 lg:via-navy-950/20 lg:to-transparent" />
            <blockquote className="relative m-6 max-w-xl rounded-2xl border border-white/20 bg-navy-950/80 p-6 backdrop-blur-md sm:m-8 sm:p-8">
              <p className="font-serif text-2xl leading-9 text-ivory-50 sm:text-[1.75rem] sm:leading-10">
                “Prabháta Saḿgiita is the feeling of the heart, and the expression of the heart, and it has been written with the ink of the heart.”
              </p>
              <footer className="mt-5 border-t border-gold-300/35 pt-4 text-sm leading-6 text-gold-100">
                2 Jan 1983, Morning General Darshan<br />Ananda Nagar
              </footer>
            </blockquote>
          </div>
        </div>
      </section>
    </div>
  )
}
