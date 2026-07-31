"use client"

import { useEffect, useState } from "react"

import { RecommendationSection } from "@/components/recommendation-section"
import { SearchSection } from "@/components/search-section"
import { SongCard } from "@/components/song-card"
import { fetchInventory, fetchSongs } from "@/lib/api"
import type { SongSummary } from "@/lib/api"

type InventoryItem = Awaited<ReturnType<typeof fetchInventory>>[number]

export function LandingData() {
  const [songs, setSongs] = useState<SongSummary[]>([])
  const [inventory, setInventory] = useState<InventoryItem[]>([])

  useEffect(() => {
    let active = true

    const load = async () => {
      const [nextSongs, nextInventory] = await Promise.all([fetchSongs(), fetchInventory()])
      if (!active) return
      setSongs(nextSongs)
      setInventory(nextInventory)
    }

    void load()

    return () => {
      active = false
    }
  }, [])

  return (
    <>
      <section className="mt-10 rounded-[2.25rem] border border-white/60 bg-white/70 p-4 shadow-glow backdrop-blur md:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4 rounded-[1.75rem] border border-ink-100 bg-gradient-to-r from-white to-ink-50 px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.45em] text-ember-700">Explore</p>
            <h2 className="mt-2 font-serif text-4xl text-ink-900">Search and guidance</h2>
          </div>
          <p className="max-w-xl text-sm leading-6 text-ink-600">
            Start with a number, a first line, or the mood of your meditation. The experience is designed to feel
            calm, responsive, and easy to trust.
          </p>
        </div>

        <div id="search" className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <SearchSection initialSongs={songs} />
          <div className="rounded-[2rem] border border-ink-200 bg-ink-950 p-5 text-white shadow-glow md:p-6">
            <p className="text-xs uppercase tracking-[0.4em] text-ember-300">Recommendation context</p>
            <h2 className="mt-2 font-serif text-3xl text-white">Let the moment guide the music</h2>
            <p className="mt-3 text-sm leading-7 text-ink-100">
              Describe the date, festival, mood, or meditation setting and the backend scores verified songs by
              grounded metadata.
            </p>
            <RecommendationSection />
          </div>
        </div>
      </section>

      <section id="catalog" className="mt-10 rounded-[2.25rem] border border-ink-200 bg-white/85 p-5 shadow-glow md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-ember-700">Catalog</p>
            <h2 className="mt-2 font-serif text-4xl text-ink-900">Sample verified songs</h2>
          </div>
          <p className="text-sm text-ink-600">
            {songs.length > 0 ? `${songs.length} records loaded from the API` : "Loading catalog..."}
          </p>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {songs.slice(0, 9).map((song) => (
            <SongCard key={song.number} song={song} />
          ))}
        </div>
      </section>

      <section id="inventory" className="mt-10 rounded-[2.25rem] border border-ink-200 bg-ink-950 p-6 shadow-glow md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-ember-300">Inventory</p>
            <h2 className="mt-2 font-serif text-4xl text-white">Official and verified resources</h2>
          </div>
          <p className="text-sm text-ink-100">
            {inventory.length > 0 ? `${inventory.length} resources indexed` : "Loading inventory..."}
          </p>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {inventory.slice(0, 8).map((item) => (
            <a
              key={item.url}
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-ember-300 hover:bg-white/10"
            >
              <p className="text-xs uppercase tracking-[0.3em] text-ember-300">{item.source_kind}</p>
              <h3 className="mt-2 font-semibold text-white">{item.title}</h3>
              <p className="mt-1 break-all text-sm text-ink-100">{item.url}</p>
            </a>
          ))}
        </div>
      </section>
    </>
  )
}
