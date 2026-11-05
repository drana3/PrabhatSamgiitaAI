import { t } from "@/lib/i18n"
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
    get title() {
      return t("learn.path.s1.title")
    },
    get text() {
      return t("learn.path.s1.text")
    },
    get cta() {
      return t("learn.path.s1.cta")
    },
    get short() {
      return t("learn.path.s1.short")
    },
  },
  {
    step: 2,
    part: "words",
    get title() {
      return t("learn.path.s2.title")
    },
    get text() {
      return t("learn.path.s2.text")
    },
    get cta() {
      return t("learn.path.s2.cta")
    },
    get short() {
      return t("learn.path.s2.short")
    },
  },
  {
    step: 3,
    part: "chords",
    get title() {
      return t("learn.path.s3.title")
    },
    get text() {
      return t("learn.path.s3.text")
    },
    get cta() {
      return t("learn.path.s3.cta")
    },
    get short() {
      return t("learn.path.s3.short")
    },
  },
]

/** "Step 1 · To do" or "Step 2 · Done". */
export function stepOver(step: PathStep, done: boolean): string {
  return done ? t("learn.path.overDone", { n: step }) : t("learn.path.overTodo", { n: step })
}

/** Button text of a step: its own, or "Do it again" once done. */
export function stepCta(step: PathStep, path: PathState | undefined): string {
  const meta = PATH_STEPS[step - 1]!
  return pathStepDone(path ?? EMPTY_PATH, step) ? t("learn.path.again") : meta.cta
}

/** "2 of 3 steps". */
export function pathProgressLabel(path: PathState | undefined): string {
  return t("learn.path.progress", { done: pathDoneCount(path) })
}

/** 0 to 1 for the path progress bar. */
export function pathFraction(path: PathState | undefined): number {
  return pathDoneCount(path) / 3
}

/** The "Learning now" line under a song in the library: "Step 2 of 3 · know what it means". */
export function nextStepNote(path: PathState | undefined): string {
  const done = pathDoneCount(path)
  const step = Math.min(3, done + 1)
  return t("learn.step.line", { n: step, name: PATH_STEPS[Math.min(2, done)]!.short })
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
/** The catalog holds PS 1 to PS 5018. */
export const MAX_SONG_NUMBER = 5018

export function songNumberFromId(songId: string): number | null {
  const match = /^ps-(\d+)$/i.exec(songId)
  if (!match) return null
  // only real songs: a link such as /learn/song/ps-99999 must not put "Song 99999" on the learner's list
  const number = Number(match[1])
  return number >= 1 && number <= MAX_SONG_NUMBER ? number : null
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
