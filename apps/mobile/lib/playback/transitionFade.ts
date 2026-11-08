import { equalPowerGains } from "@/lib/loudness/crossfade"

/**
 * Smooth transition between two tracks WITHOUT touching the engine (one native player, one volume).
 *
 * What it does: in the last N seconds of a track the volume goes down along an equal-power curve; when the
 * next track starts by itself, the volume comes up along the matching curve over N seconds. The two tracks
 * do not play at the same time (that needs two players, see docs/smooth-transitions.md), so it is a
 * "fade out, fade in", not a true overlap.
 *
 * The fade is a multiplier (0..1) on top of the levelled volume: effective volume =
 * userVolume x levelling gain x fade (see lib/loudness/leveler.ts `setFade`).
 *
 * The native player reports its position about once a second, which would make a 2 s fade four steps.
 * So between two reports the position is extrapolated with a clock (position + elapsed x rate) and the
 * factor is recomputed several times a second while a fade runs. Pure: the clock, the timer, the volume
 * hook and the settings are injected.
 */

export const FADE_TICK_MS = 100
/** A track shorter than this is never faded (a fade takes a fifth of it at most). */
export const MAX_FADE_SHARE = 0.2
/** Start watching this many seconds before the fade, so the clock is running when it begins. */
const LOOKAHEAD_SECONDS = 1.5

export type TransitionFaderDeps = {
  /** Fade length in seconds for what plays now: 0 = off. */
  getSeconds: () => number
  /** Is there a next track queued (a fade-out makes no sense before silence or a repeat of the same track)? */
  hasNext: () => boolean
  /** Playback rate of the player (the fade is in real seconds). */
  getRate: () => number
  apply: (factor: number) => void
  now?: () => number
  setTimer?: (run: () => void, ms: number) => unknown
  clearTimer?: (handle: unknown) => void
}

export type TransitionFader = {
  onProgress: (position: number, duration: number) => void
  /** The active track changed: `byUser` is true for Next, Previous and a tap in the queue. */
  onTrackChanged: (byUser: boolean) => void
  /** Anything that changes the volume by hand: stop fading, volume 1. */
  reset: () => void
  factor: () => number
}

/** Fade length for a track of `duration` seconds and a request of `seconds`. 0 when the track is too short. */
export function fadeLengthFor(seconds: number, duration: number): number {
  if (!(seconds > 0) || !(duration > 0)) return 0
  const length = Math.min(seconds, duration * MAX_FADE_SHARE)
  return length >= 0.5 ? length : 0
}

export function createTransitionFader(deps: TransitionFaderDeps): TransitionFader {
  const now = deps.now ?? (() => Date.now())
  const setTimer = deps.setTimer ?? ((run, ms) => setInterval(run, ms))
  const clearTimer = deps.clearTimer ?? ((h) => clearInterval(h as ReturnType<typeof setInterval>))

  let current = 1
  let timer: unknown = null
  /** the running fade: "out" counts down to the end of the track, "in" counts up from its start */
  let mode: "idle" | "out" | "in" = "idle"
  let fadeSeconds = 0
  // last report of the player, for the clock
  let lastPosition = 0
  let lastDuration = 0
  let lastAt = 0
  let inStartedAt = 0

  const set = (factor: number) => {
    const next = Math.min(1, Math.max(0, factor))
    if (Math.abs(next - current) < 0.002 && next !== 0 && next !== 1) return
    if (next === current) return
    current = next
    deps.apply(next)
  }

  const stopTimer = () => {
    if (timer !== null) clearTimer(timer)
    timer = null
  }

  const rate = () => {
    const r = deps.getRate()
    return Number.isFinite(r) && r > 0 ? r : 1
  }

  /** Seconds of sound left in the current track, extrapolated from the last report. */
  const remaining = () => {
    const elapsed = Math.max(0, (now() - lastAt) / 1000) * rate()
    return Math.max(0, lastDuration - (lastPosition + elapsed))
  }

  const tick = () => {
    if (mode === "out") {
      const left = remaining() / rate()
      set(equalPowerGains(1 - left / fadeSeconds).out)
    } else if (mode === "in") {
      const t = (now() - inStartedAt) / 1000 / fadeSeconds
      set(equalPowerGains(t).in)
      if (t >= 1) {
        mode = "idle"
        stopTimer()
        set(1)
      }
    }
  }

  const ensureTimer = () => {
    if (timer === null) timer = setTimer(tick, FADE_TICK_MS)
  }

  const backToIdle = () => {
    mode = "idle"
    stopTimer()
    set(1)
  }

  return {
    onProgress(position, duration) {
      if (!Number.isFinite(position) || !(duration > 0)) return
      lastPosition = position
      lastDuration = duration
      lastAt = now()
      const length = fadeLengthFor(deps.getSeconds(), duration)
      if (mode === "in") return
      if (!length || !deps.hasNext()) {
        if (mode === "out" || current !== 1) backToIdle()
        return
      }
      const left = (duration - position) / rate()
      if (left <= length + LOOKAHEAD_SECONDS) {
        fadeSeconds = length
        mode = "out"
        ensureTimer()
        tick()
      } else if (mode === "out" || current !== 1) {
        // the song was rewound (sleep timer, seek back, start over): full volume again
        backToIdle()
      }
    },

    onTrackChanged(byUser) {
      const wasFadingOut = mode === "out" && current < 0.98
      if (wasFadingOut && !byUser) {
        // the next track began by itself after our fade-out: bring it up over the same length
        mode = "in"
        inStartedAt = now()
        lastPosition = 0
        lastDuration = 0
        set(0)
        ensureTimer()
        return
      }
      backToIdle()
    },

    reset() {
      lastPosition = 0
      lastDuration = 0
      backToIdle()
    },

    factor: () => current,
  }
}
