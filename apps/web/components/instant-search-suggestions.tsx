"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"

import { feelingSearchAllowed } from "@prabhat/core"

import { instantExploreSongs } from "@/lib/lyric-search"
import { useSearchAuth } from "@/lib/feeling-search"
import { songPagePath } from "@/lib/song-path"

const SUGGEST_DEBOUNCE_MS = 180

export function InstantSearchSuggestions({
  query,
  id = "instant-search-suggestions",
}: {
  query: string
  id?: string
}) {
  const searchAuth = useSearchAuth()
  const [debouncedQuery, setDebouncedQuery] = useState(query)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), SUGGEST_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [query])

  const songs = useMemo(() => {
    // Feeling search uses meaning search only — no lyric/number suggestion dropdown.
    if (feelingSearchAllowed(searchAuth)) return []
    const trimmed = debouncedQuery.trim()
    if (!trimmed) return []
    if (trimmed.length < 3 && !/^\d+$/.test(trimmed)) return []
    return instantExploreSongs(trimmed, undefined, searchAuth) ?? []
  }, [debouncedQuery, searchAuth])

  if (!songs.length) return null

  return (
    <ul
      id={id}
      role="listbox"
      aria-label="Song suggestions"
      className="absolute left-0 right-0 top-2 z-30 max-h-72 overflow-auto rounded-2xl border border-navy-900/10 bg-white py-2 shadow-lg"
    >
      {songs.map((song) => (
        <li key={song.number} role="option" aria-selected="false">
          <Link
            href={songPagePath(song.number)}
            className="flex items-start gap-3 px-4 py-2.5 text-left transition hover:bg-gold-50"
          >
            <span className="mt-0.5 shrink-0 text-[11px] font-bold uppercase tracking-[0.12em] text-gold-700">
              PS {song.number}
            </span>
            <span className="min-w-0">
              <span className="block font-serif text-base leading-snug text-navy-950">
                {titleCase(song.title)}
              </span>
              {song.first_line && song.first_line.trim().toLocaleLowerCase() !== song.title.trim().toLocaleLowerCase() ? (
                <span className="mt-0.5 block truncate text-xs text-stone-600">{song.first_line}</span>
              ) : null}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

function titleCase(value: string) {
  return value.toLocaleLowerCase().replace(/(^|[\s'’-])\p{L}/gu, (letter) => letter.toLocaleUpperCase())
}
