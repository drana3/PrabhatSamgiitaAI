import Link from "next/link"

import { adjacentCatalogSongNumber } from "@prabhat/core"

import { songPagePath } from "@/lib/song-path"

export function SongCatalogNav({ number }: { number: number }) {
  const previous = adjacentCatalogSongNumber(number, -1)
  const next = adjacentCatalogSongNumber(number, 1)
  if (!previous && !next) return null

  return (
    <nav
      aria-label="Catalog navigation"
      className="mt-3 flex items-center justify-between gap-3 text-sm font-semibold text-navy-900"
    >
      {previous ? (
        <Link
          href={songPagePath(previous)}
          className="min-w-0 rounded-full border border-navy-900/10 bg-white px-3 py-2 shadow-sm transition hover:border-gold-500 hover:text-gold-800"
        >
          ← PS {previous}
        </Link>
      ) : (
        <span className="invisible rounded-full px-3 py-2" aria-hidden>
          ←
        </span>
      )}
      {next ? (
        <Link
          href={songPagePath(next)}
          className="min-w-0 rounded-full border border-navy-900/10 bg-white px-3 py-2 text-right shadow-sm transition hover:border-gold-500 hover:text-gold-800"
        >
          PS {next} →
        </Link>
      ) : (
        <span className="invisible rounded-full px-3 py-2" aria-hidden>
          →
        </span>
      )}
    </nav>
  )
}