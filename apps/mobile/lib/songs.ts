import { bookletHarmoniumSong, hasPublishedLearnerSargam } from "@prabhat/core"
import type { MockSong } from "@/data/mock"
import { catalogHitByNumber } from "@/lib/lyricSearch"
import { fetchSongDetailCached, peekSongDetail, prefetchNotation, rememberSongDetail } from "@/lib/songCache"
import { parseSongNumber, songDetailToMockSong, songPlaceholder, songSummaryToMockSong } from "@/lib/songMap"
import { usePreferencesStore } from "@/stores/preferencesStore"

export {
  parseSongNumber,
  songDetailToMockSong,
  songPlaceholder,
  songRouteId,
  songSummaryToMockSong,
} from "@/lib/songMap"

export type ResolvedSongBundle = {
  song: MockSong
  related: MockSong[]
}

const previewCache = new Map<number, MockSong>()

function mapSongDetail(detail: Parameters<typeof songDetailToMockSong>[0]) {
  return songDetailToMockSong(
    detail,
    usePreferencesStore.getState().preferredAudioBySong?.[`ps-${detail.number}`],
  )
}

function bundleFromDetail(number: number): ResolvedSongBundle | null {
  const detail = peekSongDetail(number)
  if (!detail) return null
  return {
    song: mapSongDetail(detail),
    related: detail.related_songs.map((item, index) => songSummaryToMockSong(item, index)),
  }
}

function bundleFromCatalog(number: number): ResolvedSongBundle {
  const preview = previewCache.get(number)
  if (preview) return { song: preview, related: [] }
  const hit = catalogHitByNumber(number)
  return {
    song: songPlaceholder(number, {
      title: hit?.title,
      originalTitle: hit?.firstLine || undefined,
      shortDescription: hit?.firstLine || hit?.title,
      lyrics: hit?.firstLine || hit?.title,
    }),
    related: [],
  }
}

/** Remember the search/list row so the song page paints that title on the first frame. */
export function rememberSongPreview(song: MockSong) {
  if (!song.number) return
  previewCache.set(song.number, song)
}

/** Instant shell from detail cache, the tapped row, or the bundled catalog. */
export function instantSongBundle(songId: string | string[] | undefined): ResolvedSongBundle | null {
  const number = parseSongNumber(songId)
  if (!number) return null
  return bundleFromDetail(number) ?? bundleFromCatalog(number)
}

/** Live catalog only — no mock song fallbacks. Cached for instant revisits. */
export async function resolveSongBundle(
  songId: string | string[] | undefined,
): Promise<ResolvedSongBundle | null> {
  const number = parseSongNumber(songId)
  if (!number) return null

  const detail = await fetchSongDetailCached(number)
  if (!detail) return instantSongBundle(songId)
  rememberSongDetail(detail)
  if (
    hasPublishedLearnerSargam(number, detail.notation_verification_status, detail.notation_enabled) &&
    !bookletHarmoniumSong(number)
  ) {
    prefetchNotation(number, "C")
  }

  return {
    song: mapSongDetail(detail),
    related: detail.related_songs.map((item, index) => songSummaryToMockSong(item, index)),
  }
}

/** Start the song-detail fetch before navigation so the page can peek a cache hit. */
export function prefetchSong(songId: string | number | undefined, preview?: MockSong) {
  const number = typeof songId === "number" ? songId : parseSongNumber(songId)
  if (!number) return
  if (preview) rememberSongPreview(preview)
  void resolveSongBundle(`ps-${number}`)
}

/** Instant shell when this song was already loaded in this session. */
export function peekResolvedSong(songId: string | string[] | undefined): ResolvedSongBundle | null {
  const number = parseSongNumber(songId)
  if (!number) return null
  return bundleFromDetail(number)
}

export async function resolveSong(songId: string | undefined): Promise<MockSong | null> {
  const bundle = await resolveSongBundle(songId)
  return bundle?.song ?? null
}
