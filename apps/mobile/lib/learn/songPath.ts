import { t } from "@/lib/i18n"
import { isSongLearned, pathDoneCount, pathStepDone, type PathPart, type PathState, type PathStep } from "@/lib/learn/progress"
import { LEARN_ROUTES, quizHref, songHref, wordsHref } from "@/lib/learn/routes"
import { nextRequiredStep } from "@/lib/learn/songStatus"

/**
 * The steps of one song (Dada, 10 November 2026): 1 Words (the song's word cards), 2 Quiz (questions on
 * those words), 3 Chords (play along; an extra that never decides whether the song is learned).
 * "Listen" is a button at the top of the page, not a step. Every step can be started at any time and repeated.
 */
export const PATH_STEPS: ReadonlyArray<{
  step: PathStep
  part: PathPart
  title: string
  text: string
  cta: string
  /** the short name used in the library row: "Step 2 of 2 · Quiz" */
  short: string
  /** Chords only */
  optional: boolean
}> = [
  {
    step: 1,
    part: "words",
    optional: false,
    get title() {
      return t("learn.song.s1.title")
    },
    get text() {
      return t("learn.song.s1.text")
    },
    get cta() {
      return t("learn.song.s1.cta")
    },
    get short() {
      return t("learn.step.words")
    },
  },
  {
    step: 2,
    part: "meaning",
    optional: false,
    get title() {
      return t("learn.song.s2.title")
    },
    get text() {
      return t("learn.song.s2.text")
    },
    get cta() {
      return t("learn.song.s2.cta")
    },
    get short() {
      return t("learn.step.quiz")
    },
  },
  {
    step: 3,
    part: "chords",
    optional: true,
    get title() {
      return t("learn.song.s3.title")
    },
    get text() {
      return t("learn.song.s3.text")
    },
    get cta() {
      return t("learn.song.s3.cta")
    },
    get short() {
      return t("learn.step.chords")
    },
  },
]

/** "Step 1 · To do" or "Step 2 · Done"; Chords are labelled "Extra". */
export function stepOver(step: PathStep, done: boolean): string {
  if (step === 3) return done ? t("learn.song.extraDone") : t("learn.song.extra")
  return done ? t("learn.path.overDone", { n: step }) : t("learn.path.overTodo", { n: step })
}

/** Button text of a step: its own, or "Do it again" once done. */
export function stepCta(step: PathStep, path: PathState | undefined): string {
  const meta = PATH_STEPS[step - 1]!
  return path && pathStepDone(path, step) ? t("learn.path.again") : meta.cta
}

/** "1 of 2 steps": only Words and Quiz count. */
export function pathProgressLabel(path: PathState | undefined): string {
  return t("learn.song.progress", { done: pathDoneCount(path) })
}

/** 0 to 1 for the path progress bar (Words and Quiz). */
export function pathFraction(path: PathState | undefined): number {
  return pathDoneCount(path) / 2
}

/** The line under a song in the library: "Step 2 of 2 · Quiz". */
export function nextStepNote(path: PathState | undefined): string {
  const next = nextRequiredStep(path)
  if (next === null) return t("learn.step.learned")
  const step = next === "words" ? 1 : 2
  return t("learn.step.line2", { n: step, name: PATH_STEPS[step - 1]!.short })
}

/** Where each button of the page goes. Harmonium routes belong to another branch and are linked by path only. */
export function pathLinks(songId: string, songNumber: number) {
  return {
    listen: songHref(songId),
    words: wordsHref({ song: songNumber }),
    quiz: quizHref({ song: songNumber }),
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
