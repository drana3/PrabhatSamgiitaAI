import {
  resumePositionFor,
  shouldApplyResume,
  shouldSaveResume,
  type ResumeEntry,
} from "@/lib/playerV2/resume"

export type ResumeObservation = {
  songNumber: number | null
  /** The version playing; null for a song with one recording. A new version is a new start. */
  versionId?: string | null
  position: number
  duration: number
  isPlaying: boolean
  isBuffering: boolean
}

export type ResumeTrackerDeps = {
  getEntry: (songNumber: number) => ResumeEntry | undefined
  record: (songNumber: number, position: number, duration: number, versionId: string | null) => void
  seekTo: (seconds: number) => void
}

/**
 * Feed it every player update. It restores the saved position once per song
 * load and saves progress every few seconds and on pause.
 */
export function createResumeTracker(deps: ResumeTrackerDeps) {
  let song: number | null = null
  let version: string | null = null
  let target: number | null = null
  let applied = false
  let lastSaved: number | null = null
  let wasPlaying = false

  return (obs: ResumeObservation): void => {
    const obsVersion = obs.versionId ?? null
    if (obs.songNumber !== song || obsVersion !== version) {
      song = obs.songNumber
      version = obsVersion
      target = song == null ? null : resumePositionFor(deps.getEntry(song), version)
      applied = target == null
      lastSaved = null
      wasPlaying = obs.isPlaying
      return
    }
    if (song == null) return

    if (
      shouldApplyResume({
        alreadyApplied: applied,
        isBuffering: obs.isBuffering,
        position: obs.position,
        duration: obs.duration,
        target,
      })
    ) {
      applied = true
      deps.seekTo(target as number)
      return
    }
    // Until the saved position is restored, the engine reports 0: never save that.
    if (!applied) return

    const paused = wasPlaying && !obs.isPlaying
    wasPlaying = obs.isPlaying
    if (obs.duration > 1 && (paused ? obs.position >= 5 : shouldSaveResume(obs.position, lastSaved))) {
      lastSaved = obs.position
      deps.record(song, obs.position, obs.duration, version)
    }
  }
}
