"use client"

import { useEffect, useMemo, useState } from "react"

import { RecommendationForm } from "@/components/recommendation-form"
import { SongCard } from "@/components/song-card"
import type { SongSummary } from "@/lib/api"
import { recommendSongs } from "@/lib/api"
import { getAutoRecommendationPreset, quickRecommendationPresets } from "@/lib/recommendation-presets"
import seedSongs from "../../../data/seed/songs.json"

export function RecommendationSection() {
  const [results, setResults] = useState<SongSummary[]>(seedSongs.slice(0, 4) as SongSummary[])
  const [presetKey, setPresetKey] = useState("auto")
  const presets = useMemo(() => quickRecommendationPresets(), [])
  const autoPreset = useMemo(() => getAutoRecommendationPreset(), [])

  const activePreset = useMemo(() => {
    if (presetKey === "auto") return autoPreset
    return presets.find((item) => item.id === presetKey)?.preset ?? autoPreset
  }, [autoPreset, presetKey, presets])

  useEffect(() => {
    let active = true
    const run = async () => {
      try {
        const next = await recommendSongs(activePreset)
        if (active && next.length > 0) {
          setResults(next)
        }
      } catch {
        // keep the seed results visible
      }
    }
    void run()
    return () => {
      active = false
    }
  }, [activePreset])

  return (
    <div className="mt-5 space-y-4">
      <div className="rounded-[1.75rem] border border-white/10 bg-slate-950/25 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.2)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.35em] text-ember-200">Automatic recommendation</p>
            <h3 className="mt-2 font-serif text-2xl text-white">{activePreset.title}</h3>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-100">{activePreset.subtitle}</p>
          </div>
          <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.25em] text-amber-50">
            Based on today
          </span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {presets.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPresetKey(item.id)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                presetKey === item.id
                  ? "border-ember-300 bg-ember-500 text-white"
                  : "border-white/15 bg-white/5 text-slate-100 hover:border-ember-300 hover:bg-white/10"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <details className="group mt-5 rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
          <summary className="cursor-pointer list-none text-sm font-semibold text-white">
            More ways to refine
          </summary>
          <p className="mt-2 text-sm leading-6 text-slate-100">
            Keep the main experience simple. Open this only if you want a specific date, mood, language, or
            meditation setting.
          </p>
          <div className="mt-4">
            <RecommendationForm onResults={setResults} />
          </div>
        </details>
      </div>
      {results.length > 0 ? (
        <div className="grid gap-3">
          {results.slice(0, 4).map((song) => (
            <SongCard key={song.number} song={song} />
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-white/15 bg-white/5 p-5 text-sm leading-6 text-slate-100">
          A fresh recommendation will appear here automatically.
        </div>
      )}
    </div>
  )
}
