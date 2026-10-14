import { Audio } from "expo-av"

/**
 * Single owner of native catalog audio lifecycle.
 *
 * Invariants:
 * - Only attach/open may createAsync.
 * - Skip/next stopFully the JS handle on the audio chain — never toggle Audio.setIsEnabled
 *   (that orphaned AVPlayers and caused two songs / silent radio).
 * - silenceAllAudio is only for true stop: leave Drive, clear, lost-handle resume.
 */
export type CatalogAudioBag = {
  __psSound: Audio.Sound | null
  __psLoadId: number
  __psPlayToken: number
  __psAudioChain: Promise<void>
  __psModeReady: boolean
  __psPreload: { uri: string; number: number; sound: Audio.Sound } | null
  __psWantPlaying: boolean
  __psLastResumeNudgeMs: number
  __psFinishedTrackKey: string | null
  __psAdvancingQueue: boolean
  __psStopAfterCurrentTrack: boolean
  /** True while openAndPlay/attach is in flight — blocks lifecycle heal reloads. */
  __psCatalogLoading: boolean
}

const bag = globalThis as typeof globalThis & CatalogAudioBag

if (typeof bag.__psLoadId !== "number") bag.__psLoadId = 0
if (typeof bag.__psPlayToken !== "number") bag.__psPlayToken = 0
if (bag.__psSound === undefined) bag.__psSound = null
if (!bag.__psAudioChain) bag.__psAudioChain = Promise.resolve()
if (typeof bag.__psModeReady !== "boolean") bag.__psModeReady = false
if (bag.__psPreload === undefined) bag.__psPreload = null
if (typeof bag.__psWantPlaying !== "boolean") bag.__psWantPlaying = false
if (typeof bag.__psLastResumeNudgeMs !== "number") bag.__psLastResumeNudgeMs = 0
if (bag.__psFinishedTrackKey === undefined) bag.__psFinishedTrackKey = null
if (typeof bag.__psAdvancingQueue !== "boolean") bag.__psAdvancingQueue = false
if (typeof bag.__psStopAfterCurrentTrack !== "boolean") bag.__psStopAfterCurrentTrack = false
if (typeof bag.__psCatalogLoading !== "boolean") bag.__psCatalogLoading = false

export function isCatalogLoading(): boolean {
  return bag.__psCatalogLoading
}

export function setCatalogLoading(loading: boolean): void {
  bag.__psCatalogLoading = loading
}

export function getCatalogAudioBag(): CatalogAudioBag {
  return bag
}

export function getActiveSound(): Audio.Sound | null {
  return bag.__psSound
}

export function setActiveSound(next: Audio.Sound | null): void {
  bag.__psSound = next
}

export function getLoadId(): number {
  return bag.__psLoadId
}

export function getPlayToken(): number {
  return bag.__psPlayToken
}

export function bumpLoadId(): number {
  bag.__psLoadId += 1
  return bag.__psLoadId
}

export function bumpPlayToken(): number {
  bag.__psPlayToken += 1
  return bag.__psPlayToken
}

export function detachActiveSoundCallbacks(): void {
  const owner = getActiveSound()
  if (!owner) return
  try {
    owner.setOnPlaybackStatusUpdate(null)
  } catch {
    /* ignore */
  }
}

export async function retireSoundInstance(sound: Audio.Sound): Promise<void> {
  try {
    sound.setOnPlaybackStatusUpdate(null)
  } catch {
    /* ignore */
  }
  try {
    await sound.stopAsync()
  } catch {
    try {
      await sound.pauseAsync()
    } catch {
      /* ignore */
    }
  }
  try {
    await sound.unloadAsync()
  } catch {
    /* ignore */
  }
}

/** Unload the active stream and clear the JS handle. */
export async function stopFully(): Promise<void> {
  const current = getActiveSound()
  setActiveSound(null)
  if (!current) return
  await retireSoundInstance(current)
}

export async function interruptActiveSoundAsync(clearAttachSession?: () => void): Promise<void> {
  clearAttachSession?.()
  await stopFully()
}

export async function destroyActiveSound(): Promise<void> {
  await stopFully()
}

export async function discardPreload(): Promise<void> {
  const preload = bag.__psPreload
  bag.__psPreload = null
  if (!preload) return
  try {
    preload.sound.setOnPlaybackStatusUpdate(null)
  } catch {
    /* ignore */
  }
  try {
    await preload.sound.unloadAsync()
  } catch {
    /* ignore */
  }
}

/** Serialize native audio work so create/destroy/pause never overlap. */
export function enqueueAudio(op: () => Promise<void>, interrupt = false, onInterrupt?: () => Promise<void>) {
  const start = interrupt
    ? bag.__psAudioChain.then(() => (onInterrupt ? onInterrupt() : stopFully()))
    : bag.__psAudioChain
  const run = start.then(op, op)
  bag.__psAudioChain = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

export async function silenceAllAudio(resetModeReady: () => void, restoreMode: () => Promise<void>) {
  try {
    await Audio.setIsEnabledAsync(false)
    await Audio.setIsEnabledAsync(true)
  } catch {
    /* ignore */
  }
  resetModeReady()
  try {
    await restoreMode()
  } catch {
    /* ignore */
  }
}

/**
 * Reserve a skip generation. The caller must enqueue the actual stopFully + open
 * on the audio chain — this function must not silence native audio or enqueue work.
 */
export function beginSkipGeneration(beforeStop?: () => void): number {
  bag.__psAdvancingQueue = true
  bag.__psFinishedTrackKey = null
  detachActiveSoundCallbacks()
  beforeStop?.()
  bag.__psLoadId += 1
  bag.__psPlayToken += 1
  bag.__psWantPlaying = true
  return bag.__psLoadId
}

export function clearAdvancingQueue(): void {
  bag.__psAdvancingQueue = false
}
