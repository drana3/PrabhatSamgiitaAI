"use client"

import { useState } from "react"

import { SearchForm } from "@/components/search-form"
import { SongCard } from "@/components/song-card"
import type { SongSummary } from "@/lib/api"

export function SearchSection({ initialSongs }: { initialSongs: SongSummary[] }) {
  const [songs, setSongs] = useState(initialSongs)

  return (
    <div className="space-y-4">
      <SearchForm onResults={setSongs} />
      <div className="grid gap-4">
        {songs.slice(0, 6).map((song) => (
          <SongCard key={song.number} song={song} />
        ))}
      </div>
    </div>
  )
}
