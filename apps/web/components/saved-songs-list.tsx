"use client"

import Link from "next/link"
import { useState } from "react"

import type { SongSummary } from "@/lib/api"
import { songsByNumbers } from "@/lib/lyric-search"
import { removeFavoriteSong } from "@/lib/member"
import { songPagePath } from "@/lib/song-path"

export function SavedSongsList({
  songNumbers,
  onChange,
}: {
  songNumbers: number[]
  onChange: () => Promise<void>
}) {
  const songs: SongSummary[] = songsByNumbers(songNumbers)
  const [pending, setPending] = useState<number | null>(null)

  async function remove(number: number) {
    setPending(number)
    const updated = await removeFavoriteSong(number)
    setPending(null)
    if (!updated) return
    await onChange()
  }

  if (!songNumbers.length) {
    return (
      <p className="mt-3 text-sm leading-6 text-stone-600">
        No saved songs yet. Open any song and tap <strong>Save song</strong> to build your playlist.
      </p>
    )
  }

  return (
    <ul className="mt-4 space-y-3">
      {songs.map((song) => (
        <li key={song.number} className="flex items-center gap-3 rounded-2xl border border-navy-900/10 bg-ivory-50 px-4 py-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-navy-950 font-serif text-sm text-white">{song.number}</span>
          <div className="min-w-0 flex-1">
            <Link href={songPagePath(song.number)} className="block truncate font-serif text-lg font-semibold text-navy-950 hover:text-gold-700">
              {titleCase(song.title)}
            </Link>
            {song.first_line ? <p className="truncate text-xs text-stone-500">{titleCase(song.first_line)}</p> : null}
          </div>
          <button
            type="button"
            aria-label={`Remove song ${song.number} from playlist`}
            disabled={pending === song.number}
            onClick={() => void remove(song.number)}
            className="rounded-full border border-navy-900/10 px-3 py-1.5 text-xs font-semibold text-stone-600 transition hover:border-red-300 hover:text-red-700 disabled:opacity-60"
          >
            Remove
          </button>
        </li>
      ))}
    </ul>
  )
}

function titleCase(value: string) {
  return value.toLocaleLowerCase().replace(/(^|[\s'’-])\p{L}/gu, (letter) => letter.toLocaleUpperCase())
}
