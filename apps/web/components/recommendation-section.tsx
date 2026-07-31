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
      <div className="grid gap-3">
        {results.slice(0, 4).map((song) => (
          <SongCard key={song.number} song={song} />
        ))}
      </div>
    </div>
  )
}
