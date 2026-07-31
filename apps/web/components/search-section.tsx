"use client"

import { useState } from "react"

import { SearchForm } from "@/components/search-form"
import { SongCard } from "@/components/song-card"
import type { SongSummary } from "@/lib/api"

export function SearchSection({ initialSongs }: { initialSongs: SongSummary[] }) {
  const [songs, setSongs] = useState(initialSongs)

  return (
    <div className="space-y-4 rounded-[2rem] border border-ink-200 bg-white p-5 shadow-glow">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-ember-700">Search</p>
          <h2 className="mt-2 font-serif text-3xl text-ink-900">Find a song fast</h2>
        </div>
        <p className="text-sm text-ink-600">{songs.length} results loaded</p>
      </div>
      <SearchForm onResults={setSongs} />
      {songs.length > 0 ? (
        <div className="grid gap-4">
          {songs.slice(0, 6).map((song) => (
            <SongCard key={song.number} song={song} />
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-ink-200 bg-ink-50 p-6 text-sm text-ink-600">
          No matches yet. Try a song number, a first line, or a theme like devotion or morning meditation.
        </div>
      )}
    </div>
  )
}
