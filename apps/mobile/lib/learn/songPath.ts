import { EMPTY_PATH, isSongLearned, pathDoneCount, pathStepDone, type PathState, type PathStep } from "@/lib/learn/progress"
import { LEARN_ROUTES, quizHref, songHref, wordsHref } from "@/lib/learn/routes"

/**
 * The three-step path for one song (spec SCR-21): listen and word cards, a short
 * quiz on the meaning, then chords and playing along on the keyboard.
 *
 * Status of a step card:
 * - done: finished (forest card)
 * - current: the first unfinished step (orange outline)
 * - open: not the current step but can be started, because the learner chose to skip ahead
 * - locked: waits for the step before it
 */
export type StepStatus = "done" | "current" | "open" | "locked"

export const PATH_STEPS: ReadonlyArray<{ step: PathStep; title: string; text: string }> = [
  { step: 1, title: "Listen and learn the words", text: "Hear the song once, then go through its word cards." },
  { step: 2, title: "Check the meaning", text: "A short quiz on the words of this song." },
  { step: 3, title: "Play it on the keyboard", text: "See the chords, then play along with the song." },
]

/** Status of the three steps. `skipAhead` opens the steps after the current one. */
export function stepStatuses(path: PathState | undefined, skipAhead: boolean): [StepStatus, StepStatus, StepStatus] {
  const safe = path ?? EMPTY_PATH
  const steps: PathStep[] = [1, 2, 3]
  const current = steps.find((step) => !pathStepDone(safe, step))
  const statuses = steps.map((step): StepStatus => {
    if (pathStepDone(safe, step)) return "done"
    if (step === current) return "current"
    return skipAhead ? "open" : "locked"
  })
  return statuses as [StepStatus, StepStatus, StepStatus]
}

/** Whether a step can be started right now. */
export function stepAvailable(status: StepStatus): boolean {
  return status !== "locked"
}

/** The first unfinished step, or null when the song is learned. */
export function currentStep(path: PathState | undefined): PathStep | null {
  const safe = path ?? EMPTY_PATH
  return ([1, 2, 3] as const).find((step) => !pathStepDone(safe, step)) ?? null
}

/** "Step 2 of 3", "Song learned" or "Not started". */
export function pathHeadline(path: PathState | undefined): string {
  if (isSongLearned(path)) return "Song learned"
  const step = currentStep(path)
  if (pathDoneCount(path) === 0 && step === 1 && !(path?.listen || path?.words)) return "Not started"
  return `Step ${step} of 3`
}

/** Plain-English note under step 1: which half is left. */
export function stepOneNote(path: PathState | undefined): string {
  const safe = path ?? EMPTY_PATH
  if (safe.listen && safe.words) return "Listened, and all word cards done."
  if (safe.listen) return "Listened. Word cards are left."
  if (safe.words) return "Word cards done. Listen to the song once."
  return "Two parts: listen, then word cards."
}

/** Where each button of the path goes. Harmonium routes belong to another branch and are linked by path only. */
export function pathLinks(songId: string, songNumber: number) {
  return {
    listen: songHref(songId),
    words: wordsHref({ song: songNumber }),
    quiz: quizHref({ song: songNumber }),
    harmonium: LEARN_ROUTES.harmonium,
    chords: LEARN_ROUTES.harmoniumChords,
  }
}

/** Song number from an id like "ps-12"; null for anything else. */
export function songNumberFromId(songId: string): number | null {
  const match = /^ps-(\d+)$/i.exec(songId)
  return match ? Number(match[1]) : null
}

/**
 * The next saved song to learn after this one: the first saved song that is not
 * learned yet, in saved order, skipping the current one.
 */
export function nextSongToLearn(
  savedSongIds: readonly string[],
  paths: Readonly<Record<string, PathState>>,
  currentSongId: string,
): string | null {
  return savedSongIds.find((id) => id !== currentSongId && songNumberFromId(id) !== null && !isSongLearned(paths[id])) ?? null
}
