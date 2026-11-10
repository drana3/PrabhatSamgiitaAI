import {
  EMPTY_PATH,
  pathDoneCount,
  pathStepDone,
  type LearningSong,
  type PathState,
  type PathStep,
} from "@/lib/learn/progress"
import { LEARN_ROUTES, quizHref, songPathHref, wordsHref } from "@/lib/learn/routes"
import { QUIZ_LEVELS, type LearnQuizLevel } from "@/lib/learn/quiz"
import { songStatus, type SongStatus } from "@/lib/learn/songStatus"
import { t } from "@/lib/i18n"

/**
 * Logic of the Learn hub (the Learn tab): which song to continue, what the next step is
 * and where its button goes, the order of the song shelf, and the short texts of the page.
 * Pure functions, no React, so the page stays thin and the rules are tested.
 */

/**
 * The page, top to bottom (variant A, Dada 10 November 2026): the chain Continue, My songs (with the three
 * counters), "I want to learn this", Practice; then the blocks that were there before. The header and the
 * heading above these are fixed.
 */
export const HUB_SECTION_ORDER = ["continue", "songs", "choose", "practice", "play", "ragas", "harmonium", "stories"] as const
export type HubSection = (typeof HUB_SECTION_ORDER)[number]

/**
 * Where each button of the hub goes. Everything the old Practice, My songs and Tools
 * tabs offered is reachable from here (see the list in the Learn hub PR).
 */
export const HUB_LINKS = {
  allSongs: LEARN_ROUTES.mySongs,
  wordCards: LEARN_ROUTES.words,
  harmonium: LEARN_ROUTES.harmonium,
  chords: LEARN_ROUTES.harmoniumChords,
  stories: LEARN_ROUTES.stories,
  index: LEARN_ROUTES.ragaTalaIndex,
  /** "Search all 5018 songs": the picker where any song is added */
  pickSong: LEARN_ROUTES.addSong,
  // certificates: LEARN_ROUTES.liveQuiz, // hidden for now, Dada 2026-11-05 (routes /quiz stay in place)
} as const

/**
 * The three steps of a song, named for the bars: Words, Quiz, Chords. Chords are an extra: the
 * song is Learned by Words and Quiz alone. "Listen" is a button on the song page, not a step.
 */
export const HUB_STEPS = [
  { step: 1, key: "words", optional: false, get label() { return t("learn.step.words") } },
  { step: 2, key: "quiz", optional: false, get label() { return t("learn.step.quiz") } },
  { step: 3, key: "chords", optional: true, get label() { return t("learn.step.chords") } },
] as const satisfies ReadonlyArray<{ step: PathStep; key: string; optional: boolean; label: string }>

export type StepBar = { step: PathStep; label: string; done: boolean; optional: boolean }

/** Three bars for one song: which steps are done. The third (Chords) is an extra. */
export function songStepBars(path: PathState | undefined): StepBar[] {
  const safe = path ?? EMPTY_PATH
  return HUB_STEPS.map((meta) => ({ step: meta.step, label: meta.label, done: pathStepDone(safe, meta.step), optional: meta.optional }))
}

/** The first of Words and Quiz that is not done yet (1 or 2), or null when the song is Learned. Chords never come next. */
export function nextStep(path: PathState | undefined): PathStep | null {
  const safe = path ?? EMPTY_PATH
  if (!pathStepDone(safe, 1)) return 1
  if (!pathStepDone(safe, 2)) return 2
  return null
}

/** "Step 2 of 2 · Quiz", "Not started" or "Learned". */
export function stepLine(path: PathState | undefined): string {
  const next = nextStep(path)
  if (next === null) return t("learn.step.learned")
  if (songStatus(path) === "notStarted") return t("learn.step.notStarted")
  return t("learn.step.line2", { n: next, name: HUB_STEPS[next - 1]!.label })
}

/**
 * Where "Go" opens for a song. Words: the word cards of that song. Quiz: the quiz of that song.
 * A song without checked words (`wordsReady` false) opens its own page instead, which says "Words coming soon".
 */
export function nextStepHref(songId: string, songNumber: number, path: PathState | undefined, wordsReady = true): string {
  if (!wordsReady) return songPathHref(songId)
  const next = nextStep(path)
  if (next === 1) return wordsHref({ song: songNumber })
  if (next === 2) return quizHref({ song: songNumber })
  return songPathHref(songId)
}

export type HubSong = {
  songId: string
  number: number
  title: string
  path: PathState
  /** true when the song is on the learner's list; suggestions are not */
  listed: boolean
}

export type ShelfEntry = HubSong & { state: SongStatus }

/** Closest to finished first, then the song started last. */
function byProgress(paths: Readonly<Record<string, PathState>>) {
  return (a: LearningSong, b: LearningSong) =>
    pathDoneCount(paths[b.songId]) - pathDoneCount(paths[a.songId]) || b.startedAt - a.startedAt
}

function toHubSong(song: LearningSong, paths: Readonly<Record<string, PathState>>): HubSong {
  return { songId: song.songId, number: song.number, title: song.title, path: paths[song.songId] ?? EMPTY_PATH, listed: true }
}

