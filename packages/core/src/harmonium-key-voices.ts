/** Shortest hold so a tap faster than the reed attack still speaks. */
export const HARMONIUM_MIN_NOTE_MS = 90

type Voice = {
  stop: (() => void) | null
  released: boolean
  startedAt: number
  timer: ReturnType<typeof setTimeout> | null
}

export type HarmoniumKeyVoiceGate = {
  press: (index: number) => { attach: (stop: () => void) => void }
  release: (index: number) => void
  releaseAll: () => void
  isHeld: (index: number) => boolean
  heldIndexes: () => Set<number>
}

/**
 * One sounding voice per keyboard key. Rapid retriggers cut the previous
 * voice immediately; finger-up keeps audio for HARMONIUM_MIN_NOTE_MS.
 */
export function createHarmoniumKeyVoiceGate(minNoteMs = HARMONIUM_MIN_NOTE_MS): HarmoniumKeyVoiceGate {
  const voices = new Map<number, Voice>()

  function clearTimer(voice: Voice) {
    if (voice.timer == null) return
    clearTimeout(voice.timer)
    voice.timer = null
  }

  function runStop(index: number, voice: Voice) {
    clearTimer(voice)
    const stop = voice.stop
    voice.stop = null
    if (voices.get(index) === voice) voices.delete(index)
    stop?.()
  }

  function scheduleRelease(index: number, voice: Voice) {
    if (!voice.stop) return
    const wait = Math.max(0, minNoteMs - (Date.now() - voice.startedAt))
    if (wait === 0) {
      runStop(index, voice)
      return
    }
    clearTimer(voice)
    voice.timer = setTimeout(() => {
      if (voices.get(index) !== voice) return
      runStop(index, voice)
    }, wait)
  }

  return {
    press(index) {
      const previous = voices.get(index)
      if (previous) {
        previous.released = true
        runStop(index, previous)
      }
      const voice: Voice = {
        stop: null,
        released: false,
        startedAt: Date.now(),
        timer: null,
      }
      voices.set(index, voice)
      return {
        attach(stop: () => void) {
          if (voices.get(index) !== voice) {
            stop()
            return
          }
          voice.stop = stop
          if (voice.released) scheduleRelease(index, voice)
        },
      }
    },

    release(index) {
      const voice = voices.get(index)
      if (!voice || voice.released) return
      voice.released = true
      if (voice.stop) scheduleRelease(index, voice)
    },

    releaseAll() {
      for (const [index, voice] of [...voices.entries()]) {
        voice.released = true
        runStop(index, voice)
      }
    },

    isHeld(index) {
      const voice = voices.get(index)
      return Boolean(voice && !voice.released)
    },

    heldIndexes() {
      return new Set(
        [...voices.entries()].filter(([, voice]) => !voice.released).map(([index]) => index),
      )
    },
  }
}
