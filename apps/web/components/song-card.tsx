import Link from "next/link"

import type { SongSummary } from "@/lib/api"

export function SongCard({ song }: { song: SongSummary }) {
  return (
    <Link
      href={`/songs/${song.number}`}
      className="group relative overflow-hidden rounded-3xl border border-ink-200 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-ember-300 hover:shadow-glow"
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-ember-400 via-amber-200 to-ink-400 opacity-80" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-ember-700">Song {song.number}</p>
          <h3 className="mt-2 font-serif text-2xl text-ink-900 transition group-hover:text-ink-950">{song.title}</h3>
          {song.first_line ? <p className="mt-3 text-sm leading-6 text-ink-700">{song.first_line}</p> : null}
        </div>
        <span className="rounded-full border border-ink-200 bg-ink-50 px-3 py-1 text-xs font-semibold text-ink-600">
          {song.is_verified ? "Verified" : "Pending"}
        </span>
      </div>
      {(song.occasion || song.difficulty) ? (
        <p className="mt-3 text-xs uppercase tracking-[0.25em] text-ink-500">
          {[song.occasion, song.difficulty].filter(Boolean).join(" · ")}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2 text-xs text-ink-600">
        {song.theme ? <span className="rounded-full bg-ink-50 px-3 py-1">{song.theme}</span> : null}
        {song.mood ? <span className="rounded-full bg-ink-50 px-3 py-1">{song.mood}</span> : null}
        {song.language ? <span className="rounded-full bg-ink-50 px-3 py-1">{song.language}</span> : null}
      </div>
      <div className="mt-5 flex items-center justify-between border-t border-ink-100 pt-4 text-[11px] uppercase tracking-[0.3em] text-ink-500">
        <span>Open song</span>
        <span className="transition group-hover:translate-x-1">→</span>
      </div>
    </Link>
  )
}
