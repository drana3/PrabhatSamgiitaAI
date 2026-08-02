"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"

import { LoadingIndicator } from "@/components/loading-indicator"
import { SearchForm } from "@/components/search-form"
import { SongCard } from "@/components/song-card"
import { SpecialCollections } from "@/components/special-collections"
import { fetchSongs } from "@/lib/api"
import type { SongSummary, VoiceSearchResult } from "@/lib/api"
import { specialCollectionCount } from "@/lib/special-collections"

const themes = [
  { label: "♡ Love & devotion", query: "love devotion" },
  { label: "♧ Peace & bliss", query: "peace bliss" },
  { label: "☀ Spiritual awakening", query: "spiritual awakening" },
  { label: "♙ Service & humanity", query: "service humanity" },
  { label: "♧ Nature", query: "nature river mountain" },
]
export function ExploreClient({ initialSongs, initialQuery, inputMode = "text", spokenLanguage }: { initialSongs: SongSummary[]; initialQuery: string; inputMode?: "text" | "voice"; spokenLanguage?: string }) {
  const [songs, setSongs] = useState(initialSongs)
  const [searching, setSearching] = useState(Boolean(initialQuery))
  const [completedQuery, setCompletedQuery] = useState("")
  const [voiceResult, setVoiceResult] = useState<VoiceSearchResult | null>(null)
  const resultsRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (initialQuery) return
    let active = true
    void fetchSongs().then((value) => { if (active && value.length) setSongs(value) })
    return () => { active = false }
  }, [initialQuery])

  useEffect(() => {
    if (searching || !initialQuery || completedQuery !== initialQuery) return
    const frame = window.requestAnimationFrame(() => {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      resultsRef.current?.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "start",
      })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [completedQuery, initialQuery, searching])

  function handleSearching(nextSearching: boolean) {
    setSearching(nextSearching)
    setCompletedQuery(nextSearching ? "" : initialQuery)
  }

  return (
    <div className="mx-auto max-w-[90rem] px-4 py-8 sm:px-6 lg:px-10">
      <div className="flex flex-wrap items-baseline gap-4">
        <h1 className="font-serif text-4xl text-navy-950 sm:text-5xl">Explore Prabhat Samgiita</h1>
        <span className="text-sm font-semibold text-gold-700">5,018 songs</span>
      </div>
      <div className="mt-6 max-w-4xl"><SearchForm initialQuery={initialQuery} inputMode={inputMode} spokenLanguage={spokenLanguage} onResults={setSongs} onSearching={handleSearching} onVoiceResult={setVoiceResult} /></div>

      {voiceResult ? (
        <div role="status" className={`mt-4 max-w-4xl rounded-2xl border px-5 py-4 ${voiceResult.confidence === "low" || voiceResult.confidence === "none" ? "border-amber-500/40 bg-amber-50" : "border-emerald-700/20 bg-emerald-50"}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-stone-700"><span className="font-semibold text-navy-950">We heard:</span> “{voiceResult.heard}”</p>
            <span className="rounded-full bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-navy-950">{voiceResult.confidence} confidence</span>
          </div>
          {voiceResult.interpreted_as && voiceResult.interpreted_as.toLocaleLowerCase() !== voiceResult.heard.toLocaleLowerCase() ? <p className="mt-2 text-xs text-stone-600">Interpreted for search as “{voiceResult.interpreted_as}”.</p> : null}
          {voiceResult.guidance ? <p className="mt-2 text-sm font-medium text-amber-900">{voiceResult.guidance}</p> : <p className="mt-2 text-xs text-stone-600">Showing the three strongest verified catalog matches.</p>}
        </div>
      ) : null}

      <div className="mt-8 space-y-5 border-y border-navy-900/10 py-6">
        <FilterRow label="Browse by theme" items={themes} />
        <a href="#collections" className="inline-flex text-sm font-semibold text-gold-700 underline decoration-gold-400 underline-offset-4">Browse all {specialCollectionCount} special collections →</a>
        <p className="text-xs leading-5 text-stone-500"><strong className="text-navy-950">Raga & tala:</strong> the musical index is published progressively as canonical notation pages are reviewed.</p>
      </div>

      <div className="mt-8"><SpecialCollections activeQuery={initialQuery} /></div>

      {initialQuery ? (
        <div id="active-filter" role="status" className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gold-500/35 bg-gold-50 px-5 py-4">
          <p className="text-sm text-stone-700"><span className="font-semibold text-navy-950">Showing songs for:</span> {initialQuery}</p>
          <Link href="/explore" className="text-xs font-semibold text-gold-700 underline underline-offset-4">Clear search</Link>
        </div>
      ) : null}

      <div ref={resultsRef} id="results" className="mt-8 flex scroll-mt-28 items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Top results</p>
          <h2 className="mt-2 font-serif text-3xl text-navy-950">
            {initialQuery ? <>{inputMode === "voice" ? "Top voice matches for" : "Songs matching"} <span className="text-gold-700">“{initialQuery}”</span></> : "Explore the songs"}
          </h2>
        </div>
        <span className="text-xs font-semibold text-stone-500">{songs.length} shown</span>
      </div>
      {searching ? (
        <div className="mt-6 rounded-2xl border border-gold-500/25 bg-white p-8"><LoadingIndicator label="Finding the verified songs in this collection" /></div>
      ) : songs.length ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{songs.map((song, index) => <SongCard key={song.number} song={song} index={index} />)}</div>
      ) : (
        <div className="mt-6 space-y-6">
          <div role="status" className="rounded-2xl border border-dashed border-gold-500/40 bg-white p-8 text-center">
            <h3 className="font-serif text-2xl text-navy-950">No songs matched your search criteria</h3>
            <p className="mt-2 text-sm text-stone-600">Try a song number, opening words, feeling, language, festival, or occasion.</p>
          </div>
          {initialSongs.length ? (
            <section aria-labelledby="recommended-after-search-title">
              <p className="eyebrow">A gentle next step</p>
              <h3 id="recommended-after-search-title" className="mt-2 font-serif text-2xl text-navy-950">Recommended songs to explore</h3>
              <p className="mt-2 text-sm text-stone-600">These are suggestions, not matches for your search.</p>
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {initialSongs.slice(0, 3).map((song, index) => <SongCard key={song.number} song={song} index={index} />)}
              </div>
            </section>
          ) : null}
        </div>
      )}

    </div>
  )
}

function FilterRow({ label, items }: { label: string; items: Array<{ label: string; query: string }> }) {
  return <div><p className="mb-3 text-xs font-bold text-navy-950">{label}</p><div className="flex flex-wrap gap-2">{items.map((item) => <Link key={item.label} href={`/explore?q=${encodeURIComponent(item.query)}`} className="soft-chip">{item.label}</Link>)}</div></div>
}
