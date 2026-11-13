import { isSongNumber } from "@/lib/learn/learnSongs"
import { wordsForSongs, type LearnWord } from "@/lib/learn/words"

/**
 * "What to study": which songs the word cards and the all-words quiz draw their words from.
 * One choice drives both. Pure functions, no React and no storage, so the rules are tested.
 *
 *  - song:   one song, picked by number
 *  - chosen: several songs picked from the whole list of 5,018
 *  - mine:   the songs on the learner's list plus the saved ones (what the cards used before this choice existed)
 *  - all:    every song that has word meanings
 *
 * The per-song steps (?song=N on the cards and the quiz) do not use this: they always take their own song.
 */

export type StudyMode = "song" | "chosen" | "mine" | "all"

export const STUDY_MODES: readonly StudyMode[] = ["song", "chosen", "mine", "all"]

export type StudyScope = {
  mode: StudyMode
  /** the song of mode "song" */
  song: number | null
  /** the songs of mode "chosen", ascending, each once */
  chosen: number[]
}

export const DEFAULT_SCOPE: StudyScope = { mode: "mine", song: null, chosen: [] }

function isMode(value: unknown): value is StudyMode {
  return typeof value === "string" && (STUDY_MODES as readonly string[]).includes(value)
}

/** Song numbers in ascending order, each once, nothing that is not a song number. */
export function cleanNumbers(values: readonly unknown[]): number[] {
  return [...new Set(values.filter(isSongNumber))].sort((a, b) => a - b)
}

/** A stored value of unknown shape (an old build, a damaged file) into a valid scope. */
export function normalizeScope(raw: unknown): StudyScope {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_SCOPE, chosen: [] }
  const value = raw as Partial<Record<keyof StudyScope, unknown>>
  return {
    mode: isMode(value.mode) ? value.mode : DEFAULT_SCOPE.mode,
    song: isSongNumber(value.song) ? value.song : null,
    chosen: Array.isArray(value.chosen) ? cleanNumbers(value.chosen) : [],
  }
}

/** Switch the mode and keep what was picked, so going back and forth loses nothing. */
export function withMode(scope: StudyScope, mode: StudyMode): StudyScope {
  return { ...scope, mode: isMode(mode) ? mode : scope.mode }
}

/** Study one song: the mode becomes "song". Tapping the same song again does not clear it. */
export function pickOneSong(scope: StudyScope, number: number): StudyScope {
  if (!isSongNumber(number)) return scope
  return { ...scope, mode: "song", song: number }
}

/** Add the song to the chosen ones, or take it off when it is there already. The mode becomes "chosen". */
export function toggleChosenSong(scope: StudyScope, number: number): StudyScope {
  if (!isSongNumber(number)) return scope
  const chosen = scope.chosen.includes(number) ? scope.chosen.filter((entry) => entry !== number) : cleanNumbers([...scope.chosen, number])
  return { ...scope, mode: "chosen", chosen }
}

export function clearChosenSongs(scope: StudyScope): StudyScope {
  return { ...scope, chosen: [] }
}

/** The songs the learner works with now: the list plus the saved ones. */
export function mineNumbers(listed: readonly number[], saved: readonly number[]): number[] {
  return cleanNumbers([...listed, ...saved])
}

/** The song numbers the scope names; null for "all" (no list, every song with words). */
export function scopeSongNumbers(scope: StudyScope, mine: readonly number[]): number[] | null {
  switch (scope.mode) {
    case "song":
      return scope.song === null ? [] : [scope.song]
    case "chosen":
      return cleanNumbers(scope.chosen)
    case "mine":
      return cleanNumbers(mine)
    case "all":
      return null
  }
}

/** The words of the scope, each once, in song order. */
export function scopeWords(scope: StudyScope, all: readonly LearnWord[], mine: readonly number[]): LearnWord[] {
  const numbers = scopeSongNumbers(scope, mine)
  if (numbers === null) return [...all].sort((a, b) => a.songNumber - b.songNumber)
  return wordsForSongs(all, numbers)
}

export type ScopeSummary = {
  mode: StudyMode
  /** how many songs the scope names (for "all": every song of the collection) */
  songs: number
  /** how many of them have word meanings */
  songsWithWords: number
  words: number
}

export function scopeSummary(scope: StudyScope, all: readonly LearnWord[], mine: readonly number[], collectionSize: number): ScopeSummary {
  const numbers = scopeSongNumbers(scope, mine)
  const words = scopeWords(scope, all, mine)
  const withWords = new Set(words.map((word) => word.songNumber)).size
  return {
    mode: scope.mode,
    songs: numbers === null ? collectionSize : numbers.length,
    songsWithWords: withWords,
    words: words.length,
  }
}

/** Song numbers that have at least one word meaning: what "With words" in the picker keeps. */
export function numbersWithWords(all: readonly LearnWord[]): Set<number> {
  return new Set(all.map((word) => word.songNumber))
}

/**
 * Songs that are picked in the picker for this mode: one song, or the chosen ones.
 * Empty for "mine" and "all" (nothing to pick by hand).
 */
export function pickedNumbers(scope: StudyScope): Set<number> {
  if (scope.mode === "song") return new Set(scope.song === null ? [] : [scope.song])
  if (scope.mode === "chosen") return new Set(scope.chosen)
  return new Set()
}

/** Whether the picker list is shown for this mode. */
export function modeUsesPicker(mode: StudyMode): boolean {
  return mode === "song" || mode === "chosen"
}

/**
 * The quiz result of a scope counts toward the quiz levels only when the scope is broad: a quiz over
 * one song or a handful of chosen songs must not open the next level.
 */
export function scopeRecordsQuizLevel(mode: StudyMode): boolean {
  return mode === "mine" || mode === "all"
}
