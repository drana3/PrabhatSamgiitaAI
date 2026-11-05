/** Resume position per song (PLR-06). Pure helpers; the persisted store is stores/resumeStore.ts. */
export type ResumeEntry = {
  position: number
  duration: number
  savedAt: number
  /** The version of the song the position belongs to; absent in entries saved before versions were tracked. */
  versionId?: string | null
}
export type ResumeMap = Record<string, ResumeEntry>

/** Positions under this are not worth resuming. */
export const RESUME_MIN_SECONDS = 5
/** A song that stopped this close to the end counts as finished. */
export const RESUME_TAIL_SECONDS = 10
/** Write at most this often while playing. */
export const RESUME_SAVE_INTERVAL_SECONDS = 5
export const RESUME_MAX_ENTRIES = 200

/**
 * Where to start the song, or null to start from 0. A position saved on one version never starts
 * another: version B would begin where version A stopped.
 */
export function resumePositionFor(
  entry: ResumeEntry | undefined | null,
  versionId?: string | null,
): number | null {
  if (!entry) return null
  if (entry.versionId !== undefined && (entry.versionId ?? null) !== (versionId ?? null)) return null
  if (!(entry.position >= RESUME_MIN_SECONDS)) return null
  if (entry.duration > 1 && entry.position >= entry.duration - RESUME_TAIL_SECONDS) return null
  return Math.floor(entry.position)
}

export function shouldSaveResume(position: number, lastSavedPosition: number | null): boolean {
  if (!(position >= RESUME_MIN_SECONDS)) return false
  if (lastSavedPosition == null) return true
  return Math.abs(position - lastSavedPosition) >= RESUME_SAVE_INTERVAL_SECONDS
}

/** Finished songs drop their entry; others are stored; the oldest entries are evicted. */
export function upsertResume(
  map: ResumeMap,
  songNumber: number,
  position: number,
  duration: number,
  now: number,
  max = RESUME_MAX_ENTRIES,
  versionId: string | null = null,
): ResumeMap {
  const key = String(songNumber)
  const next: ResumeMap = { ...map }
  const finished = duration > 1 && position >= duration - RESUME_TAIL_SECONDS
  if (finished || position < RESUME_MIN_SECONDS) {
    delete next[key]
    return next
  }
  next[key] = { position: Math.floor(position), duration: Math.floor(duration), savedAt: now, versionId }
  const keys = Object.keys(next)
  if (keys.length > max) {
    keys
      .sort((a, b) => (next[a]?.savedAt ?? 0) - (next[b]?.savedAt ?? 0))
      .slice(0, keys.length - max)
      .forEach((k) => delete next[k])
  }
  return next
}

/**
 * Apply the saved position once per load, only when the track is really
 * playing and the engine is not at the saved position already.
 */
export function shouldApplyResume(input: {
  alreadyApplied: boolean
  isBuffering: boolean
  position: number
  duration: number
  target: number | null
}): boolean {
  if (input.alreadyApplied || input.target == null) return false
  if (input.isBuffering || input.duration <= 1) return false
  return input.position < input.target - 1
}
