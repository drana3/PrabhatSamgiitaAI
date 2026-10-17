import type { MockSong } from "@/data/mock"
import { api } from "@/lib/client"
import { resolvePlaybackUri } from "@/lib/offlineAudio"
import { nextPlayableInQueue, randomPlayableSongNumber } from "@/lib/playableAudio"
import { playlistStep } from "@/lib/playbackQueue"
import { songDetailToMockSong } from "@/lib/songMap"
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

export async function hydratePlayableSong(number: number, seed?: MockSong | null): Promise<MockSong | null> {
  let song = seed ?? null
  if (!song?.audioUrl?.trim()) {
    const detail = await api.fetchSong(number)
    if (!detail) return song?.audioUrl?.trim() ? song : null
    song = song ? { ...song, ...songDetailToMockSong(detail), mediaHydrated: true } : songDetailToMockSong(detail)
  }
  const resolved = await resolvePlaybackUri(number, song.audioUrl)
  const uri = resolved?.uri || song.audioUrl?.trim()
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
