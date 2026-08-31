/** Tiny bridge so song playback and capture audio can coordinate without circular imports. */

type Cleanup = () => void | Promise<void>

const cleanups = new Set<Cleanup>()
const playbackIntentListeners = new Set<() => void>()
let songPlayingGuard: () => boolean = () => false
let songYieldHandler: (() => Promise<void>) | null = null
/** Song the user intends to hear right now — Sound may not exist yet (first buffer). */
let playbackIntentNumber: number | null = null

export function registerExtraAudioCleanup(cleanup: Cleanup): () => void {
  cleanups.add(cleanup)
  return () => {
    cleanups.delete(cleanup)
  }
}

export async function releaseExtraAudio(): Promise<void> {
  await Promise.all(
    [...cleanups].map((cleanup) =>
      Promise.resolve()
        .then(() => cleanup())
        .catch(() => undefined),
    ),
  )
}

/** Player store registers this so capture/practice never reconfigure AVAudioSession mid-song. */
export function setSongPlayingGuard(guard: () => boolean): void {
  songPlayingGuard = guard
}

export function isSongPlaybackActive(): boolean {
  try {
    return songPlayingGuard()
  } catch {
    return false
  }
}

export function setPlaybackIntent(songNumber: number | null): void {
  playbackIntentNumber = songNumber
  for (const listener of [...playbackIntentListeners]) {
    try {
      listener()
    } catch {
      /* ignore */
    }
  }
}

export function getPlaybackIntent(): number | null {
  return playbackIntentNumber
}

/** True while this song is starting or playing — a second HTTP GET of the same MP3 stalls AVPlayer. */
export function downloadWouldClashWithPlayback(songNumber: number): boolean {
  return playbackIntentNumber === songNumber
}

export function subscribePlaybackIntent(listener: () => void): () => void {
  playbackIntentListeners.add(listener)
  return () => {
    playbackIntentListeners.delete(listener)
  }
}

/**
 * Player store registers this so harmonium / capture can pause the song
 * before creating a competing AVPlayer (which stalls mid-track on iOS).
 */
export function setSongPlaybackYield(handler: (() => Promise<void>) | null): void {
  songYieldHandler = handler
}

/** Pause the main song player if it is active, then return. Safe to call when idle. */
export async function yieldSongPlayback(): Promise<void> {
  if (!isSongPlaybackActive()) return
  const handler = songYieldHandler
  if (!handler) return
  try {
    await handler()
  } catch {
    /* ignore — caller still proceeds with exclusive audio */
  }
}

/** Stop catalog listen + the main player so capture Play only sounds captured sargam. */
export async function stopCompetingPlaybackForCapture(): Promise<void> {
  await releaseExtraAudio()
  await yieldSongPlayback()
}
