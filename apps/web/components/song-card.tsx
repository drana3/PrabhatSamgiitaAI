import Link from "next/link"

import type { SongSummary } from "@/lib/api"
import { songPagePath } from "@/lib/song-path"

export function SongCard({ song, index = 0 }: { song: SongSummary; index?: number }) {
  const swatches = ["from-amber-100 to-orange-50", "from-sky-100 to-ivory-50", "from-emerald-100 to-ivory-50"]
  return (
    <Link href={songPagePath(song.number)} className="group surface-card overflow-hidden transition duration-300 hover:-translate-y-1 hover:border-gold-500/50 hover:shadow-xl">
      <div className={`h-2 bg-gradient-to-r ${swatches[index % swatches.length]}`} />
      <div className="p-5">
        <div className="flex items-start gap-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-gold-500/30 bg-gold-50 font-serif text-lg font-bold text-gold-700">{song.number}</span>
          <div className="min-w-0 flex-1">
            <h3 className="font-serif text-xl font-semibold leading-snug text-navy-950 group-hover:text-gold-700">{titleCase(song.title)}</h3>
            {song.first_line ? <p className="mt-2 line-clamp-2 text-sm leading-6 text-stone-600">{titleCase(song.first_line)}</p> : null}
          </div>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-navy-900/15 text-xs text-navy-950 transition group-hover:border-gold-600 group-hover:bg-gold-600 group-hover:text-white">▶</span>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-navy-900/8 pt-4 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-stone-500">
          <span>{song.theme || song.mood || "Devotion"}</span>
          <span className="text-gold-500">•</span>
          <span>{song.language || "Roman"}</span>
          {song.is_verified ? <span className="ml-auto text-emerald-700">✓ Source verified</span> : null}
        </div>
      </div>
    </Link>
  )
}

function titleCase(value: string) {
  return value.toLocaleLowerCase().replace(/(^|[\s'’-])\p{L}/gu, (letter) => letter.toLocaleUpperCase())
}
