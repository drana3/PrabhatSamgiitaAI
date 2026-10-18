import type { MockSong } from "@/data/mock"
import { fetchSongDetailCached, peekSongDetail, prefetchNotation, rememberSongDetail } from "@/lib/songCache"
import {
  parseSongNumber,
  songDetailToMockSong,
  songPlaceholder,
  songSummaryToMockSong,
} from "@/lib/songMap"

export {
  parseSongNumber,
  songDetailToMockSong,
  songSummaryToMockSong,
} from "@/lib/songMap"

export type ResolvedSongBundle = {
  song: MockSong
  related: MockSong[]
}

const previewByNumber = new Map<number, MockSong>()

export function rememberSongPreview(song: MockSong) {
  previewByNumber.set(song.number, song)
}

function bundleFromPreview(number: number): ResolvedSongBundle | null {
  const song = previewByNumber.get(number)
  if (!song) return null
  return { song, related: [] }
}

/** Instant shell from a remembered search row or prior detail cache. */
export function instantSongBundle(songId: string | undefined): ResolvedSongBundle | null {
  const number = parseSongNumber(songId)
  if (!number) return null
  const peeked = peekResolvedSong(songId)
  if (peeked) return peeked
  const preview = bundleFromPreview(number)
  if (preview) return preview
  return { song: songPlaceholder(number), related: [] }
}

function resolveSongId(songId: string | string[] | undefined): string | undefined {
  if (typeof songId === "string") return songId
  if (Array.isArray(songId) && typeof songId[0] === "string") return songId[0]
  return undefined
}

/** Live catalog with preview/cache fallbacks. Cached for instant revisits. */
export async function resolveSongBundle(
  songId: string | string[] | undefined,
): Promise<ResolvedSongBundle | null> {
  const id = resolveSongId(songId)
  const number = parseSongNumber(id)
  if (!number) return null

  const instant = instantSongBundle(id)
  const detail = await fetchSongDetailCached(number)
  if (!detail) return instant
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
