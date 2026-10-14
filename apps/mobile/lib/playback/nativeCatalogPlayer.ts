import TrackPlayer, {
  AppKilledPlaybackBehavior,
  Capability,
  RepeatMode,
  type Track,
} from "react-native-track-player"

import type { MockSong } from "@/data/mock"

let setupPromise: Promise<void> | null = null

export function songToTrack(song: MockSong, url: string): Track {
  return {
    id: `ps-${song.number}`,
    url,
    title: song.title,
    artist: song.performer || "Prabhat Samgiita",
    artwork: song.imageUrl || song.thumbnailUrl || undefined,
    duration: song.durationSeconds,
  }
}

export function trackIdToSongNumber(id: string | undefined | null): number | null {
  if (!id) return null
  const match = /^ps-(\d+)$/i.exec(id)
  if (!match) return null
  const n = Number(match[1])
  return Number.isFinite(n) && n > 0 ? n : null
}

export async function setupNativeCatalogPlayer(): Promise<void> {
  if (setupPromise) return setupPromise
  setupPromise = (async () => {
    try {
      await TrackPlayer.setupPlayer({ autoHandleInterruptions: true })
    } catch {
      /* already initialized */
    }
    await TrackPlayer.updateOptions({
      capabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SkipToNext,
        Capability.SkipToPrevious,
        Capability.SeekTo,
        Capability.Stop,
      ],
      compactCapabilities: [Capability.Play, Capability.Pause, Capability.SkipToNext],
      progressUpdateEventInterval: 1,
      android: {
        appKilledPlaybackBehavior: AppKilledPlaybackBehavior.ContinuePlayback,
      },
    })
  })()
  return setupPromise
}

export async function resetNativeCatalog(): Promise<void> {
  await setupNativeCatalogPlayer()
  await TrackPlayer.reset()
}

export async function playTrackNow(track: Track): Promise<void> {
  await setupNativeCatalogPlayer()
  await TrackPlayer.reset()
  await TrackPlayer.add(track)
  await TrackPlayer.play()
}

export async function enqueueTrack(track: Track): Promise<void> {
  await setupNativeCatalogPlayer()
  await TrackPlayer.add(track)
}

export async function nativePlay(): Promise<void> {
  await setupNativeCatalogPlayer()
  await TrackPlayer.play()
}

export async function nativePause(): Promise<void> {
  await TrackPlayer.pause()
}

export async function nativeStop(): Promise<void> {
  try {
    await TrackPlayer.stop()
  } catch {
    /* ignore */
  }
  await TrackPlayer.reset()
}

export async function nativeSeek(seconds: number): Promise<void> {
  await TrackPlayer.seekTo(Math.max(0, seconds))
}

export async function nativeSetVolume(volume: number): Promise<void> {
  await TrackPlayer.setVolume(Math.min(1, Math.max(0, volume)))
}

export async function nativeSkipToNext(): Promise<void> {
  await TrackPlayer.skipToNext()
}

export async function nativeSkipToPrevious(): Promise<void> {
  await TrackPlayer.skipToPrevious()
}

export async function nativeSetRepeatTrack(loopCurrent: boolean): Promise<void> {
  await TrackPlayer.setRepeatMode(loopCurrent ? RepeatMode.Track : RepeatMode.Off)
}

export async function nativeQueueLengthPastIndex(): Promise<number> {
  const queue = await TrackPlayer.getQueue()
  const index = await TrackPlayer.getActiveTrackIndex()
  if (index == null) return 0
  return Math.max(0, queue.length - 1 - index)
}

/** Drop prefetched tracks so a bounded playlist cannot wrap to the first song. */
export async function nativeRemoveUpcomingTracks(): Promise<void> {
  try {
    await TrackPlayer.removeUpcomingTracks()
  } catch {
    /* ignore */
  }
}
