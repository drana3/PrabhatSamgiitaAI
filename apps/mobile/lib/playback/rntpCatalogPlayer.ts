import type { Track } from "react-native-track-player"

import { toPlayableLocalUri } from "@/lib/offlineAudio"
import type { CatalogTrack } from "@/lib/playback/catalogTrack"
import { attachLevelingListeners, levelNoteUpcoming, levelReset, levelSetUserVolume, levelStartTrack } from "@/lib/playback/levelingBridge"
import { pitchChoiceFor, pitchEnumValue } from "@/lib/playback/pitchAlgorithm"
import { SPEED_MAX, SPEED_MIN } from "@/lib/playerV2/playbackSpeed"
import { usePlaybackPrefsStore } from "@/stores/playbackPrefsStore"
import { getTrackPlayer, loadTrackPlayerModule } from "@/lib/playback/trackPlayerBridge"

/** The photograph the design shows on the lock screen (SysIosLock), used when a song has no artwork of its own. */
function defaultArtwork(): string | undefined {
  try {
    // Lazy: this module is also loaded where react-native is not (tests).
    const { Image } = require("react-native") as typeof import("react-native")
    return Image.resolveAssetSource(require("../../assets/player-baba.jpg"))?.uri
  } catch {
    return undefined
  }
}

function trackForNativePlayer(track: CatalogTrack): Track {
  const url =
    typeof toPlayableLocalUri === "function" ? toPlayableLocalUri(track.url) : track.url
  // How the speed is stretched (iOS only, set per track): keep the tone unless the listener turned "Keep pitch" off.
  const pitchAlgorithm = pitchEnumValue(loadTrackPlayerModule() as { PitchAlgorithm?: Record<string, unknown> }, pitchChoiceFor({ keepPitch: usePlaybackPrefsStore.getState().keepPitch, cls: track.loudnessClass }))
  return { ...track, url, artwork: track.artwork ?? defaultArtwork(), ...(pitchAlgorithm === undefined ? {} : { pitchAlgorithm }) } as Track
}

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

/** Lock screen / car / notification buttons. Next is offered only while there is a next song. */
let nextEnabled = true
let playerReady = false

function remoteOptions() {
  const { AppKilledPlaybackBehavior, Capability } = loadTrackPlayerModule()
  const capabilities = [
    Capability.Play,
    Capability.Pause,
    ...(nextEnabled ? [Capability.SkipToNext] : []),
    Capability.SkipToPrevious,
    Capability.SeekTo,
    Capability.Stop,
  ]
  return {
    capabilities,
    notificationCapabilities: [
      Capability.Play,
      Capability.Pause,
      ...(nextEnabled ? [Capability.SkipToNext] : []),
      Capability.SkipToPrevious,
    ],
    progressUpdateEventInterval: 1,
    android: {
      appKilledPlaybackBehavior: AppKilledPlaybackBehavior.ContinuePlayback,
    },
  }
}

export async function setupNativeCatalogPlayer(): Promise<void> {
  ensureNativeListenersInstalled()
  if (setupPromise) return setupPromise
  const attempt = (async () => {
    const TrackPlayer = getTrackPlayer()
    try {
      await TrackPlayer.setupPlayer({ autoHandleInterruptions: true })
    } catch {
      /* already initialized */
    }
    await TrackPlayer.updateOptions(remoteOptions())
    attachLevelingListeners()
    playerReady = true
  })()
  setupPromise = attempt
  // A failed setup must not be remembered for the life of the app: the next call tries again.
  attempt.catch(() => {
    if (setupPromise === attempt) setupPromise = null
  })
  return attempt
}

/** Show or hide Next on the lock screen / notification. Only touches the player when the answer changes. */
export async function setRemoteNextEnabled(enabled: boolean): Promise<void> {
  if (enabled === nextEnabled) return
  nextEnabled = enabled
  if (!playerReady) return
  try {
    await getTrackPlayer().updateOptions(remoteOptions())
  } catch {
    /* the next song change tries again */
  }
}

export async function resetNativeCatalog(): Promise<void> {
  await setupNativeCatalogPlayer()
  await getTrackPlayer().reset()
}

/** `startAt`: the second to start from (a saved resume point), moved to before play so the beginning is never heard. */
export async function playTrackNow(track: CatalogTrack, startAt = 0): Promise<void> {
  await setupNativeCatalogPlayer()
  const TrackPlayer = getTrackPlayer()
  await TrackPlayer.reset()
  // Volume leveling: this track's gain is set before it is heard (lib/loudness/leveler.ts).
  levelStartTrack(track)
  await TrackPlayer.add(trackForNativePlayer(track))
  if (startAt > 0) {
    try {
      await TrackPlayer.seekTo(startAt)
    } catch {
      /* the resume tracker moves it once the song is playing */
    }
  }
  await TrackPlayer.play()
}

export async function enqueueTrack(track: CatalogTrack): Promise<void> {
  await setupNativeCatalogPlayer()
  levelNoteUpcoming(track)
  await getTrackPlayer().add(trackForNativePlayer(track))
}

export async function nativePlay(): Promise<void> {
  await setupNativeCatalogPlayer()
  await getTrackPlayer().play()
}

export async function nativePause(): Promise<void> {
  await getTrackPlayer().pause()
}

export async function nativeStop(): Promise<void> {
  levelReset()
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

/** The listener's own volume (slider, sleep fade). The leveler multiplies its gain in and sets the real volume. */
export async function nativeSetVolume(volume: number): Promise<void> {
  levelSetUserVolume(Math.min(1, Math.max(0, volume)))
}

export async function nativeSetRate(rate: number): Promise<void> {
  await getTrackPlayer().setRate(Math.min(SPEED_MAX, Math.max(SPEED_MIN, rate)))
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
