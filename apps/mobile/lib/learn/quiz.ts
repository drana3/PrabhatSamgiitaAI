import type { LearnWord } from "@/lib/learn/words"
import { t } from "@/lib/i18n"

/** Real quiz: 10 questions, pass mark 7 (spec SCR-15). */
export const QUIZ_LENGTH = 10
export const QUIZ_PASS_MARK = 7
export const QUIZ_PASS_FRACTION = QUIZ_PASS_MARK / QUIZ_LENGTH

export type LearnQuizLevel = 1 | 2 | 3

export const QUIZ_LEVELS: ReadonlyArray<{ level: LearnQuizLevel; title: string; unlockRule: string }> = [
  { level: 1, get title() { return t("learn.quiz.l1") }, get unlockRule() { return t("learn.quiz.unlock1") } },
  { level: 2, get title() { return t("learn.quiz.l2") }, get unlockRule() { return t("learn.quiz.unlock2") } },
  { level: 3, get title() { return t("learn.quiz.l3") }, get unlockRule() { return t("learn.quiz.unlock3") } },
]

export type QuizOption = { id: string; text: string }

export type LearnQuizQuestion = {
  id: string
  prompt: string
  options: QuizOption[]
  correctOptionId: string
  explanation: string
}

export type QuizScore = {
  score: number
  total: number
  passMark: number
  passed: boolean
  unanswered: number
  missedQuestionIds: string[]
}

/** 7 of 10 in the real quiz; for a shorter song quiz the same 70% rule, rounded up. */
export function passMarkFor(total: number): number {
  if (total <= 0) return 0
  if (total === QUIZ_LENGTH) return QUIZ_PASS_MARK
  return Math.max(1, Math.ceil(total * QUIZ_PASS_FRACTION))
}

/** Score a finished attempt. A missing answer counts as wrong. */
export function scoreQuiz(
  questions: readonly LearnQuizQuestion[],
  answers: Readonly<Record<string, string | undefined>>,
  passMark = passMarkFor(questions.length),
): QuizScore {
  let score = 0
  let unanswered = 0
  const missedQuestionIds: string[] = []
  for (const question of questions) {
    const picked = answers[question.id]
    if (!picked) {
      unanswered += 1
      missedQuestionIds.push(question.id)
    } else if (picked === question.correctOptionId) {
      score += 1
    } else {
      missedQuestionIds.push(question.id)
    }
  }
  return {
    score,
    total: questions.length,
    passMark,
    passed: questions.length > 0 && score >= passMark,
    unanswered,
    missedQuestionIds,
  }
}

/** The one line shown under the answers after a pick. */
export function answerFeedback(question: LearnQuizQuestion, pickedOptionId: string): string {
  if (pickedOptionId === question.correctOptionId) {
    return question.explanation ? `Right. ${question.explanation}` : "Right."
  }
  const correct = question.options.find((option) => option.id === question.correctOptionId)
  return `Not quite. The answer is ${correct?.text ?? "above"}.${question.explanation ? ` ${question.explanation}` : ""}`
}

export type QuizResultView = {
  headline: string
  message: string
}

export function resultMessage(result: QuizScore): QuizResultView {
  const headline = `${result.score} of ${result.total}`
  if (result.total === 0) return { headline, message: "There are no questions to ask yet." }
  if (result.passed) {
    return { headline, message: `Passed. The pass mark is ${result.passMark} of ${result.total}.` }
  }
  const missing = result.passMark - result.score
  return {
    headline,
    message: `Not yet. You need ${result.passMark} of ${result.total}, ${missing} more right. Read the words again and try once more.`,
  }
}

// ---------------------------------------------------------------------------
// Level 1: Know the words, built from the word deck
// ---------------------------------------------------------------------------

/** Small seeded generator so the same seed gives the same quiz (testable). */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j]!, copy[i]!]
  }
  return copy
}

/** Smallest deck that can make a four-answer question with distinct meanings. */
export const MIN_WORDS_FOR_QUIZ = 4

/**
 * "What does Bandhu mean?" with the right meaning and three others from the
 * deck. Returns [] when the deck has fewer than four distinct meanings.
 */
export function buildWordQuiz(
  words: readonly LearnWord[],
  options: { count?: number; seed?: number } = {},
): LearnQuizQuestion[] {
  const random = seededRandom(options.seed ?? 1)
  const unique: LearnWord[] = []
  const meanings = new Set<string>()
  for (const word of words) {
    const key = word.meaning.trim().toLowerCase()
    if (meanings.has(key)) continue
    meanings.add(key)
    unique.push(word)
  }
  if (unique.length < MIN_WORDS_FOR_QUIZ) return []

  const count = Math.min(options.count ?? QUIZ_LENGTH, unique.length)
  const chosen = shuffled(unique, random).slice(0, count)
  return chosen.map((word) => {
    const distractors = shuffled(
      unique.filter((other) => other.id !== word.id),
      random,
    ).slice(0, 3)
    const answerOptions = shuffled([word, ...distractors], random).map((entry) => ({
      id: entry.id,
      text: entry.meaning,
    }))
    return {
      id: `w-${word.id}`,
      prompt: `What does ${word.roman} mean?`,
      options: answerOptions,
      correctOptionId: word.id,
      explanation: `${word.roman} means ${word.meaning}, from PS ${word.songNumber}.`,
    }
  })
}

// ---------------------------------------------------------------------------
// Levels, unlock rule and best results
// ---------------------------------------------------------------------------

export type QuizBest = { score: number; total: number; passed: boolean; at: number }
export type QuizBestMap = Partial<Record<LearnQuizLevel, QuizBest>>

export type LevelStatus = { level: LearnQuizLevel; title: string; open: boolean; passed: boolean; unlockRule: string }

export function levelStatuses(best: QuizBestMap): LevelStatus[] {
  return QUIZ_LEVELS.map(({ level, title, unlockRule }) => {
    const previous = level === 1 ? null : best[(level - 1) as LearnQuizLevel]
    return {
      level,
      title,
      unlockRule,
      open: level === 1 || Boolean(previous?.passed),
      passed: Boolean(best[level]?.passed),
    }
  })
}

/** Keep the better of two results; a pass is never replaced by a fail. */
export function mergeBest(previous: QuizBest | undefined, next: QuizBest): QuizBest {
  if (!previous) return next
  if (previous.passed && !next.passed) return previous
  if (next.passed && !previous.passed) return next
  return next.score >= previous.score ? next : previous
}
