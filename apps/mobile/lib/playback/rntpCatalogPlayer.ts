import type { Track } from "react-native-track-player"

import type { CatalogTrack } from "@/lib/playback/catalogTrack"
import { getTrackPlayer, loadTrackPlayerModule } from "@/lib/playback/trackPlayerBridge"

let setupPromise: Promise<void> | null = null
let listenersHooked = false

type ListenerInstaller = () => void

let installNativeListenersHook: ListenerInstaller | null = null

export function registerNativePlayerListeners(install: ListenerInstaller): void {
  installNativeListenersHook = install
}

function ensureNativeListenersInstalled(): void {
  if (listenersHooked || !installNativeListenersHook) return
  listenersHooked = true
  installNativeListenersHook()
}

export async function setupNativeCatalogPlayer(): Promise<void> {
  ensureNativeListenersInstalled()
  if (setupPromise) return setupPromise
  setupPromise = (async () => {
    const TrackPlayer = getTrackPlayer()
    const { AppKilledPlaybackBehavior, Capability } = loadTrackPlayerModule()
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
      notificationCapabilities: [Capability.Play, Capability.Pause, Capability.SkipToNext],
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
  await getTrackPlayer().reset()
}

export async function playTrackNow(track: CatalogTrack): Promise<void> {
  await setupNativeCatalogPlayer()
  const TrackPlayer = getTrackPlayer()
  await TrackPlayer.reset()
  await TrackPlayer.add(track as Track)
  await TrackPlayer.play()
}

export async function enqueueTrack(track: CatalogTrack): Promise<void> {
  await setupNativeCatalogPlayer()
  await getTrackPlayer().add(track as Track)
}

export async function nativePlay(): Promise<void> {
  await setupNativeCatalogPlayer()
  await getTrackPlayer().play()
}

export async function nativePause(): Promise<void> {
  await getTrackPlayer().pause()
}

export async function nativeStop(): Promise<void> {
  const TrackPlayer = getTrackPlayer()
  try {
    await TrackPlayer.stop()
  } catch {
    /* ignore */
  }
  await TrackPlayer.reset()
}

export async function nativeSeek(seconds: number): Promise<void> {
  await getTrackPlayer().seekTo(Math.max(0, seconds))
}

export async function nativeSetVolume(volume: number): Promise<void> {
  await getTrackPlayer().setVolume(Math.min(1, Math.max(0, volume)))
}

export async function nativeSkipToNext(): Promise<void> {
  await getTrackPlayer().skipToNext()
}

export async function nativeSkipToPrevious(): Promise<void> {
  await getTrackPlayer().skipToPrevious()
}

export async function nativeSetRepeatTrack(loopCurrent: boolean): Promise<void> {
  const { RepeatMode } = loadTrackPlayerModule()
  await getTrackPlayer().setRepeatMode(loopCurrent ? RepeatMode.Track : RepeatMode.Off)
}

export async function nativeQueueLengthPastIndex(): Promise<number> {
  const TrackPlayer = getTrackPlayer()
  const queue = await TrackPlayer.getQueue()
  const index = await TrackPlayer.getActiveTrackIndex()
  if (index == null) return 0
  return Math.max(0, queue.length - 1 - index)
}

export async function nativeRemoveUpcomingTracks(): Promise<void> {
  try {
    await getTrackPlayer().removeUpcomingTracks()
  } catch {
    /* ignore */
  }
}

export function getActiveCatalogTrackNumber(): number | null {
  return null
}
