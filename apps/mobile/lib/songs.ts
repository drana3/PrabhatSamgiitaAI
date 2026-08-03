import type { MockSong } from "@/data/mock"
import { api } from "@/lib/client"
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

/** Live catalog only — no mock song fallbacks. */
export async function resolveSongBundle(songId: string | undefined): Promise<ResolvedSongBundle | null> {
  const number = parseSongNumber(songId)
  if (!number) return null

  const detail = await api.fetchSong(number)
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
