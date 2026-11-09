import { LEGACY_MOODS, UPLOAD_MOODS } from "@/lib/kirtan/moods"

import type { MoodState, MoodStatus, RecordingMoods } from "./types"

/**
 * The numbers of the mood rule, the same as the server's (apps/api services/recording_moods.py, docs/search-menu.md section 6).
 * The server decides; the phone only needs them to say "2 of 3" and to run the preview's stand-in.
 */
export const YES_NEEDED_UPLOADER = 3
export const YES_NEEDED_LISTENERS = 5
export const YES_SHARE = 0.7
export const REJECT_AFTER_VOTES = 5
export const REJECT_BELOW_SHARE = 0.3
export const UPLOADER_MOODS_MAX = 5

/** The status the votes give (the server also asks for one "yes" of an account older than 30 days; the stand-in does not). */
export function decideMood(source: "uploader" | "listeners" | "team", yes: number, no: number): MoodStatus {
  const total = yes + no
  const needed = source === "uploader" ? YES_NEEDED_UPLOADER : YES_NEEDED_LISTENERS
  if (total && yes >= needed && yes / total >= YES_SHARE) return "confirmed"
  if (total >= REJECT_AFTER_VOTES && yes / total < REJECT_BELOW_SHARE) return "rejected"
  return "suggested"
}

/** The six moods in the app's order, each with the state the server sent (or "none"). */
export function orderedMoods(page: Pick<RecordingMoods, "moods">): MoodState[] {
  const found = new Map(page.moods.map((m) => [m.mood, m]))
  // the five the form offers always; an older word (Calm, Ecstatic, Devotion, Sad) only while the recording carries it
  const ids = [...UPLOAD_MOODS, ...LEGACY_MOODS.filter((mood) => found.has(mood))]
  return ids.map((mood) => found.get(mood) ?? { mood, status: "none", source: null, locked: false, yes: 0, no: 0, mine: null })
}

/** Moods somebody proposed and nobody rejected: what a listener is asked about. */
export function proposedMoods(page: Pick<RecordingMoods, "moods">): MoodState[] {
  return orderedMoods(page).filter((m) => m.status === "suggested" || m.status === "confirmed")
}

/** Moods nobody proposed yet: a listener may start one with "this fits". */
export function openMoods(page: Pick<RecordingMoods, "moods">): MoodState[] {
  return orderedMoods(page).filter((m) => m.status === "none")
}

/** "2 of 3": the votes a waiting mood has, against the number it needs. */
export function waitingLine(state: MoodState, needed: RecordingMoods["needed"]): { yes: number; needed: number } {
  return { yes: state.yes, needed: state.source === "uploader" ? needed.uploader : needed.listeners }
}
