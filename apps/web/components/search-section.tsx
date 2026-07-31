"use client"

import { useState } from "react"

import { SearchForm } from "@/components/search-form"
import { SongCard } from "@/components/song-card"
import type { SongSummary } from "@/lib/api"

export function SearchSection({ initialSongs }: { initialSongs: SongSummary[] }) {
  const [songs, setSongs] = useState(initialSongs)

  return (
    <div className="space-y-5 rounded-[2rem] border border-ink-200 bg-white p-5 shadow-glow md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-ember-700">Search</p>
          <h2 className="mt-2 font-serif text-3xl text-ink-900">Find a song fast</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-ink-600">
            Search by song number, a remembered opening line, a devotional theme, or a line of meaning.
          </p>
        </div>
        <div className="rounded-full border border-ink-200 bg-ink-50 px-3 py-2 text-xs uppercase tracking-[0.25em] text-ink-500">
          {songs.length} results loaded
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {["Song 1", "Bandhu He", "Morning meditation"].map((hint) => (
          <span
            key={hint}
            className="rounded-full border border-ink-200 bg-ink-50 px-3 py-1 text-xs font-medium text-ink-600"
          >
            {hint}
          </span>
        ))}
      </div>
      <SearchForm onResults={setSongs} />
      {songs.length > 0 ? (
        <div className="grid gap-4">
          {songs.slice(0, 6).map((song) => (
            <SongCard key={song.number} song={song} />
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-ink-200 bg-gradient-to-br from-ink-50 to-white p-6 text-sm leading-6 text-ink-600">
          No matches yet. Try a song number, a first line, or a theme like devotion or morning meditation.
        </div>
      )}
    </div>
  )
}
