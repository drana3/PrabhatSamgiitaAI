import { Audio, type AVPlaybackStatus } from "expo-av"

import type { CatalogTrack } from "@/lib/playback/catalogTrack"
import { trackIdToSongNumber } from "@/lib/playback/catalogTrack"
import {
  notifyCatalogPlaybackError,
  notifyCatalogQueueEnded,
} from "@/lib/playback/catalogPlaybackHost"

let setupPromise: Promise<void> | null = null
let listenersHooked = false
let sound: Audio.Sound | null = null
let loopCurrent = false
let activeTrackNumber: number | null = null
let audioChain: Promise<void> = Promise.resolve()

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

async function setPlaybackMode(): Promise<void> {
  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    allowsRecordingIOS: false,
    staysActiveInBackground: true,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  })
}

function enqueueAudio(op: () => Promise<void>): Promise<void> {
  const run = audioChain.then(op, op)
  audioChain = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

async function unloadSound(): Promise<void> {
  const current = sound
  sound = null
  if (!current) return
  try {
    current.setOnPlaybackStatusUpdate(null)
  } catch {
    /* ignore */
  }
  try {
    await current.stopAsync()
  } catch {
    try {
      await current.pauseAsync()
    } catch {
      /* ignore */
    }
  }
  try {
    await current.unloadAsync()
  } catch {
    /* ignore */
  }
}

function playerStore() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("@/stores/playerStore").usePlayerStore as typeof import("@/stores/playerStore").usePlayerStore
}

function onPlaybackStatus(status: AVPlaybackStatus): void {
  if (!status.isLoaded) {
    if (status.error) notifyCatalogPlaybackError()
    return
  }
  const position = Math.floor((status.positionMillis || 0) / 1000)
  const duration = Math.max(1, Math.floor((status.durationMillis || 0) / 1000))
  const store = playerStore().getState()
  if (status.isBuffering) {
    playerStore().setState({ isBuffering: true, isPlaying: store.isPlaying })
  } else if (status.isPlaying) {
    playerStore().setState({ isPlaying: true, isBuffering: false, audioError: null })
  } else if (!status.isPlaying && !status.didJustFinish) {
    playerStore().setState({ isPlaying: false, isBuffering: false })
  }
  playerStore().setState({ position, duration })
  if (status.didJustFinish && !status.isLooping) {
    notifyCatalogQueueEnded()
  }
}

export async function setupNativeCatalogPlayer(): Promise<void> {
  ensureNativeListenersInstalled()
  if (setupPromise) return setupPromise
  setupPromise = setPlaybackMode()
  return setupPromise
}

export async function resetNativeCatalog(): Promise<void> {
  await setupNativeCatalogPlayer()
  await enqueueAudio(() => unloadSound())
}

export async function playTrackNow(track: CatalogTrack): Promise<void> {
  await setupNativeCatalogPlayer()
  const number = trackIdToSongNumber(track.id)
  activeTrackNumber = number
  await enqueueAudio(async () => {
    await unloadSound()
    const { sound: created } = await Audio.Sound.createAsync(
      { uri: track.url },
      {
        shouldPlay: true,
        isLooping: loopCurrent,
        volume: playerStore().getState().volume,
        progressUpdateIntervalMillis: 500,
      },
      onPlaybackStatus,
    )
    sound = created
  })
}

export async function enqueueTrack(_track: CatalogTrack): Promise<void> {
  /* Android expo-av path advances in JS — no native prefetch queue. */
}

export async function nativePlay(): Promise<void> {
  await setupNativeCatalogPlayer()
  if (!sound) return
  await sound.playAsync()
}

export async function nativePause(): Promise<void> {
  if (!sound) return
  await sound.pauseAsync()
}

export async function nativeStop(): Promise<void> {
  activeTrackNumber = null
  await enqueueAudio(() => unloadSound())
}

export async function nativeSeek(seconds: number): Promise<void> {
  if (!sound) return
  await sound.setPositionAsync(Math.max(0, seconds) * 1000)
}

export async function nativeSetVolume(volume: number): Promise<void> {
  if (!sound) return
  await sound.setVolumeAsync(Math.min(1, Math.max(0, volume)))
}

export async function nativeSkipToNext(): Promise<void> {
  /* JS store owns playlist steps on Android. */
}

export async function nativeSkipToPrevious(): Promise<void> {
  /* JS store owns playlist steps on Android. */
}

export async function nativeSetRepeatTrack(loop: boolean): Promise<void> {
  loopCurrent = loop
  if (!sound) return
  try {
    await sound.setIsLoopingAsync(loop)
  } catch {
    /* ignore */
  }
}

export async function nativeQueueLengthPastIndex(): Promise<number> {
  return 0
}

export async function nativeRemoveUpcomingTracks(): Promise<void> {
  /* no native queue */
}

export function getActiveCatalogTrackNumber(): number | null {
  return activeTrackNumber
}
