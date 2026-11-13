/**
 * What the lock screen, headphones, the car and the Android notification can
 * ask of the player. Written against a small dependency object so the rules
 * can be tested without a device; playbackService.ts wires the real player.
 */
export type RemoteDeps = {
  /** True when the app's player store knows a song (it owns the UI state). */
  hasSong: () => boolean
  /** True while the sound is (meant to be) playing. */
  isPlaying: () => boolean
  /** App-level actions: they update the UI state and then drive the native player. */
  appPlay: () => void
  appPause: () => void
  appNext: () => void
  appPrevious: () => void
  appSeek: (seconds: number) => void
  /** Native-only fallbacks, used when the app has no song (a cold service). */
  nativePlay: () => Promise<void>
  nativePause: () => Promise<void>
  nativeStop: () => Promise<void>
  nativeSeek: (seconds: number) => Promise<void>
  nativeNext: () => Promise<void>
  nativePrevious: () => Promise<void>
}

export function createRemoteHandlers(deps: RemoteDeps) {
  /** We paused because another app or a call took the audio, so we may resume when it ends. */
  let pausedByDuck = false

  return {
    onPlay: () => {
      pausedByDuck = false
      if (deps.hasSong()) deps.appPlay()
      else void deps.nativePlay()
    },
    onPause: () => {
      pausedByDuck = false
      if (deps.hasSong()) deps.appPause()
      else void deps.nativePause()
    },
    onStop: () => {
      pausedByDuck = false
      if (deps.hasSong()) deps.appPause()
      void deps.nativeStop()
    },
    onNext: () => {
      if (deps.hasSong()) deps.appNext()
      else void deps.nativeNext().catch(() => undefined)
    },
    onPrevious: () => {
      if (deps.hasSong()) deps.appPrevious()
      else void deps.nativePrevious().catch(() => undefined)
    },
    onSeek: (seconds: number) => {
      if (!Number.isFinite(seconds)) return
      if (deps.hasSong()) deps.appSeek(seconds)
      else void deps.nativeSeek(seconds)
    },
    /**
     * Audio interruption when the system does not handle it for us.
     * paused: another app or a call took the audio; permanent: it will not give it back.
     * Resume only if we were the one playing and the interruption was not permanent.
     */
    onDuck: (event: { paused?: boolean; permanent?: boolean }) => {
      if (event.permanent) {
        pausedByDuck = false
        onPauseIfPlaying()
        return
      }
      if (event.paused) {
        if (isPlayingNow()) {
          pausedByDuck = true
          onPauseIfPlaying()
        }
        return
      }
      if (pausedByDuck) {
        pausedByDuck = false
        if (deps.hasSong()) deps.appPlay()
        else void deps.nativePlay()
      }
    },
  }

  function isPlayingNow(): boolean {
    return deps.isPlaying()
  }
  function onPauseIfPlaying() {
    if (deps.hasSong()) deps.appPause()
    else void deps.nativePause()
  }
}
