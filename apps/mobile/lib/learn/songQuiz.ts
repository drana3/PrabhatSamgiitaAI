import {
  MIN_WORDS_FOR_QUIZ,
  QUIZ_LENGTH,
  buildWordQuiz,
  passMarkFor,
  type LearnQuizQuestion,
} from "@/lib/learn/quiz"
import type { SongFacts } from "@/lib/learn/songStatus"
import { wordsForSong, type LearnWord } from "@/lib/learn/words"

/**
 * The quiz of one song (the "Quiz" step inside a song): five questions "what does this word mean",
 * made from the words of that song only, pass mark 70 per cent (4 of 5). The rule itself lives in
 * lib/learn/quiz.ts (`passMarkFor`, `buildWordQuiz`); this file only fixes the song-sized numbers
 * and says when a song has too few words to ask anything.
 */

/** Questions in a song quiz. */
export const SONG_QUIZ_LENGTH = 5

/** How many words of the song have a different meaning from every other (the quiz needs four). */
export function distinctMeaningCount(words: readonly LearnWord[]): number {
  return new Set(words.map((word) => word.meaning.trim().toLowerCase())).size
}

/**
 * The questions of one attempt. Empty when the song has fewer than four different meanings:
 * the screen then says "Quiz needs more words" instead of making up filler questions.
 * A new `attempt` number gives a new draw.
 */
export function songQuizQuestions(words: readonly LearnWord[], songNumber: number, attempt = 1): LearnQuizQuestion[] {
  return buildWordQuiz(wordsForSong(words, songNumber), { count: SONG_QUIZ_LENGTH, seed: attempt * 7919 + songNumber })
}

/** Pass mark of a song quiz with this many questions (4 of 5). */
export function songQuizPassMark(total: number): number {
  return passMarkFor(total)
}

/** Questions of the all-words quiz in Practice: ten, pass mark 7. Empty with fewer than four different meanings. */
export function allWordsQuizQuestions(words: readonly LearnWord[], attempt = 1): LearnQuizQuestion[] {
  return buildWordQuiz(words, { count: QUIZ_LENGTH, seed: attempt * 104729 })
}

/** What the step cards need to know about a song: how many words, how many meanings, whether it has chords. */
export function songFactsFor(words: readonly LearnWord[], songNumber: number, hasChords: boolean | null): SongFacts {
  const own = wordsForSong(words, songNumber)
  return {
    wordCount: own.length,
    distinctMeanings: distinctMeaningCount(own),
    hasChords,
    minDistinct: MIN_WORDS_FOR_QUIZ,
  }
}
