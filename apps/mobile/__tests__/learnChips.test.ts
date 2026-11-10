import { describe, expect, it } from "vitest"

import { classifyLearnSongs } from "@/lib/learn/learnChips"
import type { LearningSong, PathState } from "@/lib/learn/progress"

const song = (number: number, startedAt: number): LearningSong => ({
  songId: `ps-${number}`,
  number,
  title: `Song ${number}`,
  startedAt,
})
/** A path from the parts that exist now: Words and Quiz decide the status, Chords and Listen do not. */
const path = (words: boolean, quiz: boolean, chords = false, listen = false): PathState => ({ listen, words, meaning: quiz, chords })

describe("Learning / Learned chips", () => {
  it("puts a song on the list that is not finished into Learning", () => {
    const r = classifyLearnSongs([song(10, 1)], { "ps-10": path(true, false) })
    expect(r.learning).toEqual([10])
    expect(r.learned).toEqual([])
  })

  it("counts a song on the list with no steps done as Learning too (the person started it)", () => {
    expect(classifyLearnSongs([song(11, 1)], {}).learning).toEqual([11])
  })

  it("puts a song with Words and Quiz done into Learned, and out of Learning", () => {
    const r = classifyLearnSongs([song(12, 1)], { "ps-12": path(true, true) })
    expect(r.learning).toEqual([])
    expect(r.learned).toEqual([12])
  })

  it("keeps a finished song in Learned after it leaves the list", () => {
    const r = classifyLearnSongs([], { "ps-77": path(true, true), "ps-78": path(true, false) })
    expect(r.learned).toEqual([77])
    expect(r.learning).toEqual([])
  })

  it("does not count Chords or Listen: a song with only those is still not learned", () => {
    const r = classifyLearnSongs([song(13, 1)], { "ps-13": path(false, false, true, true) })
    expect(r.learned).toEqual([])
    expect(r.learning).toEqual([13])
  })

  it("learns a song without chords: Words and Quiz are enough", () => {
    expect(classifyLearnSongs([song(14, 1)], { "ps-14": path(true, true, false) }).learned).toEqual([14])
  })

  it("does not count Chords or Listen toward Learned", () => {
    const r = classifyLearnSongs([song(14, 1)], { "ps-14": { listen: true, words: false, meaning: false, chords: true } })
    expect(r.learned).toEqual([])
    expect(r.learning).toEqual([14])
  })

  it("reads the status from the one rule, which can be swapped", () => {
    const r = classifyLearnSongs([song(15, 1), song(16, 2)], {}, (p) => (p ? "learned" : "notStarted"))
    expect(r.learning).toEqual([16, 15])
    const all = classifyLearnSongs([song(15, 1)], { "ps-15": path(false, false) }, () => "learned")
    expect(all.learned).toEqual([15])
  })

  it("orders the most recently started first, then by number", () => {
    const r = classifyLearnSongs([song(5, 100), song(9, 300), song(7, 200)], {})
    expect(r.learning).toEqual([9, 7, 5])
    const tie = classifyLearnSongs([song(20, 50), song(3, 50)], {})
    expect(tie.learning).toEqual([3, 20])
  })

  it("never lists a song twice", () => {
    const r = classifyLearnSongs([song(4, 1), song(4, 2)], { "ps-4": path(true, true) })
    expect(r.learned).toEqual([4])
    expect(r.learning).toEqual([])
  })

  it("ignores path keys that are not song ids", () => {
    expect(classifyLearnSongs([], { junk: path(true, true) }).learned).toEqual([])
  })
})
