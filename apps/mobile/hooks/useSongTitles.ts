import { useMemo } from "react"

import { catalogSongsByNumbers } from "@/lib/lyricSearch"
import { songTitleFromHit } from "@/lib/mineView"

/** Catalog titles for a list of song numbers. */
export function useSongTitles(numbers: readonly number[]): Map<number, string> {
  const key = numbers.join(",")
  return useMemo(() => {
    const list = key ? key.split(",").map(Number) : []
    const hits = new Map(
      catalogSongsByNumbers(list, list.length).map((hit) => [hit.number, hit] as const),
    )
    return new Map(list.map((n: number) => [n, songTitleFromHit(hits.get(n), n)] as const))
  }, [key])
}