/** Songs the learner has begun but not finished (Learning: one of Words and Quiz done), best first. */
export function songsInProgress(songs: readonly LearningSong[], paths: Readonly<Record<string, PathState>>): HubSong[] {
  return songs
    .filter((song) => songStatus(paths[song.songId]) === "learning")
    .sort(byProgress(paths))
    .map((song) => toHubSong(song, paths))
}

/** The song the "Continue" card shows, or null when nothing is in progress. */
export function pickContinue(songs: readonly LearningSong[], paths: Readonly<Record<string, PathState>>): HubSong | null {
  return songsInProgress(songs, paths)[0] ?? null
}

/** Songs on the list with neither Words nor Quiz done, the one added last first (the song you just chose is the one in front). */
function songsNotStarted(songs: readonly LearningSong[], paths: Readonly<Record<string, PathState>>): HubSong[] {
  return songs
    .filter((song) => songStatus(paths[song.songId]) === "notStarted")
    .sort((a, b) => b.startedAt - a.startedAt)
    .map((song) => toHubSong(song, paths))
}

/** Learned songs on the list, the one started last first. */
function songsLearned(songs: readonly LearningSong[], paths: Readonly<Record<string, PathState>>): HubSong[] {
  return songs
    .filter((song) => songStatus(paths[song.songId]) === "learned")
    .sort((a, b) => b.startedAt - a.startedAt)
    .map((song) => toHubSong(song, paths))
}

/** Suggested songs that are not on the list yet. */
export function suggestedSongs(
  songs: readonly LearningSong[],
  numbers: readonly number[],
  titleOf: (number: number) => string,
): HubSong[] {
  const listed = new Set(songs.map((song) => song.number))
  return numbers
    .filter((number) => !listed.has(number))
    .map((number) => ({ songId: `ps-${number}`, number, title: titleOf(number), path: EMPTY_PATH, listed: false }))
}

/** How many songs the "I want to learn this" column shows before "Search all songs". */
export const CHOOSE_LIMIT = 4

/** The column "I want to learn this": the next few songs not on the list yet. */
export function buildChoices(
  songs: readonly LearningSong[],
  numbers: readonly number[],
  titleOf: (number: number) => string,
  limit = CHOOSE_LIMIT,
): HubSong[] {
  return suggestedSongs(songs, numbers, titleOf).slice(0, limit)
}

/**
 * "My songs": the songs on the learner's list only. Learning first, then Not started, then Learned.
 * Suggestions are not here, they live in the "I want to learn this" column.
 */
export function buildShelf(songs: readonly LearningSong[], paths: Readonly<Record<string, PathState>>): ShelfEntry[] {
  return [
    ...songsInProgress(songs, paths).map((song): ShelfEntry => ({ ...song, state: "learning" })),
    ...songsNotStarted(songs, paths).map((song): ShelfEntry => ({ ...song, state: "notStarted" })),
    ...songsLearned(songs, paths).map((song): ShelfEntry => ({ ...song, state: "learned" })),
  ]
}

export type ContinueModel =
  | { kind: "continue"; song: HubSong; step: PathStep; href: string }
  | { kind: "start"; song: HubSong; first: boolean; href: string }
  | { kind: "none" }

/**
 * What the big card says. A song in progress: continue it at its next step. Otherwise offer a
 * song to start (one already on the list, else a suggestion); `first` is true when the learner
 * has not learned any song yet.
 */
export function buildContinue(
  songs: readonly LearningSong[],
  paths: Readonly<Record<string, PathState>>,
  numbers: readonly number[],
  titleOf: (number: number) => string,
  /** true when the song has checked words; without them the card opens the song page, which says "Words coming soon" */
  wordsReady: (songNumber: number) => boolean = () => true,
): ContinueModel {
  const current = pickContinue(songs, paths)
  if (current) {
    const step = nextStep(current.path) ?? 2
    return { kind: "continue", song: current, step, href: nextStepHref(current.songId, current.number, current.path, wordsReady(current.number)) }
  }
  const candidate = songsNotStarted(songs, paths)[0] ?? suggestedSongs(songs, numbers, titleOf)[0]
  if (!candidate) return { kind: "none" }
  const anyLearned = songs.some((song) => songStatus(paths[song.songId]) === "learned")
  return { kind: "start", song: candidate, first: !anyLearned, href: songPathHref(candidate.songId) }
}

/** "3 songs learned · 2 learning · 6 words". `learning` counts the songs with one of Words and Quiz done. */
export function statsLine(learned: number, learning: number, words: number): string {
  return [t("learn.songsLearned", { count: learned }), t("learn.learning", { count: learning }), t("learn.words", { count: words })].join(" · ")
}

/** Under "Word cards": "2 due", "All done", or an invitation while there are no cards yet. */
export function wordCardsSubtitle(due: number, hasCards: boolean): string {
  if (due > 0) return t("learn.due", { count: due })
  return hasCards ? t("learn.allDone") : t("learn.startWith10")
}

/** Under "Quiz": "Level 1 · Know the words". */
export function quizSubtitle(level: LearnQuizLevel): string {
  return t("learn.level", { level, title: QUIZ_LEVELS.find((entry) => entry.level === level)?.title ?? "" }).trimEnd()
}

export function quizTarget(level: LearnQuizLevel): string {
  return quizHref({ level })
}
