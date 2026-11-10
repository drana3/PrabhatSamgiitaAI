import { describe, expect, it } from "vitest"

import {
  EMPTY_PATH,
  isSongLearned,
  learnProgress,
  levelName,
  markPathPart,
  nextOpenQuizLevel,
  pathDoneCount,
  pathDots,
  pathStepDone,
  practiceSummary,
  songWordsComplete,
  songsWithDueWords,
  progressLine,
  songLibraryState,
  type LearningSong,
  type PathState,
} from "@/lib/learn/progress"
import { DAY, newCard, type WordCard } from "@/lib/learn/srs"
import { SAMPLE_LEARN_WORDS } from "@/data/learnWords"
import { pickDeck, songNumbersFromIds, wordOfTheDay, wordsForSong, wordsForSongs } from "@/lib/learn/words"

const NOW = new Date(2026, 10, 3, 9, 0, 0).getTime()

function song(number: number): LearningSong {
  return { songId: `ps-${number}`, number, title: `Song ${number}`, startedAt: NOW }
}

function path(p: Partial<PathState>): PathState {
  return { ...EMPTY_PATH, ...p }
}

function learned(id: string): WordCard {
  return { ...newCard(id, NOW), status: "review", intervalDays: 3, dueAt: NOW + 3 * DAY }
}

describe("song path steps", () => {
  it("each step has its own part: Words, Quiz (stored as meaning), Chords; Listen is not a step", () => {
    expect(pathStepDone(path({ words: true }), 1)).toBe(true)
    expect(pathStepDone(path({ listen: true }), 1)).toBe(false)
    expect(pathStepDone(path({ meaning: true }), 2)).toBe(true)
    expect(pathStepDone(path({ words: true }), 2)).toBe(false)
    expect(pathStepDone(path({ chords: true }), 3)).toBe(true)
  })

  it("counts only Words and Quiz, and shows three dots (the third is Chords)", () => {
    const p = path({ words: true, chords: true })
    expect(pathDoneCount(p)).toBe(1)
    expect(pathDots(p)).toEqual([true, false, true])
    expect(pathDots(undefined)).toEqual([false, false, false])
    expect(pathDoneCount(undefined)).toBe(0)
    expect(pathDoneCount(path({ listen: true, chords: true }))).toBe(0)
  })

  it("a song is learned when Words and Quiz are done, with or without Chords", () => {
    expect(isSongLearned(path({ words: true }))).toBe(false)
    expect(isSongLearned(path({ words: true, chords: true }))).toBe(false)
    expect(isSongLearned(path({ words: true, meaning: true }))).toBe(true)
    expect(isSongLearned(path({ listen: true, words: true, meaning: true, chords: true }))).toBe(true)
  })

  it("library state: not started, learning, learned", () => {
    expect(songLibraryState(undefined)).toBe("notStarted")
    expect(songLibraryState(path({ listen: true, chords: true }))).toBe("notStarted")
    expect(songLibraryState(path({ meaning: true }))).toBe("learning")
    expect(songLibraryState(path({ words: true }))).toBe("learning")
    expect(songLibraryState(path({ words: true, meaning: true }))).toBe("learned")
  })

  it("marks a part without touching other songs", () => {
    const first = markPathPart({}, "ps-1", "listen")
    const second = markPathPart(first, "ps-2", "chords")
    expect(second["ps-1"]).toEqual(path({ listen: true }))
    expect(second["ps-2"]).toEqual(path({ chords: true }))
    expect(first["ps-2"]).toBeUndefined()
  })
})

describe("song words complete", () => {
  it("is true only when every word was graded at least once", () => {
    const graded = { ...newCard("a", NOW), reps: 1 }
    expect(songWordsComplete(["a", "b"], { a: graded })).toBe(false)
    expect(songWordsComplete(["a", "b"], { a: graded, b: { ...graded, wordId: "b" } })).toBe(true)
    expect(songWordsComplete([], {})).toBe(false)
  })
})

describe("songs with due words", () => {
  it("lists the songs whose words are due, not the new ones", () => {
    const words = [
      { id: "a", songNumber: 1 },
      { id: "b", songNumber: 3 },
      { id: "c", songNumber: 5 },
    ]
    const cards: Record<string, WordCard> = {
      a: { ...learned("a"), dueAt: NOW - 1 },
      b: { ...learned("b"), dueAt: NOW + 5 * DAY },
      c: newCard("c", NOW),
    }
    expect([...songsWithDueWords(words, cards, NOW)]).toEqual([1])
  })
})

