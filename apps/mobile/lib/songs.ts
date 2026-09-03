import type { MockSong } from "@/data/mock"
import { fetchSongDetailCached, peekSongDetail, prefetchNotation, rememberSongDetail } from "@/lib/songCache"
import { parseSongNumber, songDetailToMockSong, songSummaryToMockSong } from "@/lib/songMap"

export {
  parseSongNumber,
  songDetailToMockSong,
  songSummaryToMockSong,
} from "@/lib/songMap"

export type ResolvedSongBundle = {
  song: MockSong
  related: MockSong[]
}

/** Live catalog only — no mock song fallbacks. Cached for instant revisits. */
export async function resolveSongBundle(songId: string | undefined): Promise<ResolvedSongBundle | null> {
  const number = parseSongNumber(songId)
  if (!number) return null

  const detail = await fetchSongDetailCached(number)
  if (!detail) return null
  rememberSongDetail(detail)
  prefetchNotation(number, "C")

  return {
    song: songDetailToMockSong(detail),
    related: detail.related_songs.map((item, index) => songSummaryToMockSong(item, index)),
  }
}

/** Instant shell when this song was already loaded in this session. */
export function peekResolvedSong(songId: string | undefined): ResolvedSongBundle | null {
  const number = parseSongNumber(songId)
  if (!number) return null
  const detail = peekSongDetail(number)
  if (!detail) return null
  return {
    song: songDetailToMockSong(detail),
    related: detail.related_songs.map((item, index) => songSummaryToMockSong(item, index)),
  }
}

export async function resolveSong(songId: string | undefined): Promise<MockSong | null> {
  const bundle = await resolveSongBundle(songId)
  return bundle?.song ?? null
}
