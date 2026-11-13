import { SAMPLE_LEARN_WORDS } from "@/data/learnWords"
import type { LearnWord } from "@/lib/learn/words"
import { MOCKUP_DATA } from "@/lib/mockupMode"

/**
 * The word meanings (data/learnWords.ts, songs PS 1-7 only) and the quiz questions (lib/fixtures/learn.ts)
 * come from the design prototype. Nobody has checked them against the songs, so a real build must not
 * teach them as fact, record progress against them or remind people to review them.
 *
 * Flip this to true only when the word list has been reviewed. Until then Word cards, the Quiz and the
 * "word of the day" are replaced by an honest "being checked" state, and reminders ignore stored cards.
 * The preview (MOCKUP_DATA) always shows them, because it exists to compare with the prototype.
 */
export const LEARN_WORDS_VERIFIED = false

const NO_WORDS: readonly LearnWord[] = []

export function learnWordsAvailable(): boolean {
  return MOCKUP_DATA || LEARN_WORDS_VERIFIED
}

/** The words every Learn screen may use: the full list when verified or in the preview, nothing otherwise. */
export function learnWordList(): readonly LearnWord[] {
  return learnWordsAvailable() ? SAMPLE_LEARN_WORDS : NO_WORDS
}