describe("progress line", () => {
  it("reads '4 of 10 songs studied. 6 words learned.'", () => {
    const songs = Array.from({ length: 10 }, (_, i) => song(i + 1))
    const paths: Record<string, PathState> = {}
    for (let i = 1; i <= 4; i += 1) paths[`ps-${i}`] = path({ words: true })
    const cards: Record<string, WordCard> = {}
    for (let i = 0; i < 6; i += 1) cards[`w${i}`] = learned(`w${i}`)
    const progress = learnProgress(songs, paths, cards)
    expect(progress).toMatchObject({ studied: 4, total: 10, wordsLearned: 6 })
    expect(progress.fraction).toBeCloseTo(0.4)
    expect(progressLine(progress)).toBe("4 of 10 songs studied. 6 words learned.")
  })

  it("uses singular forms and handles an empty library", () => {
    const one = learnProgress([song(1)], { "ps-1": path({ words: true }) }, { w: learned("w") })
    expect(progressLine(one)).toBe("1 of 1 song studied. 1 word learned.")
    const none = learnProgress([], {}, {})
    expect(none.fraction).toBe(0)
    expect(progressLine(none)).toBe("0 of 0 songs studied. 0 words learned.")
  })

  it("words that are still learning do not count as learned", () => {
    const cards = { a: { ...newCard("a", NOW), status: "learning" as const } }
    expect(learnProgress([], {}, cards).wordsLearned).toBe(0)
  })
})

describe("level name and today's practice", () => {
  const passed = { score: 8, total: 10, passed: true, at: 1 }

  it("names the highest open level", () => {
    expect(levelName({})).toBe("Level 1 · Know the words")
    expect(levelName({ 1: passed })).toBe("Level 2 · Know the meaning")
    expect(nextOpenQuizLevel({})).toBe(1)
    expect(nextOpenQuizLevel({ 1: passed })).toBe(2)
    expect(nextOpenQuizLevel({ 1: passed, 2: passed, 3: passed })).toBe(3)
  })

  it("sums due word cards and songs to sing again", () => {
    const summary = practiceSummary(2, 1)
    expect(summary).toMatchObject({ dueWords: 2, dueSongs: 1, minutes: 6 })
    expect(summary.headline).toBe("3 things to repeat")
    expect(summary.detail).toBe("2 word cards and 1 song to sing again. About 6 minutes.")
  })

  it("uses singular forms", () => {
    const summary = practiceSummary(1, 0)
    expect(summary.headline).toBe("1 thing to repeat")
    expect(summary.detail).toBe("1 word card. About 1 minute.")
  })

  it("says so when there is nothing to repeat", () => {
    const summary = practiceSummary(0, 0)
    expect(summary.headline).toBe("Nothing to repeat")
    expect(summary.minutes).toBe(0)
  })
})

describe("word decks", () => {
  it("finds the words of one song or of several, each once", () => {
    expect(wordsForSong(SAMPLE_LEARN_WORDS, 1).every((w) => w.songNumber === 1)).toBe(true)
    const both = wordsForSongs(SAMPLE_LEARN_WORDS, [3, 1, 3])
    expect(new Set(both.map((w) => w.id)).size).toBe(both.length)
    expect(both[0]!.songNumber).toBe(3)
  })

  it("falls back to the starter deck when the learner has no songs with words", () => {
    expect(pickDeck(SAMPLE_LEARN_WORDS, [])).toHaveLength(SAMPLE_LEARN_WORDS.length)
    expect(pickDeck(SAMPLE_LEARN_WORDS, [999])).toHaveLength(SAMPLE_LEARN_WORDS.length)
    expect(pickDeck(SAMPLE_LEARN_WORDS, [1]).every((w) => w.songNumber === 1)).toBe(true)
  })

  it("reads song numbers from ids", () => {
    expect(songNumbersFromIds(["ps-3", "other", "PS-12"])).toEqual([3, 12])
  })

  it("word of the day is stable within a day and changes by day", () => {
    const morning = wordOfTheDay(SAMPLE_LEARN_WORDS, new Date(2026, 10, 3, 6))
    const evening = wordOfTheDay(SAMPLE_LEARN_WORDS, new Date(2026, 10, 3, 22))
    const next = wordOfTheDay(SAMPLE_LEARN_WORDS, new Date(2026, 10, 4, 6))
    expect(morning).toEqual(evening)
    expect(next).not.toEqual(morning)
    expect(wordOfTheDay([], new Date())).toBeNull()
  })
})
