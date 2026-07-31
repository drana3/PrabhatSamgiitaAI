"use client"

import { useState } from "react"

import { RecommendationForm } from "@/components/recommendation-form"
import { SongCard } from "@/components/song-card"
import type { SongSummary } from "@/lib/api"

export function RecommendationSection() {
  const [results, setResults] = useState<SongSummary[]>([])

  return (
    <div className="mt-4 space-y-4">
      <RecommendationForm onResults={setResults} />
      {results.length > 0 ? (
        <div className="grid gap-3">
          {results.slice(0, 4).map((song) => (
            <SongCard key={song.number} song={song} />
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-ink-200 bg-white p-5 text-sm text-ink-600">
          Enter a context like a festival, mood, or time of day to get grounded recommendations.
        </div>
      )}
    </div>
  )
}
