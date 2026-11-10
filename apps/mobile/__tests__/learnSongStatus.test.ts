import { describe, expect, it } from "vitest"

import { SAMPLE_LEARN_WORDS } from "@/data/learnWords"
import { EMPTY_PATH, type PathState } from "@/lib/learn/progress"
import { MIN_WORDS_FOR_QUIZ, scoreQuiz } from "@/lib/learn/quiz"
import {
  SONG_QUIZ_LENGTH,
  allWordsQuizQuestions,
  distinctMeaningCount,
  songFactsFor,
  songQuizPassMark,
  songQuizQuestions,
} from "@/lib/learn/songQuiz"
import { nextRequiredStep, songStatus, songStatusCounts, songSteps } from "@/lib/learn/songStatus"
import { wordsForSong } from "@/lib/learn/words"

const path = (patch: Partial<PathState>): PathState => ({ ...EMPTY_PATH, ...patch })

describe("song status: Words and Quiz decide, Chords never do", () => {
  it("Not started with nothing, or with only Listen and Chords", () => {
    expect(songStatus(undefined)).toBe("notStarted")
    expect(songStatus(EMPTY_PATH)).toBe("notStarted")
    expect(songStatus(path({ listen: true, chords: true }))).toBe("notStarted")
  })

  it("Learning when exactly one of Words and Quiz is done", () => {
    expect(songStatus(path({ words: true }))).toBe("learning")
    expect(songStatus(path({ meaning: true }))).toBe("learning")
    expect(songStatus(path({ words: true, chords: true, listen: true }))).toBe("learning")
  })

  it("Learned when Words and Quiz are done, with or without chords", () => {
    expect(songStatus(path({ words: true, meaning: true }))).toBe("learned")
    expect(songStatus(path({ words: true, meaning: true, chords: true, listen: true }))).toBe("learned")
  })

  it("does not become Learned from Chords plus one step", () => {
    expect(songStatus(path({ words: true, chords: true }))).toBe("learning")
  })
})

describe("the three counters", () => {
  it("counts the songs on the list by status", () => {
    const songs = ["ps-1", "ps-2", "ps-3", "ps-4", "ps-5", "ps-6"].map((songId) => ({ songId }))
    const paths = {
      "ps-1": path({ words: true }),
      "ps-2": path({ words: true, meaning: true }),
      "ps-3": path({ meaning: true, chords: true }),
      "ps-4": path({ words: true, meaning: true, chords: true }),
      "ps-5": path({ chords: true }),
    }
    expect(songStatusCounts(songs, paths)).toEqual({ notStarted: 2, learning: 2, learned: 2, total: 6 })
  })

  it("is all zero for an empty list, and never counts a song that is not on the list", () => {
    expect(songStatusCounts([], { "ps-9": path({ words: true, meaning: true }) })).toEqual({
      notStarted: 0,
      learning: 0,
      learned: 0,
      total: 0,
    })
  })
})

describe("the next required step", () => {
  it("is Words, then Quiz, then nothing", () => {
    expect(nextRequiredStep(undefined)).toBe("words")
    expect(nextRequiredStep(path({ chords: true }))).toBe("words")
    expect(nextRequiredStep(path({ words: true }))).toBe("quiz")
    expect(nextRequiredStep(path({ meaning: true }))).toBe("words")
    expect(nextRequiredStep(path({ words: true, meaning: true }))).toBeNull()
  })
})

