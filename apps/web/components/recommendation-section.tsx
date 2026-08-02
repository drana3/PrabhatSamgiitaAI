"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"

import { LoadingIndicator } from "@/components/loading-indicator"
import { fetchTodayRecommendations, recommendSongs } from "@/lib/api"
import type { SongSummary, TodayRecommendations } from "@/lib/api"
import { publicContextLink } from "@/lib/context-links"
import { getAutoRecommendationPreset, getUpcomingObservances } from "@/lib/recommendation-presets"
import { songPagePath } from "@/lib/song-path"

export function RecommendationSection() {
  const [results, setResults] = useState<SongSummary[]>([])
  const [today, setToday] = useState<TodayRecommendations | null>(null)
  const [loading, setLoading] = useState(true)
  const upcoming = useMemo(() => getUpcomingObservances(), [])
  const fallbackPreset = useMemo(() => getAutoRecommendationPreset(), [])

  useEffect(() => {
    let active = true
    setLoading(true)
    void fetchTodayRecommendations().then(async (value) => {
      if (!active) return
      if (value) {
        setToday(value)
        setResults([])
        return
      }
      const fallback = await recommendSongs(fallbackPreset)
      if (active) {
        setToday(null)
        setResults(fallback)
      }
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [fallbackPreset])

  const contextTitle = today?.signals[0]?.title || fallbackPreset.title
  const contextSummary = today?.signals[0]?.summary || fallbackPreset.subtitle
  const contextSignal = today?.signals[0]
  const contextLink = contextSignal ? publicContextLink(contextSignal.source_url) : null
  const strictFestivalWithoutSongs = today?.context.recommendation_mode === "strict_festival" && !today.recommendations.length

  return (
    <div className="surface-card overflow-hidden shadow-[0_24px_70px_rgba(29,43,66,0.12)]">
      <div className="border-b border-navy-900/10 bg-gradient-to-r from-gold-50 to-white p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Selected for this moment</p>
            <h3 className="mt-2 font-serif text-3xl text-navy-950">{contextTitle}</h3>
            <p className="mt-2 max-w-xl text-sm leading-6 text-stone-600">{contextSummary}</p>
            {contextLink && contextSignal ? <a href={contextLink} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-xs font-semibold text-gold-700 underline decoration-gold-400 underline-offset-4">Context from {contextSignal.source_name} ↗</a> : null}
          </div>
          {loading ? <LoadingIndicator label="Finding songs" compact /> : <span className="text-xs font-semibold text-emerald-700">Updated for today</span>}
        </div>
      </div>

      <div aria-busy={loading} className="divide-y divide-navy-900/10 px-5 sm:px-6">
        {today?.recommendations.length ? today.recommendations.slice(0, 3).map((song) => (
          <article key={song.number} className="py-4">
            <div className="flex flex-wrap items-center gap-4 sm:flex-nowrap">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-navy-950 font-serif text-sm text-white">{song.number}</span>
              <div className="min-w-0 flex-1"><Link href={songPagePath(song.number)} className="block truncate font-serif text-lg font-semibold text-navy-950 hover:text-gold-700">{song.title}</Link><p className="truncate text-xs text-stone-500">{song.reasons[0] || "For today's reflection"}</p></div>
              <Link href={songPagePath(song.number)} className="soft-chip shrink-0">Open song →</Link>
            </div>
          </article>
        )) : results.length ? results.slice(0, 3).map((song) => (
          <article key={song.number} className="flex flex-wrap items-center gap-4 py-4 sm:flex-nowrap"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-navy-950 font-serif text-sm text-white">{song.number}</span><div className="min-w-0 flex-1"><Link href={songPagePath(song.number)} className="block truncate font-serif text-lg font-semibold text-navy-950 hover:text-gold-700">{song.title}</Link><p className="truncate text-xs text-stone-500">{song.theme || song.mood || "A song for reflection"}</p></div><Link href={songPagePath(song.number)} className="soft-chip shrink-0">Open song →</Link></article>
        )) : <div className="py-6 text-center"><p className="font-serif text-xl text-navy-950">{strictFestivalWithoutSongs ? `No source-verified songs are assigned specifically to ${contextTitle} yet` : "A fresh selection is on its way"}</p><p className="mt-2 text-sm leading-6 text-stone-600">{strictFestivalWithoutSongs ? "We will not mix unrelated songs into this observance. You can still explore the complete Prabhat Samgiita collection." : "Browse the complete collection while today’s recommendations reconnect."}</p><Link href="/explore" className="outline-button mt-4">Explore songs</Link></div>}
      </div>

      {today?.recommendations.length ? <p className="border-t border-navy-900/10 px-5 py-3 text-xs leading-5 text-stone-500 sm:px-6">{today.disclaimer}</p> : null}

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
            <Link key={observance.title} href={`/explore?q=${encodeURIComponent(observance.query)}&kind=catalog#catalog-search`} className="rounded-xl border border-white/15 bg-white/8 p-3 transition hover:border-gold-300 hover:bg-white/12">
              <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-gold-300">{observance.dateLabel}</span>
              <span className="mt-1 block text-sm font-semibold text-white">{observance.title}</span>
              <span className="mt-2 block text-[11px] text-navy-200">{observance.daysUntil === 0 ? "Today" : `In ${observance.daysUntil} days`} · Find songs →</span>
            </Link>
          ))}
        </div>
        <a href="https://india.anandamarga.org/ananda-marga-festivals-imp-days/" target="_blank" rel="noreferrer" className="mt-4 inline-flex text-[11px] font-semibold text-gold-200 underline decoration-gold-300/60 underline-offset-4">Reviewed 2026 Ananda Marga calendar ↗</a>
      </section>
    </div>
  )
}
