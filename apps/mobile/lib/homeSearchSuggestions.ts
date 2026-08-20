import { planSearch, type SearchAuth } from "@prabhat/core"

import type { MockSong } from "@/data/mock"
import { seedCategoryForQuery, songNumbersForCategory } from "@/lib/categorySongs"
import {
  catalogSongByNumber,
  catalogSongsByNumbers,
  searchCatalogLyrics,
  type LyricSearchHit,
} from "@/lib/lyricSearch"
import { songSummaryToMockSong } from "@/lib/songMap"

function hitsToSongs(hits: LyricSearchHit[]): MockSong[] {
  return hits.map((hit, index) =>
    songSummaryToMockSong(
      {
        number: hit.number,
        title: hit.title || hit.firstLine,
        first_line: hit.snippet || hit.firstLine || hit.title,
        is_verified: true,
      },
      index,
    ),
  )
}

const DEFAULT_AUTH: SearchAuth = { signedIn: false, feelingSearchEnabled: false }

/** Local, instant home-hero suggestions — same planner as Explore. */
export function homeSearchSuggestions(
  query: string,
  limit = 5,
  auth: SearchAuth = DEFAULT_AUTH,
): MockSong[] {
  const trimmed = query.trim()
  if (!trimmed) return []

  const numbered = catalogSongByNumber(trimmed)
  if (numbered) return hitsToSongs([numbered])

  const plan = planSearch(trimmed, auth)
  if (plan.layer === "semantic") return []
  if (plan.layer === "mood" && plan.moodId) {
    return hitsToSongs(catalogSongsByNumbers(songNumbersForCategory(plan.moodId), limit))
  }

  const seedId = seedCategoryForQuery(trimmed)
  if (seedId) {
    const fromCollection = catalogSongsByNumbers(songNumbersForCategory(seedId), limit)
    if (fromCollection.length) return hitsToSongs(fromCollection)
  }

  return hitsToSongs(searchCatalogLyrics(trimmed, limit, { interpret: true }))
}