describe("what each step of a song can do", () => {
  const withWords = { wordCount: 12, distinctMeanings: 12, hasChords: true, minDistinct: MIN_WORDS_FOR_QUIZ }

  it("lists Words, Quiz, Chords in that order; only Chords is optional", () => {
    const steps = songSteps(EMPTY_PATH, withWords)
    expect(steps.map((s) => s.key)).toEqual(["words", "quiz", "chords"])
    expect(steps.map((s) => s.optional)).toEqual([false, false, true])
    expect(steps.every((s) => s.availability === "ready" && !s.blocked)).toBe(true)
  })

  it("a song without checked words says 'Words coming soon' and cannot start Words or Quiz", () => {
    const steps = songSteps(EMPTY_PATH, { ...withWords, wordCount: 0, distinctMeanings: 0 })
    expect(steps[0]).toMatchObject({ availability: "wordsSoon", blocked: true })
    expect(steps[1]).toMatchObject({ availability: "quizSoon", blocked: true })
    expect(steps[2]!.blocked).toBe(false)
  })

  it("fewer than four different meanings: the Quiz needs more words, Words still work", () => {
    const steps = songSteps(EMPTY_PATH, { ...withWords, wordCount: 6, distinctMeanings: 3 })
    expect(steps[0]!.availability).toBe("ready")
    expect(steps[1]).toMatchObject({ availability: "needsMoreWords", blocked: true })
  })

  it("exactly four different meanings is enough for the Quiz", () => {
    expect(songSteps(EMPTY_PATH, { ...withWords, wordCount: 4, distinctMeanings: 4 })[1]!.availability).toBe("ready")
  })

  it("no accepted chords: the Chords step is grey 'No chords yet' and does not block learning", () => {
    const steps = songSteps(path({ words: true, meaning: true }), { ...withWords, hasChords: false })
    expect(steps[2]).toMatchObject({ availability: "noChords", blocked: true, optional: true, done: false })
    expect(songStatus(path({ words: true, meaning: true }))).toBe("learned")
  })

  it("unknown chords (offline, preview) are not claimed missing: the step stays available", () => {
    expect(songSteps(EMPTY_PATH, { ...withWords, hasChords: null })[2]!.availability).toBe("ready")
  })

  it("marks the steps that are done", () => {
    const steps = songSteps(path({ words: true, chords: true }), withWords)
    expect(steps.map((s) => s.done)).toEqual([true, false, true])
  })
})

describe("the quiz of one song", () => {
  const ps1 = wordsForSong(SAMPLE_LEARN_WORDS, 1)
  const ps3 = wordsForSong(SAMPLE_LEARN_WORDS, 3)

  it("asks five questions from the words of that song only", () => {
    const questions = songQuizQuestions(SAMPLE_LEARN_WORDS, 3)
    expect(questions).toHaveLength(SONG_QUIZ_LENGTH)
    const ids = new Set(ps3.map((word) => word.id))
    for (const question of questions) {
      expect(ids.has(question.correctOptionId)).toBe(true)
      expect(question.options).toHaveLength(4)
      for (const option of question.options) expect(ids.has(option.id)).toBe(true)
    }
  })

  it("passes at 70 per cent: 4 of 5", () => {
    const questions = songQuizQuestions(SAMPLE_LEARN_WORDS, 1)
    expect(songQuizPassMark(questions.length)).toBe(4)
    const answers = (right: number) =>
      Object.fromEntries(questions.map((q, i) => [q.id, i < right ? q.correctOptionId : "x"]))
    expect(scoreQuiz(questions, answers(4), 4).passed).toBe(true)
    expect(scoreQuiz(questions, answers(3), 4).passed).toBe(false)
  })

  it("gives no questions when the song has fewer than four different meanings", () => {
    const few = ps3.slice(0, 3)
    expect(distinctMeaningCount(few)).toBe(3)
    expect(songQuizQuestions(few, 3)).toEqual([])
    expect(songQuizQuestions(SAMPLE_LEARN_WORDS, 9)).toEqual([]) // a song with no words at all
  })

  it("counts words with the same meaning once", () => {
    const twins = ps1.slice(0, 4).map((word) => ({ ...word, meaning: "Friend" }))
    expect(distinctMeaningCount(twins)).toBe(1)
    expect(songQuizQuestions(twins, 1)).toEqual([])
  })

  it("a new attempt can draw different questions, the same attempt draws the same", () => {
    const first = songQuizQuestions(SAMPLE_LEARN_WORDS, 1, 1).map((q) => q.id)
    expect(songQuizQuestions(SAMPLE_LEARN_WORDS, 1, 1).map((q) => q.id)).toEqual(first)
  })

  it("describes the facts the step cards need", () => {
    expect(songFactsFor(SAMPLE_LEARN_WORDS, 3, true)).toMatchObject({ wordCount: ps3.length, hasChords: true, minDistinct: 4 })
    expect(songFactsFor([], 3, null)).toMatchObject({ wordCount: 0, distinctMeanings: 0, hasChords: null })
  })
})

describe("the quiz over all words (Practice)", () => {
  it("asks ten questions from every word, pass mark 7", () => {
    const questions = allWordsQuizQuestions(SAMPLE_LEARN_WORDS)
    expect(questions).toHaveLength(10)
    const songs = new Set(questions.map((q) => SAMPLE_LEARN_WORDS.find((w) => w.id === q.correctOptionId)!.songNumber))
    expect(songs.size).toBeGreaterThan(1)
  })

  it("is empty when there are no words", () => {
    expect(allWordsQuizQuestions([])).toEqual([])
  })
})
