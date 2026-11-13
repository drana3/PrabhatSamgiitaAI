import { sleepWaitsForTrack, type SleepTimer } from "@/lib/playerV2/sleepTimer"

/**
 * What the sleep timer does to the real player, kept apart from the stores so it can be tested.
 *
 * "End of song" has to stop playback at the true end of the song. The clock can only guess that (the
 * position ticks once a second), so the timer instead takes the next song away from the native player,
 * turns native repeat off, and lets the player's own "track ended" event do the pausing. The fade lowers
 * the native volume only; the volume the user chose is never changed.
 */
export type SleepRuntimeDeps = {
  getTimer: () => SleepTimer
  currentSongNumber: () => number | null
  /** Take the upcoming songs out of the native queue and stop repeating the current track. */
  holdNative: () => void
  /** Give the native player back its upcoming songs and repeat setting. */
  releaseNative: () => void
  pause: () => void
  rewind: () => void
  cancel: () => void
  /** The volume the user chose, 0..1. */
  getVolume: () => number
  setNativeVolume: (volume: number) => void
}

export function createSleepRuntime(deps: SleepRuntimeDeps) {
  let lastFactor = 1
  /** The native queue was emptied of upcoming tracks for a timer that waits for a track end. */
  let held = false

  /** "End of track" waits for its track; "end of playlist" for the last track of the list (earlier tracks play on). */
  const endOfSongActive = () => sleepWaitsForTrack(deps.getTimer(), deps.currentSongNumber())
  const holdIfDue = (timer: SleepTimer = deps.getTimer()) => {
    if (held || !sleepWaitsForTrack(timer, deps.currentSongNumber())) return
    held = true
    deps.holdNative()
  }
  const releaseIfHeld = () => {
    if (!held) return
    held = false
    deps.releaseNative()
  }

  return {
    /** For the controller: true while the current song is the one the timer waits for. */
    controllerSleep: {
      endOfSongActive,
      fireAtSongEnd: () => {
        deps.pause()
        // The next play starts the song again, not from its last second.
        deps.rewind()
        deps.cancel()
      },
    },

    /** Applied every tick; only touches the native player when the factor changes. */
    setFade: (factor: number) => {
      if (factor === lastFactor) return
      lastFactor = factor
      deps.setNativeVolume(deps.getVolume() * factor)
    },

    /** The track that plays changed: an "end of playlist" timer takes hold when the last track starts. */
    onSongChange: () => {
      const timer = deps.getTimer()
      if (timer.kind === "endOfList") {
        if (endOfSongActive()) holdIfDue()
        else releaseIfHeld()
      } else if (timer.kind === "endOfSong" && held && !endOfSongActive()) {
        // the engine moved on to another track: nothing to hold any more
        releaseIfHeld()
      }
    },

    /** Called whenever the timer changes. */
    onTimerChange: (previous: SleepTimer, next: SleepTimer) => {
      const waits = next.kind === "endOfSong" || next.kind === "endOfList"
      if (waits) {
        // a new "end of ..." may replace another one: the hold has to belong to the track it waits for
        if (held && !sleepWaitsForTrack(next, deps.currentSongNumber())) releaseIfHeld()
        else holdIfDue(next)
      } else if (held || previous.kind === "endOfSong") {
        held = false
        deps.releaseNative()
      }
      if (next.kind === "off" && lastFactor !== 1) {
        lastFactor = 1
        deps.setNativeVolume(deps.getVolume())
      }
    },
  }
}
