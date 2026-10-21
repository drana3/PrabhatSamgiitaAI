import type { MockSong } from "@/data/mock"
import { api } from "@/lib/client"
import { resolvePlaybackUri } from "@/lib/offlineAudio"
import { nextPlayableInQueue, randomPlayableSongNumber } from "@/lib/playableAudio"
import { playlistStep } from "@/lib/playbackQueue"
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
  let song = seed ?? null

  const offline = await resolvePlaybackUri(number, song?.audioUrl)
  if (offline?.local) {
    const base =
      song ??
      songSummaryToMockSong({
        number,
        title: `Prabhat Samgiita ${number}`,
        is_verified: false,
      })
    return { ...base, audioUrl: offline.uri, mediaHydrated: true }
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
      /* offline / timeout — may still stream if seed already had https */
    }
  }

  if (!song) return null

  const resolved = await resolvePlaybackUri(number, song.audioUrl)
  const uri =
    resolved?.uri ||
    (isRemoteStreamUrl(song.audioUrl) ? song.audioUrl!.trim() : null)
  if (!uri) return null
  return { ...song, audioUrl: uri, mediaHydrated: true }
}

/** Keep one upcoming native track so overnight radio never hits a silent JS gap. */
export async function ensureUpcomingRadioTrack(): Promise<void> {
  if (!isTrackPlayerLinked()) return
  if (advancing) return
  const session = getRadioSession()
  if (session.kind === "casual") return
  if (session.driveRepeat || session.repeat) return

  const remaining = await nativeQueueLengthPastIndex()
  if (remaining >= 1) return

  const active = isTrackPlayerLinked() ? await getTrackPlayer().getActiveTrack() : null
  const current =
    session.currentNumber ??
    getActiveCatalogTrackNumber() ??
    trackIdToSongNumber(typeof active?.id === "string" ? active.id : null)
  if (!current) return

  advancing = true
  try {
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
    await enqueueTrack(songToTrack(song, song.audioUrl))
  } catch {
    /* next event will retry */
  } finally {
    advancing = false
  }
}
