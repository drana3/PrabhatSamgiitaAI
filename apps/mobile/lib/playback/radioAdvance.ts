import { holdUpcomingTrack } from "@/lib/playback/trackEndHook"
import type { MockSong } from "@/data/mock"
import { api } from "@/lib/client"
import { resolvePlaybackUri } from "@/lib/offlineAudio"
import { nextPlayableInQueue, randomPlayableSongNumber } from "@/lib/playableAudio"
import { playlistStep } from "@/lib/playbackQueue"
import { isKiirtanNumber, kiirtanSongForNumber } from "@/lib/kirtan/track"
import { songDetailToMockSong, songSummaryToMockSong } from "@/lib/songMap"
import { cacheCatalogSong } from "@/lib/playback/catalogSongCache"
import {
  enqueueTrack,
  nativeQueueLengthPastIndex,
  nativeRemoveUpcomingTracks,
  songToTrack,
  trackIdToSongNumber,
} from "@/lib/playback/nativeCatalogPlayer"
import { getActiveCatalogTrackNumber } from "@/lib/playback/nativeCatalogPlayer"
import { getRadioSession } from "@/lib/playback/radioSession"
import { getTrackPlayer, isTrackPlayerLinked } from "@/lib/playback/trackPlayerBridge"

let advancing = false

export function resetRadioAdvance(): void {
  advancing = false
}

function isRemoteStreamUrl(url: string | null | undefined): boolean {
  return Boolean(url?.trim() && /^https?:\/\//i.test(url.trim()))
}

/**
 * Resolve a playable URI for a song.
 * Offline-first: saved in-app copies play without hitting the network (Saved tab
 * rows often have no audioUrl until a detail fetch — that must not block offline).
 */
export async function hydratePlayableSong(number: number, seed?: MockSong | null): Promise<MockSong | null> {
  return (await hydratePlayableSongOutcome(number, seed)).song
}

/**
 * The same, and when there is no song it says whether the connection was the reason
 * (the catalog request failed) or the song simply has no audio.
 */
export async function hydratePlayableSongOutcome(
  number: number,
  seed?: MockSong | null,
): Promise<{ song: MockSong | null; fetchFailed: boolean }> {
  // A Kiirtan is a plain audio file: no catalog fetch, no offline copy lookup.
  if (isKiirtanNumber(number)) {
    const kiirtan = seed ?? kiirtanSongForNumber(number)
    return { song: kiirtan?.audioUrl?.trim() ? kiirtan : null, fetchFailed: false }
  }
  let song = seed ?? null
  let fetchFailed = false

  const offline = await resolvePlaybackUri(number, song?.audioUrl)
  if (offline?.local) {
    const base =
      song ??
      songSummaryToMockSong({
        number,
        title: `Prabhat Samgiita ${number}`,
        is_verified: false,
      })
    return { song: { ...base, audioUrl: offline.uri, mediaHydrated: true }, fetchFailed }
  }

  if (!isRemoteStreamUrl(song?.audioUrl)) {
    try {
      const detail = await api.fetchSong(number)
      if (detail) {
        song = song
          ? { ...song, ...songDetailToMockSong(detail), mediaHydrated: true }
          : songDetailToMockSong(detail)
      }
    } catch {
      /* offline / timeout: may still stream if the seed already had https */
      fetchFailed = true
    }
  }

  if (!song) return { song: null, fetchFailed }

  const resolved = await resolvePlaybackUri(number, song.audioUrl)
  const uri =
    resolved?.uri ||
    (isRemoteStreamUrl(song.audioUrl) ? song.audioUrl!.trim() : null)
  if (!uri) return { song: null, fetchFailed }
  return { song: { ...song, audioUrl: uri, mediaHydrated: true }, fetchFailed }
}

/**
 * Keep one upcoming native track so overnight radio never hits a silent JS gap.
 * The "busy" flag is taken before the first await: two events arriving together (track change and
 * queue end, the service and the store) must not each add a next song.
 */
export async function ensureUpcomingRadioTrack(): Promise<void> {
  if (!isTrackPlayerLinked()) return
  if (advancing) return
  if (holdUpcomingTrack()) return
  const session = getRadioSession()
  if (session.kind === "casual") return
  if (session.driveRepeat || session.repeat) return

  advancing = true
  try {
    await enqueueNextRadioTrack(session)
  } catch {
    /* next event will retry */
  } finally {
    advancing = false
  }
}

async function enqueueNextRadioTrack(session: ReturnType<typeof getRadioSession>): Promise<void> {
  const remaining = await nativeQueueLengthPastIndex()
  if (remaining >= 1) return

  const active = await getTrackPlayer().getActiveTrack()
  const current =
    session.currentNumber ??
    getActiveCatalogTrackNumber() ??
    trackIdToSongNumber(typeof active?.id === "string" ? active.id : null)
  if (!current) return

  let nextNumber: number | null = null
  if (session.kind === "drive-random") {
    nextNumber = randomPlayableSongNumber(current)
  } else if (session.kind === "playlist" || session.kind === "drive-playlist") {
    const bounds = session.playlistBounds
    if (!bounds?.length) return
    nextNumber = nextPlayableInQueue(bounds, current, 1) ?? playlistStep(current, bounds, 1)
    if (nextNumber == null) {
      await nativeRemoveUpcomingTracks()
      return
    }
  } else if (session.playlistBounds?.length) {
    nextNumber =
      nextPlayableInQueue(session.playlistBounds, current, 1) ??
      playlistStep(current, session.playlistBounds, 1)
  }
  if (nextNumber == null) return
  const song = await hydratePlayableSong(nextNumber)
  if (!song?.audioUrl) return
  cacheCatalogSong(song)
  // The native queue may have grown while the song was fetched: add only when still empty.
  if ((await nativeQueueLengthPastIndex()) >= 1) return
  await enqueueTrack(songToTrack(song, song.audioUrl))
}
