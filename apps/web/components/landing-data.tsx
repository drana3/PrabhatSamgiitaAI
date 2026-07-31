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
      <div id="search" className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <SearchSection initialSongs={songs} />
        <div className="rounded-3xl border border-ink-200 bg-white p-5">
          <h2 className="font-serif text-3xl text-ink-900">Recommendation context</h2>
          <p className="mt-2 text-sm text-ink-600">
            Describe the date, festival, mood, or meditation setting and the backend scores verified songs by
            grounded metadata.
          </p>
          <RecommendationSection />
        </div>
      </div>

      <section id="catalog" className="mt-10">
        <div className="flex items-end justify-between gap-4">
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

      <section id="inventory" className="mt-10 rounded-[2rem] border border-ink-200 bg-white p-6 md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-ember-700">Inventory</p>
            <h2 className="mt-2 font-serif text-4xl text-ink-900">Official and verified resources</h2>
          </div>
          <p className="text-sm text-ink-600">
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
              className="rounded-2xl border border-ink-200 bg-ink-50 p-4 transition hover:border-ember-300 hover:bg-white"
            >
              <p className="text-xs uppercase tracking-[0.3em] text-ember-700">{item.source_kind}</p>
              <h3 className="mt-2 font-semibold text-ink-900">{item.title}</h3>
              <p className="mt-1 break-all text-sm text-ink-600">{item.url}</p>
            </a>
          ))}
        </div>
      </section>
    </>
  )
}
