import { dueCardCount, endOfLocalDay, wordsLearnedCount, type WordCard } from "@/lib/learn/srs"
import type { LearnQuizLevel, QuizBestMap } from "@/lib/learn/quiz"
import { QUIZ_LEVELS, levelStatuses } from "@/lib/learn/quiz"

/** A song the learner started to learn (spec SCR-21, "Learning now"). */
export type LearningSong = {
  songId: string
  number: number
  title: string
  startedAt: number
}

/**
 * Per song, what has been done (API-13: lpath). Step 1 is listen + words,
 * step 2 is meaning (the short quiz), step 3 is chords and playing.
 */
export type PathState = {
  listen: boolean
  words: boolean
  meaning: boolean
  chords: boolean
}

export type PathPart = keyof PathState
export type PathStep = 1 | 2 | 3

export const EMPTY_PATH: PathState = { listen: false, words: false, meaning: false, chords: false }

export function pathStepDone(path: PathState, step: PathStep): boolean {
  if (step === 1) return path.listen && path.words
  if (step === 2) return path.meaning
  return path.chords
}

/** 0 to 3: how many of the three steps are done. */
export function pathDoneCount(path: PathState | undefined): number {
  if (!path) return 0
  return ([1, 2, 3] as const).filter((step) => pathStepDone(path, step)).length
}

/** True once anything on the path has been done, even half of step 1. */
export function pathStarted(path: PathState | undefined): boolean {
  return Boolean(path && (path.listen || path.words || path.meaning || path.chords))
}

export function isSongLearned(path: PathState | undefined): boolean {
  return pathDoneCount(path) === 3
}

/** The three dots on a "Learning now" row. */
export function pathDots(path: PathState | undefined): [boolean, boolean, boolean] {
  const safe = path ?? EMPTY_PATH
  return [pathStepDone(safe, 1), pathStepDone(safe, 2), pathStepDone(safe, 3)]
}

export type SongLibraryState = "learned" | "learning" | "notStarted"

export function songLibraryState(path: PathState | undefined): SongLibraryState {
  if (pathDoneCount(path) === 3) return "learned"
  return pathStarted(path) ? "learning" : "notStarted"
}

/** Set one part of a path done; returns a new map. */
export function markPathPart(
  paths: Readonly<Record<string, PathState>>,
  songId: string,
  part: PathPart,
): Record<string, PathState> {
  const current = paths[songId] ?? EMPTY_PATH
  return { ...paths, [songId]: { ...current, [part]: true } }
}

export type LearnProgress = {
  /** songs with at least one step done */
  studied: number
  /** songs on the learning list */
  total: number
  wordsLearned: number
  /** 0 to 1 for the progress bar */
  fraction: number
}

/**
 * "4 of 10 songs studied. 6 words learned." A song counts as studied once
 * anything on its path is done (even the listen pass alone); the total is the songs on the learning list.
 */
export function learnProgress(
  songs: readonly LearningSong[],
  paths: Readonly<Record<string, PathState>>,
  cards: Readonly<Record<string, WordCard>>,
): LearnProgress {
  const total = songs.length
  const studied = songs.filter((song) => pathStarted(paths[song.songId])).length
  return {
    studied,
    total,
    wordsLearned: wordsLearnedCount(cards),
    fraction: total === 0 ? 0 : studied / total,
  }
}

export function progressLine(progress: LearnProgress): string {
  const songs = `${progress.studied} of ${progress.total} ${progress.total === 1 ? "song" : "songs"} studied.`
  const words = `${progress.wordsLearned} ${progress.wordsLearned === 1 ? "word" : "words"} learned.`
  return `${songs} ${words}`
}

/** Name for the progress card: the highest quiz level the learner has open. */
export function levelName(best: QuizBestMap): string {
  const open = levelStatuses(best).filter((status) => status.open)
  const top = open[open.length - 1] ?? levelStatuses(best)[0]!
  return `Level ${top.level} · ${top.title}`
}

export function nextOpenQuizLevel(best: QuizBestMap): LearnQuizLevel {
  const open = levelStatuses(best).filter((status) => status.open && !status.passed)
  return open[0]?.level ?? (QUIZ_LEVELS[QUIZ_LEVELS.length - 1]!.level as LearnQuizLevel)
}

export type PracticeSummary = {
  dueWords: number
  songsInProgress: number
  headline: string
  detail: string
}

/** The "Today's practice" card: word cards that are due and songs to continue. */
export function practiceSummary(
  songs: readonly LearningSong[],
  paths: Readonly<Record<string, PathState>>,
  cards: Readonly<Record<string, WordCard>>,
  now: number,
): PracticeSummary {
  const dueWords = dueCardCount(cards, now)
  const songsInProgress = songs.filter((song) => pathDoneCount(paths[song.songId]) < 3).length
  const things = dueWords + songsInProgress
  const headline = things === 0 ? "Nothing to repeat" : `${things} ${things === 1 ? "thing" : "things"} to repeat`
  const parts: string[] = []
  if (dueWords > 0) parts.push(`${dueWords} word ${dueWords === 1 ? "card" : "cards"}`)
  if (songsInProgress > 0) parts.push(`${songsInProgress} ${songsInProgress === 1 ? "song" : "songs"} to continue`)
  const detail = parts.length ? parts.join(" and ") : "Start a song from Songs, or open the word cards."
  return { dueWords, songsInProgress, headline, detail }
}

/** Step 1 needs every word of the song graded at least once (SCR-21). */
export function songWordsComplete(
  wordIds: readonly string[],
  cards: Readonly<Record<string, WordCard>>,
): boolean {
  return wordIds.length > 0 && wordIds.every((id) => (cards[id]?.reps ?? 0) >= 1)
}

/** Song numbers that have at least one word card due by the end of today. */
export function songsWithDueWords(
  words: ReadonlyArray<{ id: string; songNumber: number }>,
  cards: Readonly<Record<string, WordCard>>,
  now: number,
): Set<number> {
  const end = endOfLocalDay(now)
  const result = new Set<number>()
  for (const word of words) {
    const card = cards[word.id]
    if (card && card.status !== "new" && card.dueAt <= end) result.add(word.songNumber)
  }
  return result
}
