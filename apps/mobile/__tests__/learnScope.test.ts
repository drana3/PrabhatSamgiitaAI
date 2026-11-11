import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@react-native-async-storage/async-storage", () => {
  const memory = new Map<string, string>()
  return {
    default: {
      getItem: async (key: string) => memory.get(key) ?? null,
      setItem: async (key: string, value: string) => {
        memory.set(key, value)
      },
      removeItem: async (key: string) => {
        memory.delete(key)
      },
    },
  }
})

import { SAMPLE_LEARN_WORDS } from "@/data/learnWords"
import { PS_SONG_COUNT } from "@/lib/learn/learnSongs"
import {
  DEFAULT_SCOPE,
  clearChosenSongs,
  cleanNumbers,
  mineNumbers,
  modeUsesPicker,
  normalizeScope,
  numbersWithWords,
  pickOneSong,
  pickedNumbers,
  scopeRecordsQuizLevel,
  scopeSongNumbers,
  scopeSummary,
  scopeWords,
  toggleChosenSong,
  withMode,
  type StudyScope,
} from "@/lib/learn/scope"
import { allWordsQuizQuestions } from "@/lib/learn/songQuiz"
import type { LearnWord } from "@/lib/learn/words"
import { useLearnStore } from "@/stores/learnStore"

function word(songNumber: number, roman: string, meaning = roman): LearnWord {
  return { id: `ps${songNumber}-${roman}`, roman, devanagari: "", meaning, example: "", songNumber }
}

// songs 1 (two words), 3 (three words), 5 (one word); nothing for 2 and 100
const WORDS: LearnWord[] = [
  word(3, "c1"),
  word(1, "a1"),
  word(3, "c2"),
  word(1, "a2"),
  word(5, "e1"),
  word(3, "c3"),
]

const scope = (patch: Partial<StudyScope>): StudyScope => ({ ...DEFAULT_SCOPE, chosen: [], ...patch })

describe("normalizeScope", () => {
  it("falls back to the default for anything that is not a scope", () => {
    for (const raw of [undefined, null, 5, "mine", []]) expect(normalizeScope(raw)).toEqual(DEFAULT_SCOPE)
  })

  it("keeps a valid scope and cleans the list", () => {
    expect(normalizeScope({ mode: "chosen", song: 7, chosen: [9, 3, 3, 0, 5019, 2.5, "4", 1] })).toEqual({
      mode: "chosen",
      song: 7,
      chosen: [1, 3, 9],
    })
  })

  it("drops an unknown mode and a song outside 1..5018", () => {
    expect(normalizeScope({ mode: "weekly", song: 6000, chosen: "x" })).toEqual(DEFAULT_SCOPE)
  })

  it("does not share the default's list", () => {
    const a = normalizeScope(null)
    a.chosen.push(1)
    expect(DEFAULT_SCOPE.chosen).toEqual([])
  })
})

describe("changing the scope", () => {
  it("picks one song and switches to that mode", () => {
    const next = pickOneSong(scope({ mode: "all" }), 12)
    expect(next).toMatchObject({ mode: "song", song: 12 })
    expect(pickOneSong(next, 12)).toEqual(next)
  })

  it("ignores a number that is not a song", () => {
    const start = scope({ mode: "all" })
    expect(pickOneSong(start, 0)).toBe(start)
    expect(toggleChosenSong(start, PS_SONG_COUNT + 1)).toBe(start)
  })

  it("adds and removes chosen songs, keeping them in order and each once", () => {
    let current = scope({})
    current = toggleChosenSong(current, 9)
    current = toggleChosenSong(current, 2)
    current = toggleChosenSong(current, 5)
    expect(current).toMatchObject({ mode: "chosen", chosen: [2, 5, 9] })
    current = toggleChosenSong(current, 5)
    expect(current.chosen).toEqual([2, 9])
  })

  it("keeps what was picked when the mode changes", () => {
    const start = toggleChosenSong(pickOneSong(scope({}), 4), 8)
    const back = withMode(withMode(start, "all"), "chosen")
    expect(back).toMatchObject({ mode: "chosen", song: 4, chosen: [8] })
    expect(withMode(start, "nonsense" as never)).toEqual(start)
  })

  it("clears the chosen songs only", () => {
    const start = toggleChosenSong(pickOneSong(scope({}), 4), 8)
    expect(clearChosenSongs(start)).toMatchObject({ song: 4, chosen: [] })
  })

  it("does not change the scope it was given", () => {
    const start = scope({ chosen: [1] })
    toggleChosenSong(start, 2)
    expect(start.chosen).toEqual([1])
  })
})

