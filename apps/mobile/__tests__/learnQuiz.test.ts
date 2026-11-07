import { describe, expect, it } from "vitest"

import { SAMPLE_LEARN_WORDS } from "@/data/learnWords"
import {
  MIN_WORDS_FOR_QUIZ,
  QUIZ_LENGTH,
  QUIZ_PASS_MARK,
  answerFeedback,
  buildWordQuiz,
  levelStatuses,
  mergeBest,
  passMarkFor,
  resultMessage,
  scoreQuiz,
  type LearnQuizQuestion,
} from "@/lib/learn/quiz"
import { wordId } from "@/lib/learn/words"

function question(id: string): LearnQuizQuestion {
  return {
    id,
    prompt: id,
    options: [
      { id: "a", text: "A" },
      { id: "b", text: "B" },
    ],
    correctOptionId: "a",
    explanation: "",
  }
}

const TEN = Array.from({ length: 10 }, (_, i) => question(`q${i}`))

function answersWithRight(right: number): Record<string, string> {
  const answers: Record<string, string> = {}
  TEN.forEach((q, i) => {
    answers[q.id] = i < right ? "a" : "b"
  })
  return answers
}

describe("quiz scoring, pass mark 7 of 10", () => {
  it("uses 7 of 10 as the pass mark", () => {
    expect(QUIZ_LENGTH).toBe(10)
    expect(QUIZ_PASS_MARK).toBe(7)
    expect(passMarkFor(10)).toBe(7)
  })

  it("passes at exactly 7 and fails at 6", () => {
    expect(scoreQuiz(TEN, answersWithRight(7)).passed).toBe(true)
    expect(scoreQuiz(TEN, answersWithRight(6)).passed).toBe(false)
    expect(scoreQuiz(TEN, answersWithRight(10))).toMatchObject({ score: 10, passed: true })
    expect(scoreQuiz(TEN, answersWithRight(0))).toMatchObject({ score: 0, passed: false })
  })

  it("counts a missing answer as wrong and lists the missed questions", () => {
    const answers = answersWithRight(8)
    delete answers.q0
    const result = scoreQuiz(TEN, answers)
    expect(result.score).toBe(7)
    expect(result.unanswered).toBe(1)
    expect(result.missedQuestionIds).toEqual(["q0", "q8", "q9"])
    expect(result.passed).toBe(true)
  })

  it("scales the mark for a short song quiz (70%, rounded up)", () => {
    expect(passMarkFor(5)).toBe(4)
    expect(passMarkFor(3)).toBe(3)
    expect(passMarkFor(1)).toBe(1)
    expect(passMarkFor(0)).toBe(0)
    const three = TEN.slice(0, 3)
    expect(scoreQuiz(three, { q0: "a", q1: "a", q2: "b" }).passed).toBe(false)
    expect(scoreQuiz(three, { q0: "a", q1: "a", q2: "a" }).passed).toBe(true)
  })

  it("an empty quiz never passes", () => {
    expect(scoreQuiz([], {}).passed).toBe(false)
  })

  it("accepts an explicit pass mark", () => {
    expect(scoreQuiz(TEN, answersWithRight(5), 5).passed).toBe(true)
  })

  it("writes feedback and result messages", () => {
    expect(answerFeedback(question("q"), "a")).toMatch(/^Right/)
    expect(answerFeedback(question("q"), "b")).toBe("Not quite. The answer is A.")
    expect(resultMessage(scoreQuiz(TEN, answersWithRight(7))).message).toMatch(/^Passed/)
    const failed = resultMessage(scoreQuiz(TEN, answersWithRight(4)))
    expect(failed.headline).toBe("4 of 10")
    expect(failed.message).toContain("3 more right")
  })
})

describe("level 1 quiz from the word deck", () => {
  it("builds ten questions with four answers each and one right answer", () => {
    const quiz = buildWordQuiz(SAMPLE_LEARN_WORDS, { seed: 7 })
    expect(quiz).toHaveLength(10)
    for (const q of quiz) {
      expect(q.options).toHaveLength(4)
      expect(new Set(q.options.map((o) => o.text)).size).toBe(4)
      expect(q.options.filter((o) => o.id === q.correctOptionId)).toHaveLength(1)
    }
  })

  it("is repeatable for a seed and differs between seeds", () => {
    const a = buildWordQuiz(SAMPLE_LEARN_WORDS, { seed: 1 }).map((q) => q.id)
    const b = buildWordQuiz(SAMPLE_LEARN_WORDS, { seed: 1 }).map((q) => q.id)
    const c = buildWordQuiz(SAMPLE_LEARN_WORDS, { seed: 99 }).map((q) => q.id)
    expect(a).toEqual(b)
    expect(a).not.toEqual(c)
  })

  it("asks about each word at most once", () => {
    const ids = buildWordQuiz(SAMPLE_LEARN_WORDS, { seed: 3 }).map((q) => q.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("shrinks to the deck and refuses a deck that is too small", () => {
    const five = SAMPLE_LEARN_WORDS.slice(0, 5)
    expect(buildWordQuiz(five)).toHaveLength(5)
    expect(buildWordQuiz(SAMPLE_LEARN_WORDS.slice(0, MIN_WORDS_FOR_QUIZ - 1))).toEqual([])
  })

  it("ignores words that share a meaning", () => {
    const dup = SAMPLE_LEARN_WORDS.slice(0, 4).map((w) => ({ ...w, meaning: "same" }))
    expect(buildWordQuiz(dup)).toEqual([])
  })

  it("building a quiz from one song's words works when the song has enough", () => {
    const song1 = SAMPLE_LEARN_WORDS.filter((w) => w.songNumber === 1)
    expect(buildWordQuiz(song1).length).toBeGreaterThan(0)
  })
})

describe("levels and best results", () => {
  const passed = { score: 8, total: 10, passed: true, at: 1 }
  const failed = { score: 5, total: 10, passed: false, at: 2 }

  it("level 1 is open, 2 and 3 unlock one after another", () => {
    expect(levelStatuses({}).map((s) => s.open)).toEqual([true, false, false])
    expect(levelStatuses({ 1: failed }).map((s) => s.open)).toEqual([true, false, false])
    expect(levelStatuses({ 1: passed }).map((s) => s.open)).toEqual([true, true, false])
    expect(levelStatuses({ 1: passed, 2: passed }).map((s) => s.open)).toEqual([true, true, true])
  })

  it("every locked level says how to unlock it", () => {
    const locked = levelStatuses({}).filter((s) => !s.open)
    expect(locked).toHaveLength(2)
    for (const status of locked) expect(status.unlockRule).toMatch(/Pass level \d with 7 of 10/)
  })

  it("keeps the better result, and a pass over a fail", () => {
    expect(mergeBest(undefined, failed)).toBe(failed)
    expect(mergeBest(passed, failed)).toBe(passed)
    expect(mergeBest(failed, passed)).toBe(passed)
    expect(mergeBest({ ...passed, score: 7 }, passed).score).toBe(8)
  })
})

describe("word ids", () => {
  it("are stable and strip diacritics", () => {
    expect(wordId(1, "Álor")).toBe("ps1-alor")
    expect(wordId(1, "Jharańá")).toBe("ps1-jharana")
  })

  it("sample deck has unique ids", () => {
    const ids = SAMPLE_LEARN_WORDS.map((w) => w.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
