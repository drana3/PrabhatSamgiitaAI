import { PS_SONG_COUNT } from "@/lib/learn/learnSongs"

/**
 * The song number a `/song-v2/<id>` address names, or null when no such song exists. The catalogue holds the
 * numbers 1 to PS_SONG_COUNT; `ps-0`, `ps-5019`, `ps-abc`, `12345`, `1.5` and an empty id are all "no such song",
 * so the page can say so honestly instead of drawing a song that has no lyrics and no data behind it.
 * Accepts `ps-12`, `PS-12` and the bare `12` (old links).
 */
export function songRouteNumber(songId: string | undefined | null): number | null {
  const match = /^(?:ps-)?(\d{1,6})$/i.exec((songId ?? "").trim())
  if (!match) return null
  const number = Number(match[1])
  return Number.isInteger(number) && number >= 1 && number <= PS_SONG_COUNT ? number : null
}
