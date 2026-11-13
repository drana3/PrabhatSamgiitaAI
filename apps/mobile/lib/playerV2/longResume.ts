import type { ResumeEntry } from "@/lib/playerV2/resume"

/**
 * "Continue from 12:40" for LONG recordings (a Kiirtan of half an hour, a talk): the app remembers where the
 * listener stopped and OFFERS to go back there. It never jumps by itself (a short Prabhat Samgiita song does
 * that, see resume.ts: there it is expected; here a surprise jump in the middle of a Kiirtan would be wrong).
 *
 * Local only: the place is kept on the phone (stores/resumeStore.ts), nothing goes to a server.
 * Pure: no React, no stores.
 */

/** A recording longer than this (seconds) gets the offer. */
export const LONG_RECORDING_SECONDS = 600
/** Stopped before this second: nothing worth coming back to. */
export const LONG_RESUME_MIN_SECONDS = 10
/** Stopped this close to the end: it counts as finished, no offer. */
export const LONG_RESUME_TAIL_SECONDS = 30
/** Save at most this often while playing. */
export const LONG_RESUME_SAVE_INTERVAL_SECONDS = 10
/** The offer stays on the player while playback is still this near the start of the recording. */
export const LONG_OFFER_WINDOW_SECONDS = 20

export const isLongRecording = (duration: number | null | undefined): boolean =>
  typeof duration === "number" && Number.isFinite(duration) && duration > LONG_RECORDING_SECONDS

/** The second to offer, or null (not long, stopped too early, or at the end). */
export function longResumeOffer(entry: ResumeEntry | undefined | null): number | null {
  if (!entry || !isLongRecording(entry.duration)) return null
  if (!(entry.position > LONG_RESUME_MIN_SECONDS)) return null
  if (entry.position >= entry.duration - LONG_RESUME_TAIL_SECONDS) return null
  return Math.floor(entry.position)
}

export function shouldSaveLong(position: number, duration: number, lastSaved: number | null): boolean {
  if (!isLongRecording(duration) || !(position > LONG_RESUME_MIN_SECONDS)) return false
  if (lastSaved == null) return true
  return Math.abs(position - lastSaved) >= LONG_RESUME_SAVE_INTERVAL_SECONDS
}

/** The offer is shown while this recording is the one it was made for and playback is still near its start. */
export function longOfferVisible(
  offer: { songNumber: number | null; at: number },
  songNumber: number | null,
  position: number,
): boolean {
  if (songNumber == null || offer.songNumber !== songNumber || !(offer.at > 0)) return false
  return position < LONG_OFFER_WINDOW_SECONDS
}

export type LongObservation = {
  /** The recording that plays; null when it is not one this applies to. */
  songNumber: number | null
  position: number
  duration: number
  isPlaying: boolean
  isBuffering: boolean
}

export type LongResumeDeps = {
  getEntry: (songNumber: number) => ResumeEntry | undefined
  record: (songNumber: number, position: number, duration: number) => void
  /** A recording started that has a place to go back to. */
  offer: (songNumber: number, at: number) => void
  clearOffer: () => void
}

/** Feed it every player update: it makes the offer once per recording and saves the place every few seconds. */
export function createLongResumeRecorder(deps: LongResumeDeps): (obs: LongObservation) => void {
  let song: number | null = null
  let lastSaved: number | null = null
  let wasPlaying = false

  return (obs) => {
    if (obs.songNumber !== song) {
      song = obs.songNumber
      lastSaved = null
      wasPlaying = obs.isPlaying
      deps.clearOffer()
      if (song != null) {
        const at = longResumeOffer(deps.getEntry(song))
        if (at != null) deps.offer(song, at)
      }
      return
    }
    if (song == null || obs.isBuffering) return
    const paused = wasPlaying && !obs.isPlaying
    wasPlaying = obs.isPlaying
    // Right after the start the engine may still report 0 while the old offer waits: do not save over it.
    const savedAt = deps.getEntry(song)
    const waiting = savedAt != null && obs.position < LONG_OFFER_WINDOW_SECONDS && longResumeOffer(savedAt) != null
    if (waiting) return
    const due = paused
      ? isLongRecording(obs.duration) && obs.position > LONG_RESUME_MIN_SECONDS
      : shouldSaveLong(obs.position, obs.duration, lastSaved)
    if (!due) return
    lastSaved = obs.position
    deps.record(song, obs.position, obs.duration)
  }
}
