import {
  EMPTY_PATH,
  pathDoneCount,
  pathStarted,
  pathStepDone,
  type LearningSong,
  type PathState,
  type PathStep,
} from "@/lib/learn/progress"
import { LEARN_ROUTES, quizHref, songPathHref, wordsHref } from "@/lib/learn/routes"
import { QUIZ_LEVELS, type LearnQuizLevel } from "@/lib/learn/quiz"

/**
 * Logic of the Learn hub (the Learn tab): which song to continue, what the next step is
 * and where its button goes, the order of the song shelf, and the short texts of the page.
 * Pure functions, no React, so the page stays thin and the rules are tested.
 */

/** The page, top to bottom. The header and the heading above these are fixed. */
export const HUB_SECTION_ORDER = ["continue", "songs", "practice", "play", "explore"] as const
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
  certificates: LEARN_ROUTES.liveQuiz,
} as const

/**
 * The three steps of a song, named for the bars. They are the steps of the song path
 * (hear it, learn what it means through its words, play it).
 */
export const HUB_STEPS = [
  { step: 1, key: "hear", label: "Hear" },
  { step: 2, key: "words", label: "Words" },
  { step: 3, key: "play", label: "Play" },
] as const satisfies ReadonlyArray<{ step: PathStep; key: string; label: string }>

export type StepBar = { step: PathStep; label: string; done: boolean }

/** Three bars for one song: which steps are done. */
export function songStepBars(path: PathState | undefined): StepBar[] {
  const safe = path ?? EMPTY_PATH
  return HUB_STEPS.map((meta) => ({ step: meta.step, label: meta.label, done: pathStepDone(safe, meta.step) }))
}

/** The first step that is not done yet, or null when all three are. Steps can be done in any order. */
export function nextStep(path: PathState | undefined): PathStep | null {
  const safe = path ?? EMPTY_PATH
  for (const meta of HUB_STEPS) if (!pathStepDone(safe, meta.step)) return meta.step
  return null
}

/** "Step 2 of 3 · Words", "Not started" or "All three steps done". */
export function stepLine(path: PathState | undefined): string {
  const next = nextStep(path)
  if (next === null) return "All three steps done"
  if (!pathStarted(path)) return "Not started"
  return `Step ${next} of 3 · ${HUB_STEPS[next - 1]!.label}`
}

/**
 * Where "Go" opens for a song: the word cards of that song for the words step, otherwise the
 * song path (its step cards do the hearing and the chords, they also put the song on the list).
 */
export function nextStepHref(songId: string, songNumber: number, path: PathState | undefined): string {
  return nextStep(path) === 2 ? wordsHref({ song: songNumber }) : songPathHref(songId)
}

export type HubSong = {
  songId: string
  number: number
  title: string
  path: PathState
  /** true when the song is on the learner's list; suggestions are not */
  listed: boolean
}

export type ShelfEntry = HubSong & { state: "learning" | "notStarted" }

/** Closest to finished first, then the song started last. */
function byProgress(paths: Readonly<Record<string, PathState>>) {
  return (a: LearningSong, b: LearningSong) =>
    pathDoneCount(paths[b.songId]) - pathDoneCount(paths[a.songId]) || b.startedAt - a.startedAt
}

function toHubSong(song: LearningSong, paths: Readonly<Record<string, PathState>>): HubSong {
  return { songId: song.songId, number: song.number, title: song.title, path: paths[song.songId] ?? EMPTY_PATH, listed: true }
}

/** Songs the learner has begun but not finished, best first. */
export function songsInProgress(songs: readonly LearningSong[], paths: Readonly<Record<string, PathState>>): HubSong[] {
  return songs
    .filter((song) => pathStarted(paths[song.songId]) && pathDoneCount(paths[song.songId]) < 3)
    .sort(byProgress(paths))
    .map((song) => toHubSong(song, paths))
}

/** The song the "Continue" card shows, or null when nothing is in progress. */
export function pickContinue(songs: readonly LearningSong[], paths: Readonly<Record<string, PathState>>): HubSong | null {
  return songsInProgress(songs, paths)[0] ?? null
}

/** Songs on the list with no step done yet, in the order they were added. */
function songsNotStarted(songs: readonly LearningSong[], paths: Readonly<Record<string, PathState>>): HubSong[] {
  return songs
    .filter((song) => !pathStarted(paths[song.songId]))
    .sort((a, b) => a.startedAt - b.startedAt)
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

/**
 * The "Learn a song" shelf: songs in progress first, then songs not started (on the list, then
 * suggestions). Learned songs are left out, they live under "See all". Never empty while
 * there are suggestions.
 */
export function buildShelf(
  songs: readonly LearningSong[],
  paths: Readonly<Record<string, PathState>>,
  numbers: readonly number[],
  titleOf: (number: number) => string,
): ShelfEntry[] {
  return [
    ...songsInProgress(songs, paths).map((song): ShelfEntry => ({ ...song, state: "learning" })),
    ...songsNotStarted(songs, paths).map((song): ShelfEntry => ({ ...song, state: "notStarted" })),
    ...suggestedSongs(songs, numbers, titleOf).map((song): ShelfEntry => ({ ...song, state: "notStarted" })),
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
): ContinueModel {
  const current = pickContinue(songs, paths)
  if (current) {
    const step = nextStep(current.path) ?? 3
    return { kind: "continue", song: current, step, href: nextStepHref(current.songId, current.number, current.path) }
  }
  const candidate = songsNotStarted(songs, paths)[0] ?? suggestedSongs(songs, numbers, titleOf)[0]
  if (!candidate) return { kind: "none" }
  const anyLearned = songs.some((song) => pathDoneCount(paths[song.songId]) === 3)
  return { kind: "start", song: candidate, first: !anyLearned, href: songPathHref(candidate.songId) }
}

/** "3 songs learned · 2 learning · 6 words". */
export function statsLine(learned: number, learning: number, words: number): string {
  const songs = `${learned} ${learned === 1 ? "song" : "songs"} learned`
  const now = `${learning} learning`
  const w = `${words} ${words === 1 ? "word" : "words"}`
  return `${songs} · ${now} · ${w}`
}

/** Under "Word cards": "2 due", "All done", or an invitation while there are no cards yet. */
export function wordCardsSubtitle(due: number, hasCards: boolean): string {
  if (due > 0) return `${due} due`
  return hasCards ? "All done" : "Start with 10 words"
}

/** Under "Quiz": "Level 1 · Know the words". */
export function quizSubtitle(level: LearnQuizLevel): string {
  return `Level ${level} · ${QUIZ_LEVELS.find((entry) => entry.level === level)?.title ?? ""}`.trimEnd()
}

export function quizTarget(level: LearnQuizLevel): string {
  return quizHref({ level })
}
