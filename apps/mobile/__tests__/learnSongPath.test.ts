import { describe, expect, it } from "vitest"

import { EMPTY_PATH, type PathState } from "@/lib/learn/progress"
import {
  PATH_STEPS,
  nextSongToLearn,
  nextStepNote,
  pathFraction,
  pathLinks,
  pathProgressLabel,
  songNumberFromId,
  stepCta,
  stepOver,
} from "@/lib/learn/songPath"

const path = (patch: Partial<PathState>): PathState => ({ ...EMPTY_PATH, ...patch })
const learned = path({ words: true, meaning: true })

describe("the three steps", () => {
  it("are Words, Quiz, Chords (Listen is a button, not a step)", () => {
    expect(PATH_STEPS.map((s) => s.title)).toEqual(["Words", "Quiz", "Chords"])
    expect(PATH_STEPS.map((s) => s.part)).toEqual(["words", "meaning", "chords"])
    expect(PATH_STEPS.map((s) => s.cta)).toEqual(["Start the word cards", "Start the quiz", "Show the chords"])
    expect(PATH_STEPS.map((s) => s.optional)).toEqual([false, false, true])
  })

  it("label the step and the button; Chords are labelled as an extra", () => {
    expect(stepOver(1, false)).toBe("Step 1 · To do")
    expect(stepOver(2, true)).toBe("Step 2 · Done")
    expect(stepOver(3, false)).toBe("Extra · To do")
    expect(stepOver(3, true)).toBe("Extra · Done")
    expect(stepCta(1, undefined)).toBe("Start the word cards")
    expect(stepCta(1, path({ words: true }))).toBe("Do it again")
    expect(stepCta(3, path({ words: true }))).toBe("Show the chords")
  })
})

describe("progress", () => {
  it("counts the two steps that count for the label and the bar", () => {
    expect(pathProgressLabel(undefined)).toBe("0 of 2 steps")
    expect(pathProgressLabel(path({ listen: true, chords: true }))).toBe("0 of 2 steps")
    expect(pathProgressLabel(path({ words: true, chords: true }))).toBe("1 of 2 steps")
    expect(pathFraction(learned)).toBe(1)
    expect(pathFraction(path({ words: true }))).toBeCloseTo(1 / 2)
  })

  it("names the next step in the library row", () => {
    expect(nextStepNote(undefined)).toBe("Step 1 of 2 · Words")
    expect(nextStepNote(path({ words: true }))).toBe("Step 2 of 2 · Quiz")
    expect(nextStepNote(path({ words: true, chords: true }))).toBe("Step 2 of 2 · Quiz")
    expect(nextStepNote(learned)).toBe("Learned")
  })
})

describe("links", () => {
  it("builds the routes, with harmonium by path only", () => {
    expect(pathLinks("ps-3", 3)).toEqual({
      listen: "/song-v2/ps-3",
      words: "/learn/words?song=3",
      quiz: "/learn/quiz?song=3",
      harmoniumChords: "/harmonium-v2/chords",
    })
  })

  it("reads the song number from an id", () => {
    expect(songNumberFromId("ps-12")).toBe(12)
    expect(songNumberFromId("PS-7")).toBe(7)
    expect(songNumberFromId("other")).toBeNull()
    expect(songNumberFromId("ps-99999")).toBeNull()
    expect(songNumberFromId("ps-0")).toBeNull()
    expect(songNumberFromId("ps-5018")).toBe(5018)
  })
})

describe("nextSongToLearn", () => {
  it("skips the current and learned songs", () => {
    expect(nextSongToLearn(["ps-1", "ps-2", "ps-3"], { "ps-2": learned }, "ps-1")).toBe("ps-3")
  })
  it("returns null when nothing is left", () => {
    expect(nextSongToLearn(["ps-1"], {}, "ps-1")).toBeNull()
    expect(nextSongToLearn([], {}, "ps-1")).toBeNull()
  })
  it("ignores ids that are not songs", () => {
    expect(nextSongToLearn(["x", "ps-4"], {}, "ps-1")).toBe("ps-4")
  })
})
