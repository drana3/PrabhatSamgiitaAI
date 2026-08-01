"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"

import { LoadingIndicator } from "@/components/loading-indicator"
import { AudioRendition } from "@/components/audio-rendition"
import { RecommendationForm } from "@/components/recommendation-form"
import { fetchTodayRecommendations, recommendSongs } from "@/lib/api"
import type { SongSummary, TodayRecommendations } from "@/lib/api"
import { getAutoRecommendationPreset, getUpcomingObservances, quickRecommendationPresets } from "@/lib/recommendation-presets"
import seedSongs from "../../../data/seed/songs.json"

export function RecommendationSection() {
  const [results, setResults] = useState<SongSummary[]>(seedSongs.slice(0, 3) as SongSummary[])
  const [today, setToday] = useState<TodayRecommendations | null>(null)
  const [presetKey, setPresetKey] = useState("auto")
  const [loading, setLoading] = useState(true)
  const presets = useMemo(() => quickRecommendationPresets(), [])
  const upcoming = useMemo(() => getUpcomingObservances(), [])
  const autoPreset = useMemo(() => getAutoRecommendationPreset(), [])
  const activePreset = presetKey === "auto" ? autoPreset : presets.find((item) => item.id === presetKey)?.preset ?? autoPreset

  useEffect(() => {
    let active = true
    setLoading(true)
    if (presetKey === "auto") {
      void fetchTodayRecommendations().then((value) => {
        if (active && value?.recommendations.length) setToday(value)
      }).finally(() => { if (active) setLoading(false) })
    } else {
      void recommendSongs(activePreset).then((next) => {
        if (active && next.length) { setResults(next); setToday(null) }
      }).finally(() => { if (active) setLoading(false) })
    }
    return () => { active = false }
  }, [activePreset, presetKey])

  const contextTitle = today?.signals[0]?.title || activePreset.title
  const contextSummary = today?.signals[0]?.summary || activePreset.subtitle
  const contextSignal = today?.signals[0]

  return (
    <div className="surface-card overflow-hidden shadow-[0_24px_70px_rgba(29,43,66,0.12)]">
      <div className="border-b border-navy-900/10 bg-gradient-to-r from-gold-50 to-white p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Selected for this moment</p>
            <h3 className="mt-2 font-serif text-3xl text-navy-950">{contextTitle}</h3>
            <p className="mt-2 max-w-xl text-sm leading-6 text-stone-600">{contextSummary}</p>
            {contextSignal ? <a href={contextSignal.source_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-xs font-semibold text-gold-700 underline decoration-gold-400 underline-offset-4">Context from {contextSignal.source_name} ↗</a> : null}
          </div>
          {loading ? <LoadingIndicator label="Finding songs" compact /> : <span className="text-xs font-semibold text-emerald-700">Updated for today</span>}
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" onClick={() => setPresetKey("auto")} className={`soft-chip ${presetKey === "auto" ? "border-gold-600 bg-gold-100" : ""}`}>Today</button>
          {presets.filter((item) => item.id !== "auto").map((item) => <button key={item.id} type="button" onClick={() => setPresetKey(item.id)} className={`soft-chip ${presetKey === item.id ? "border-gold-600 bg-gold-100" : ""}`}>{item.label}</button>)}
        </div>
      </div>

      <div aria-busy={loading} className="divide-y divide-navy-900/10 px-5 sm:px-6">
        {today?.recommendations.length ? today.recommendations.slice(0, 3).map((song) => (
          <article key={song.number} className="py-4">
            <div className="flex items-center gap-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-navy-950 font-serif text-sm text-white">{song.number}</span>
              <div className="min-w-0 flex-1"><Link href={`/songs/${song.number}`} className="block truncate font-serif text-lg font-semibold text-navy-950 hover:text-gold-700">{song.title}</Link><p className="truncate text-xs text-stone-500">{song.reasons[0] || "For today's reflection"}</p></div>
              {song.audio_url ? <div className="hidden lg:block"><AudioRendition url={song.audio_url} title={song.title} compact /></div> : null}
            </div>
            <div className="mt-3 flex flex-wrap gap-2 pl-14 text-[11px] font-semibold">
              {song.audio_url ? <Link href={`/songs/${song.number}#listen`} className="soft-chip" data-feature="recommendation_listen">▶ Listen</Link> : null}
              {song.video_embed_url ? <Link href={`/songs/${song.number}#watch`} className="soft-chip">▶ Watch</Link> : null}
              <Link href={`/songs/${song.number}#meaning`} className="soft-chip">Understand</Link>
              <Link href={`/songs/${song.number}#lyrics`} className="soft-chip">Learn</Link>
              {song.notation_available ? <Link href={`/songs/${song.number}#notation`} className="soft-chip">Practise harmonium</Link> : null}
            </div>
          </article>
        )) : results.length ? results.slice(0, 3).map((song) => (
          <Link key={song.number} href={`/songs/${song.number}`} className="group flex items-center gap-4 py-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-navy-950 font-serif text-sm text-white">{song.number}</span><div className="min-w-0 flex-1"><p className="truncate font-serif text-lg font-semibold text-navy-950 group-hover:text-gold-700">{song.title}</p><p className="truncate text-xs text-stone-500">{song.theme || song.mood || "A song for reflection"}</p></div><span className="grid h-8 w-8 place-items-center rounded-full border border-navy-900/15 text-[10px]">▶</span></Link>
        )) : <div className="py-6 text-center"><p className="font-serif text-xl text-navy-950">A fresh selection is on its way</p><p className="mt-2 text-sm text-stone-600">Browse the complete collection while today&apos;s recommendations reconnect.</p><Link href="/explore" className="outline-button mt-4">Explore songs</Link></div>}
      </div>

      <details className="border-t border-navy-900/10 p-5 sm:p-6"><summary className="cursor-pointer text-sm font-semibold text-gold-700">Refine these suggestions</summary><p className="mt-2 text-sm text-stone-600">Optionally add a mood, language, or meditation setting.</p><div className="mt-4 rounded-2xl bg-navy-950 p-4"><RecommendationForm onResults={(value) => { setResults(value); setToday(null) }} /></div></details>

      <section aria-labelledby="upcoming-observances-title" className="border-t border-navy-900/10 bg-navy-950 p-5 text-white sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-gold-300">Ananda Marga calendar</p>
            <h4 id="upcoming-observances-title" className="mt-2 font-serif text-2xl">Upcoming observances</h4>
          </div>
          <span className="text-xs text-navy-200">Songs prepared for what is ahead</span>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {upcoming.map((observance) => (
            <a key={observance.title} href={`/explore?q=${encodeURIComponent(observance.query)}#results`} className="rounded-xl border border-white/15 bg-white/8 p-3 transition hover:border-gold-300 hover:bg-white/12">
              <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-gold-300">{observance.dateLabel}</span>
              <span className="mt-1 block text-sm font-semibold text-white">{observance.title}</span>
              <span className="mt-2 block text-[11px] text-navy-200">{observance.daysUntil === 0 ? "Today" : `In ${observance.daysUntil} days`} · Find songs →</span>
            </a>
          ))}
        </div>
        <a href="https://india.anandamarga.org/ananda-marga-festivals-imp-days/" target="_blank" rel="noreferrer" className="mt-4 inline-flex text-[11px] font-semibold text-gold-200 underline decoration-gold-300/60 underline-offset-4">Reviewed 2026 Ananda Marga calendar ↗</a>
      </section>
    </div>
  )
}
