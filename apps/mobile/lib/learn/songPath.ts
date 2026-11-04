import { EMPTY_PATH, isSongLearned, pathDoneCount, pathStepDone, type PathPart, type PathState, type PathStep } from "@/lib/learn/progress"
import { LEARN_ROUTES, songHref, wordsHref } from "@/lib/learn/routes"

/**
 * The three-step path of one song, as in the design prototype ("Learn a song"):
 * 1 hear it and sing it, 2 learn what it means (the song's word cards), 3 play it
 * (chords). Every step can be started at any time and repeated.
 */
export const PATH_STEPS: ReadonlyArray<{
  step: PathStep
  part: PathPart
  title: string
  text: string
  cta: string
  /** the short name used in the library row: "Step 2 of 3 · know what it means" */
  short: string
}> = [
  {
    step: 1,
    part: "listen",
    title: "Hear it and sing it",
    text: "Play it at 0.75 speed with the words lighting up. Sing along line by line until the tune stays with you.",
    cta: "Listen and sing",
    short: "hear it",
  },
  {
    step: 2,
    part: "words",
    title: "Learn what it means",
    text: "Go through this song's words as flashcards, then read the meaning of each line.",
    cta: "Study the words",
    short: "know what it means",
  },
  {
    step: 3,
    part: "chords",
    title: "Play it",
    text: "Chord letters sit above the words, in your key. Pick guitar or harmonium and play along.",
    cta: "Open the chords",
    short: "play it",
  },
]

/** "Step 1 · To do" or "Step 2 · Done". */
export function stepOver(step: PathStep, done: boolean): string {
  return `Step ${step} · ${done ? "Done" : "To do"}`
}

/** Button text of a step: its own, or "Do it again" once done. */
export function stepCta(step: PathStep, path: PathState | undefined): string {
  const meta = PATH_STEPS[step - 1]!
  return pathStepDone(path ?? EMPTY_PATH, step) ? "Do it again" : meta.cta
}

/** "2 of 3 steps". */
export function pathProgressLabel(path: PathState | undefined): string {
  return `${pathDoneCount(path)} of 3 steps`
}

/** 0 to 1 for the path progress bar. */
export function pathFraction(path: PathState | undefined): number {
  return pathDoneCount(path) / 3
}

/** The "Learning now" line under a song in the library: "Step 2 of 3 · know what it means". */
export function nextStepNote(path: PathState | undefined): string {
  const done = pathDoneCount(path)
  const step = Math.min(3, done + 1)
  return `Step ${step} of 3 · ${PATH_STEPS[Math.min(2, done)]!.short}`
}

/** Where each button of the path goes. Harmonium routes belong to another branch and are linked by path only. */
export function pathLinks(songId: string, songNumber: number) {
  return {
    listen: songHref(songId),
    words: wordsHref({ song: songNumber }),
    harmoniumChords: LEARN_ROUTES.harmoniumChords,
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
