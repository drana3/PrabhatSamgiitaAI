import Link from "next/link"

import type { SongSummary } from "@/lib/api"

export function SongCard({ song }: { song: SongSummary }) {
  return (
    <Link
      href={`/songs/${song.number}`}
      className="group rounded-3xl border border-ink-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-glow"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-ember-700">Song {song.number}</p>
          <h3 className="mt-2 font-serif text-2xl text-ink-900">{song.title}</h3>
          {song.first_line ? <p className="mt-3 text-sm leading-6 text-ink-700">{song.first_line}</p> : null}
        </div>
        <span className="rounded-full border border-ink-200 px-3 py-1 text-xs text-ink-600">
          {song.is_verified ? "Verified" : "Pending"}
        </span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs text-ink-600">
        {song.theme ? <span className="rounded-full bg-ink-50 px-3 py-1">{song.theme}</span> : null}
        {song.mood ? <span className="rounded-full bg-ink-50 px-3 py-1">{song.mood}</span> : null}
        {song.language ? <span className="rounded-full bg-ink-50 px-3 py-1">{song.language}</span> : null}
      </div>
    </Link>
  )
}
