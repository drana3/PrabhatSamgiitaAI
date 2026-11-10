import type { LearningSong, PathState } from "@/lib/learn/progress"

/**
 * The status of a song in Learn: Not started, Learning or Learned (Dada, 10 November 2026).
 * Pure functions, no React and no storage, so the rule is tested and every screen reads the same one.
 *
 * The rule: a song is judged by TWO steps only, Words and Quiz.
 *   Not started  neither Words nor Quiz is done
 *   Learning     exactly one of them is done
 *   Learned      both are done
 * Chords are an extra, never required: a song without chords (or a person who does not play) can be
 * learned all the same. Listening is a button at the top of the song page, not a step, so it does not
 * count either. Both facts are stored (`chords`, `listen` in the path) but they do not change the status.
 *
 * The Songs page chips (Learning, Learned) take their rule from `songStatus(path)`: `songLibraryState` in
 * progress.ts forwards to it, and `classifyLearnSongs` (learnChips.ts) reads that, so the chip file needs no change.
 */

export type SongStatus = "notStarted" | "learning" | "learned"

/** The parts of a path that decide the status. `meaning` is the stored name of the song quiz. */
export const REQUIRED_PARTS = ["words", "meaning"] as const

/** 0, 1 or 2: how many of the two required steps (Words, Quiz) are done. */
export function requiredStepsDone(path: PathState | undefined): number {
  if (!path) return 0
  return REQUIRED_PARTS.filter((part) => path[part]).length
}

export function songStatus(path: PathState | undefined): SongStatus {
  const done = requiredStepsDone(path)
  if (done === REQUIRED_PARTS.length) return "learned"
  return done > 0 ? "learning" : "notStarted"
}

export type StatusCounts = { notStarted: number; learning: number; learned: number; total: number }

/** The three counters of the Learn page, over the songs on the learner's list. */
export function songStatusCounts(
  songs: readonly Pick<LearningSong, "songId">[],
  paths: Readonly<Record<string, PathState>>,
): StatusCounts {
  const counts: StatusCounts = { notStarted: 0, learning: 0, learned: 0, total: songs.length }
  for (const song of songs) counts[songStatus(paths[song.songId])] += 1
  return counts
}

export type StepKey = "words" | "quiz" | "chords"

/** What a step can do for one song right now. */
export type StepAvailability =
  /** can be done now */
  | "ready"
  /** Words: this song has no checked words yet */
  | "wordsSoon"
  /** Quiz: the song has some words but fewer than four different meanings */
  | "needsMoreWords"
  /** Quiz: no words at all, so no quiz either */
  | "quizSoon"
  /** Chords: this song has no accepted chords (grey, never in the way) */
  | "noChords"

export type SongStepView = {
  key: StepKey
  /** stored name in the path */
  part: "words" | "meaning" | "chords"
  done: boolean
  /** Chords only: it does not count for the status */
  optional: boolean
  availability: StepAvailability
  /** a step that cannot be started now (soon, needs more words, no chords) */
  blocked: boolean
}

/** What is known about a song, to say what each step can do. */
export type SongFacts = {
  /** words of this song that may be taught (0 while they are not verified) */
  wordCount: number
  /** different meanings among those words; the quiz needs at least `minDistinct` */
  distinctMeanings: number
  /** true: accepted chords exist; false: none; null: not known (offline, preview), treated as available */
  hasChords: boolean | null
  /** smallest number of different meanings that makes a quiz question with four answers */
  minDistinct: number
}

/** The three steps of a song in their order: Words, Quiz, Chords. */
export function songSteps(path: PathState | undefined, facts: SongFacts): SongStepView[] {
  const wordsOk = facts.wordCount > 0
  const quizOk = wordsOk && facts.distinctMeanings >= facts.minDistinct
  const wordsAvailability: StepAvailability = wordsOk ? "ready" : "wordsSoon"
  const quizAvailability: StepAvailability = quizOk ? "ready" : wordsOk ? "needsMoreWords" : "quizSoon"
  const chordsAvailability: StepAvailability = facts.hasChords === false ? "noChords" : "ready"
  const steps: Array<Omit<SongStepView, "blocked">> = [
    { key: "words", part: "words", done: Boolean(path?.words), optional: false, availability: wordsAvailability },
    { key: "quiz", part: "meaning", done: Boolean(path?.meaning), optional: false, availability: quizAvailability },
    { key: "chords", part: "chords", done: Boolean(path?.chords), optional: true, availability: chordsAvailability },
  ]
  return steps.map((step) => ({ ...step, blocked: step.availability !== "ready" }))
}

/**
 * The next required step to do: "words", then "quiz"; null when the song is learned.
 * A step that is blocked (no words yet) is still named: the page says why it waits.
 */
export function nextRequiredStep(path: PathState | undefined): "words" | "quiz" | null {
  if (!path?.words) return "words"
  if (!path.meaning) return "quiz"
  return null
}
