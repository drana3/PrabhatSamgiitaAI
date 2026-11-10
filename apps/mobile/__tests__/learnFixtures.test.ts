import { describe, expect, it } from "vitest"

import { SAMPLE_LEARN_WORDS } from "@/data/learnWords"
import {
  INDEX_SUMMARY,
  SAMPLE_QUIZ,
  SAMPLE_QUIZ_PASS_MARK,
  buildLearnDemoSeed,
  indexRows,
} from "@/lib/fixtures/learn"
import { isSongLearned, learnProgress, pathDoneCount, songLibraryState } from "@/lib/learn/progress"
import { quizFeedback } from "@/lib/learn/quizFeedback"
import { scoreQuiz } from "@/lib/learn/quiz"
import { dueCardCount, wordsLearnedCount } from "@/lib/learn/srs"

const NOW = new Date(2026, 10, 3, 9, 0, 0).getTime()

describe("demo seed", () => {
  const seed = buildLearnDemoSeed(NOW)

  it("matches the prototype library: PS 2, 4, 6 learned, PS 1 and 3 in progress", () => {
    expect(seed.songs.map((s) => s.number).sort()).toEqual([1, 2, 3, 4, 6])
    for (const id of ["ps-2", "ps-4", "ps-6"]) expect(isSongLearned(seed.paths[id])).toBe(true)
    expect(songLibraryState(seed.paths["ps-1"])).toBe("learning")
    expect(songLibraryState(seed.paths["ps-3"])).toBe("learning")
    // Words is done for both, the Quiz is not; PS 3 has played the chords, which does not count
    expect(pathDoneCount(seed.paths["ps-3"])).toBe(1)
    expect(seed.paths["ps-3"]!.chords).toBe(true)
  })

  it("has six learned words and two cards due today", () => {
    expect(wordsLearnedCount(seed.cards)).toBe(6)
    expect(dueCardCount(seed.cards, NOW)).toBe(2)
  })

  it("every seeded card belongs to a word of the sample list", () => {
    const ids = new Set(SAMPLE_LEARN_WORDS.map((w) => w.id))
    for (const id of Object.keys(seed.cards)) expect(ids.has(id)).toBe(true)
  })

  it("feeds the stats strip: 3 learned, 2 learning, 6 words", () => {
    const progress = learnProgress(seed.songs, seed.paths, seed.cards)
    expect(progress.wordsLearned).toBe(6)
    expect(seed.songs.filter((s) => isSongLearned(seed.paths[s.songId]))).toHaveLength(3)
  })
})

describe("sample quiz", () => {
  it("has three questions with one right answer each", () => {
    expect(SAMPLE_QUIZ).toHaveLength(3)
    for (const q of SAMPLE_QUIZ) {
      expect(q.options).toHaveLength(4)
      expect(q.options.filter((o) => o.id === q.correctOptionId)).toHaveLength(1)
    }
  })

  it("passes at 2 of 3", () => {
    const answers = { q1: "a", q2: "c", q3: "b" }
    expect(scoreQuiz(SAMPLE_QUIZ, answers, SAMPLE_QUIZ_PASS_MARK)).toMatchObject({ score: 2, passed: true })
    expect(scoreQuiz(SAMPLE_QUIZ, { q1: "a" }, SAMPLE_QUIZ_PASS_MARK).passed).toBe(false)
  })

  it("gives the prototype feedback line", () => {
    expect(quizFeedback(SAMPLE_QUIZ[0]!, "a")).toBe("Right. Bandhu is friend. PS 1 opens with it.")
    expect(quizFeedback(SAMPLE_QUIZ[0]!, "b")).toBe("Not quite. Bandhu is friend. PS 1 opens with it.")
  })
})

describe("raga and tala index", () => {
  it("lists ragas with time of day and song count", () => {
    expect(indexRows("raga", true)).toHaveLength(INDEX_SUMMARY.ragas)
    expect(indexRows("raga", true)[0]).toEqual({ name: "Bhairavii", meta: "Morning · 14 songs" })
  })

  it("lists talas with beats and a falling placeholder count", () => {
    expect(indexRows("tala", true)).toHaveLength(INDEX_SUMMARY.talas)
    expect(indexRows("tala", true)[0]).toEqual({ name: "Keharva", meta: "8 beats · 14 songs" })
    expect(indexRows("tala", true)[5]).toEqual({ name: "Tintál", meta: "16 beats · 4 songs" })
  })
})
