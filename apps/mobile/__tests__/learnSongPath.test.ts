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
const learned = path({ listen: true, words: true, chords: true })

describe("the three steps", () => {
  it("are hear it, learn what it means, play it, with the prototype's text", () => {
    expect(PATH_STEPS.map((s) => s.title)).toEqual(["Hear it and sing it", "Learn what it means", "Play it"])
    expect(PATH_STEPS.map((s) => s.part)).toEqual(["listen", "words", "chords"])
    expect(PATH_STEPS.map((s) => s.cta)).toEqual(["Listen and sing", "Study the words", "Open the chords"])
  })

  it("label the step and the button", () => {
    expect(stepOver(1, false)).toBe("Step 1 · To do")
    expect(stepOver(2, true)).toBe("Step 2 · Done")
    expect(stepCta(1, undefined)).toBe("Listen and sing")
    expect(stepCta(1, path({ listen: true }))).toBe("Do it again")
    expect(stepCta(3, path({ listen: true }))).toBe("Open the chords")
  })
})

describe("progress", () => {
  it("counts steps for the label and the bar", () => {
    expect(pathProgressLabel(undefined)).toBe("0 of 3 steps")
    expect(pathProgressLabel(path({ listen: true, chords: true }))).toBe("2 of 3 steps")
    expect(pathFraction(learned)).toBe(1)
    expect(pathFraction(path({ words: true }))).toBeCloseTo(1 / 3)
  })

  it("names the next step in the library row", () => {
    expect(nextStepNote(undefined)).toBe("Step 1 of 3 · hear it")
    expect(nextStepNote(path({ listen: true }))).toBe("Step 2 of 3 · know what it means")
    expect(nextStepNote(path({ listen: true, words: true }))).toBe("Step 3 of 3 · play it")
  })
})

describe("links", () => {
  it("builds the routes, with harmonium by path only", () => {
    expect(pathLinks("ps-3", 3)).toEqual({
      listen: "/song-v2/ps-3",
      words: "/learn/words?song=3",
      harmoniumChords: "/harmonium-v2/chords",
    })
  })

  it("reads the song number from an id", () => {
    expect(songNumberFromId("ps-12")).toBe(12)
    expect(songNumberFromId("PS-7")).toBe(7)
    expect(songNumberFromId("other")).toBeNull()
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