describe("which songs and which words", () => {
  it("merges the list and the saved songs", () => {
    expect(mineNumbers([5, 1], [3, 1, 99999])).toEqual([1, 3, 5])
    expect(cleanNumbers([4, 4, -1])).toEqual([4])
  })

  it("names the songs of each mode; all has no list", () => {
    const mine = [1, 3]
    expect(scopeSongNumbers(scope({ mode: "song", song: 5 }), mine)).toEqual([5])
    expect(scopeSongNumbers(scope({ mode: "song", song: null }), mine)).toEqual([])
    expect(scopeSongNumbers(scope({ mode: "chosen", chosen: [3, 5] }), mine)).toEqual([3, 5])
    expect(scopeSongNumbers(scope({ mode: "mine" }), mine)).toEqual([1, 3])
    expect(scopeSongNumbers(scope({ mode: "all" }), mine)).toBeNull()
  })

  it("takes the words of one song", () => {
    expect(scopeWords(scope({ mode: "song", song: 3 }), WORDS, []).map((w) => w.roman)).toEqual(["c1", "c2", "c3"])
  })

  it("takes the words of the chosen songs in song order, each once", () => {
    const words = scopeWords(scope({ mode: "chosen", chosen: [5, 1] }), WORDS, [])
    expect(words.map((w) => w.roman)).toEqual(["a1", "a2", "e1"])
  })

  it("takes the words of my songs", () => {
    expect(scopeWords(scope({ mode: "mine" }), WORDS, [3, 100]).map((w) => w.roman)).toEqual(["c1", "c2", "c3"])
  })

  it("takes every word for all, in song order", () => {
    const words = scopeWords(scope({ mode: "all" }), WORDS, [])
    expect(words).toHaveLength(WORDS.length)
    expect(words.map((w) => w.songNumber)).toEqual([1, 1, 3, 3, 3, 5])
  })

  it("does not fall back to the whole deck when the scope has no words", () => {
    expect(scopeWords(scope({ mode: "chosen", chosen: [2, 100] }), WORDS, [])).toEqual([])
    expect(scopeWords(scope({ mode: "mine" }), WORDS, [])).toEqual([])
    expect(scopeWords(scope({ mode: "song", song: null }), WORDS, [])).toEqual([])
  })
})

describe("the deck line", () => {
  it("counts songs, songs with words and words", () => {
    expect(scopeSummary(scope({ mode: "chosen", chosen: [1, 2, 3] }), WORDS, [], PS_SONG_COUNT)).toEqual({
      mode: "chosen",
      songs: 3,
      songsWithWords: 2,
      words: 5,
    })
  })

  it("counts the whole collection for all, but only the songs that have words", () => {
    expect(scopeSummary(scope({ mode: "all" }), WORDS, [], PS_SONG_COUNT)).toEqual({
      mode: "all",
      songs: PS_SONG_COUNT,
      songsWithWords: 3,
      words: 6,
    })
  })

  it("is empty, not padded, for songs without words", () => {
    expect(scopeSummary(scope({ mode: "chosen", chosen: [100] }), WORDS, [], PS_SONG_COUNT)).toEqual({
      mode: "chosen",
      songs: 1,
      songsWithWords: 0,
      words: 0,
    })
    expect(scopeSummary(scope({ mode: "mine" }), WORDS, [], PS_SONG_COUNT).songs).toBe(0)
  })

  it("finds the songs that have words", () => {
    expect([...numbersWithWords(WORDS)].sort((a, b) => a - b)).toEqual([1, 3, 5])
  })
})

describe("the picker", () => {
  it("shows the picked songs of a mode and nothing for the other two", () => {
    expect([...pickedNumbers(scope({ mode: "song", song: 6 }))]).toEqual([6])
    expect([...pickedNumbers(scope({ mode: "chosen", chosen: [2, 4] }))]).toEqual([2, 4])
    expect(pickedNumbers(scope({ mode: "all", chosen: [2] })).size).toBe(0)
    expect(pickedNumbers(scope({ mode: "mine", song: 3 })).size).toBe(0)
  })

  it("lists songs by hand only for one song and several songs", () => {
    expect(modeUsesPicker("song")).toBe(true)
    expect(modeUsesPicker("chosen")).toBe(true)
    expect(modeUsesPicker("mine")).toBe(false)
    expect(modeUsesPicker("all")).toBe(false)
  })

  it("lets only a broad scope count toward the quiz levels", () => {
    expect(scopeRecordsQuizLevel("all")).toBe(true)
    expect(scopeRecordsQuizLevel("mine")).toBe(true)
    expect(scopeRecordsQuizLevel("song")).toBe(false)
    expect(scopeRecordsQuizLevel("chosen")).toBe(false)
  })
})

describe("the quiz over a scope", () => {
  it("asks only about the words of the scope", () => {
    const words = scopeWords(scope({ mode: "chosen", chosen: [1, 2] }), SAMPLE_LEARN_WORDS, [])
    expect(words.length).toBeGreaterThan(0)
    const questions = allWordsQuizQuestions(words, 1)
    const ids = new Set(words.map((w) => w.id))
    expect(questions.length).toBeGreaterThan(0)
    for (const question of questions) {
      expect(ids.has(question.correctOptionId)).toBe(true)
      for (const option of question.options) expect(ids.has(option.id)).toBe(true)
    }
  })

  it("makes no question for a scope with no words", () => {
    expect(allWordsQuizQuestions(scopeWords(scope({ mode: "chosen", chosen: [4000] }), SAMPLE_LEARN_WORDS, []), 1)).toEqual([])
  })
})

describe("the stored scope", () => {
  beforeEach(() => useLearnStore.getState().resetAll())

  it("starts as my songs", () => {
    expect(useLearnStore.getState().scope).toEqual(DEFAULT_SCOPE)
  })

  it("saves a scope and cleans it on the way in", () => {
    useLearnStore.getState().setScope({ mode: "chosen", song: null, chosen: [9, 2, 2, 0] })
    expect(useLearnStore.getState().scope).toEqual({ mode: "chosen", song: null, chosen: [2, 9] })
  })

  it("is a setting of the phone: resetting the account puts it back, signing out data does not carry it", () => {
    useLearnStore.getState().setScope({ mode: "all", song: null, chosen: [] })
    useLearnStore.getState().resetAll()
    expect(useLearnStore.getState().scope).toEqual(DEFAULT_SCOPE)
  })
})
