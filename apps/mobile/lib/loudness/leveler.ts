import type { CatalogTrack } from "@/lib/playback/catalogTrack"
import { computeLevel, dbToGain, type LevelResult } from "@/lib/loudness/levels"
import { loudnessInfoFrom } from "@/lib/loudness/songLevel"

/**
 * Keeps the loudness of the native player level from one track to the next.
 *
 * The native player (RNTP) has ONE volume for the whole queue, 0 to 1, and no per-track volume. So the
 * correction is done by moving that one volume at the right moments:
 *
 * - a track that starts: its own gain is applied at once (nothing is playing yet, so no click);
 * - the end of a track whose successor needs MORE attenuation (a louder recording): the volume is
 *   lowered shortly BEFORE the join, so the louder track never starts at the old volume;
 * - the successor needs LESS attenuation (a quieter recording): after the join the volume is raised
 *   over a short ramp, so there is no step.
 *
 * What the listener sets with the volume slider (`userVolume`) is multiplied in, so the slider keeps
 * its meaning: it is always "how loud, relative to the levelled loudness".
 *
 * Pure: the volume setter, the clock and the timers are injected, so this is tested without a phone.
 * The native player can only turn down: a quiet recording is not raised here (see capabilities.ts);
 * the reference is lowered instead so that most recordings have room to be turned down.
 */

/** Seconds before the end of a track in which the volume is lowered for a louder successor. */
export const PRE_DUCK_SECONDS = 1.2
/** Ramp length, in milliseconds, of a gain change in the middle of playback. */
export const RAMP_MS = 280
/** Step of a ramp, in milliseconds. */
export const RAMP_STEP_MS = 35

export type TimerHandle = unknown

export type LevelerDeps = {
  /** Sets the player volume, 0 to 1. */
  setVolume: (volume: number) => void
  /** Is volume leveling on (the switch in the profile settings)? */
  isEnabled: () => boolean
  /** Can this engine make a quiet track louder than the file? Native: no. */
  canBoost?: () => boolean
  setTimer?: (run: () => void, ms: number) => TimerHandle
  clearTimer?: (handle: TimerHandle) => void
}

export type Leveler = {
  /** Remember a track's loudness (a queued track, or the one about to start). */
  register: (track: CatalogTrack) => void
  /** A track is about to start from the beginning: apply its gain at once. */
  startTrack: (track: CatalogTrack) => void
  /** A track was queued behind the current one. */
  noteUpcoming: (track: CatalogTrack) => void
  /** The native player moved to another track (by itself, or by Next or Previous). */
  onActiveTrackChanged: (id: string | null) => void
  /** Progress of the active track, about once a second. */
  onProgress: (id: string | null, position: number, duration: number) => void
  /** The volume slider. Applied at once. */
  setUserVolume: (volume: number) => void
  /** The switch was flipped or the engine changed: apply the gain of the active track again. */
  refresh: () => void
  /** The gain now applied, in dB (0 when leveling is off). */
  gainDb: () => number
  /** What is known about the active track (for the settings screen and tests). */
  activeLevel: () => LevelResult | null
  reset: () => void
}

function levelOf(track: CatalogTrack, enabled: boolean, canBoost: boolean): LevelResult {
  return computeLevel({
    enabled,
    info: loudnessInfoFrom({ loudnessLufs: track.loudnessLufs, truePeakDb: track.truePeakDb }),
    cls: track.loudnessClass ?? "music",
    canBoost,
  })
}

const clampVolume = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1)

export function createLeveler(deps: LevelerDeps): Leveler {
  const setTimer = deps.setTimer ?? ((run, ms) => setTimeout(run, ms))
  const clearTimer = deps.clearTimer ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>))
  const tracks = new Map<string, CatalogTrack>()
  /** Which track was queued right behind which (the native queue is a line). */
  const upcomingAfter = new Map<string, string>()
  let lastRegistered: string | null = null

  let userVolume = 1
  let appliedGainDb = 0
  let activeId: string | null = null
  let ducked = false
  let timer: TimerHandle | null = null

  const canBoost = () => deps.canBoost?.() ?? false
  const enabled = () => deps.isEnabled()
  const levelFor = (id: string | null): LevelResult | null => {
    const track = id ? tracks.get(id) : undefined
    return track ? levelOf(track, enabled(), canBoost()) : null
  }
  const targetDb = (id: string | null) => levelFor(id)?.gainDb ?? 0

  function push() {
    deps.setVolume(clampVolume(userVolume * dbToGain(appliedGainDb)))
  }

  function stopRamp() {
    if (timer !== null) clearTimer(timer)
    timer = null
  }

  /** Moves the applied gain to `toDb` over `ms`, starting from where it is now (an interrupted ramp restarts from the current value). */
  function rampTo(toDb: number, ms: number) {
    stopRamp()
    const fromDb = appliedGainDb
    if (Math.abs(toDb - fromDb) < 0.05 || ms <= 0) {
      appliedGainDb = toDb
      push()
      return
    }
    const steps = Math.max(1, Math.round(ms / RAMP_STEP_MS))
    let step = 0
    const tick = () => {
      step += 1
      appliedGainDb = step >= steps ? toDb : fromDb + ((toDb - fromDb) * step) / steps
      push()
      timer = step >= steps ? null : setTimer(tick, RAMP_STEP_MS)
    }
    timer = setTimer(tick, RAMP_STEP_MS)
  }

  function nextOf(id: string | null): string | null {
    return (id && upcomingAfter.get(id)) || null
  }

  return {
    register(track) {
      tracks.set(track.id, track)
    },

    startTrack(track) {
      stopRamp()
      tracks.set(track.id, track)
      activeId = track.id
      lastRegistered = track.id
      ducked = false
      appliedGainDb = targetDb(track.id)
      push()
    },

    noteUpcoming(track) {
      tracks.set(track.id, track)
      // The queue is a line: this track follows whichever was last queued (or started).
      if (lastRegistered && lastRegistered !== track.id) upcomingAfter.set(lastRegistered, track.id)
      lastRegistered = track.id
    },

    onActiveTrackChanged(id) {
      if (!id || id === activeId) return
      activeId = id
      ducked = false
      // A track nothing is known about plays as it is.
      const target = tracks.has(id) ? targetDb(id) : 0
      // Too loud is worse than a moment too quiet: a cut is immediate, a raise is a ramp.
      rampTo(target, target < appliedGainDb - 0.05 ? 0 : RAMP_MS)
    },

    onProgress(id, position, duration) {
      if (!enabled() || !id || id !== activeId) return
      if (!(duration > 0) || !Number.isFinite(position)) return
      if (ducked || duration - position > PRE_DUCK_SECONDS) return
      const following = nextOf(id)
      if (!following) return
      const nextDb = targetDb(following)
      // A louder successor (it needs a bigger cut) is already quieter when it starts.
      if (nextDb < appliedGainDb - 0.5) {
        ducked = true
        rampTo(nextDb, Math.min(RAMP_MS, Math.max(RAMP_STEP_MS, (duration - position) * 1000 * 0.8)))
      }
    },

    setUserVolume(volume) {
      userVolume = clampVolume(volume)
      push()
    },

    refresh() {
      stopRamp()
      ducked = false
      appliedGainDb = targetDb(activeId)
      push()
    },

    gainDb: () => appliedGainDb,
    activeLevel: () => levelFor(activeId),

    reset() {
      stopRamp()
      tracks.clear()
      upcomingAfter.clear()
      activeId = null
      lastRegistered = null
      ducked = false
      appliedGainDb = 0
      push()
    },
  }
}
