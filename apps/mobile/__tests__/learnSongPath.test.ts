import { describe, expect, it } from "vitest"

import { EMPTY_PATH, type PathState } from "@/lib/learn/progress"
import {
  currentStep,
  nextSongToLearn,
  pathHeadline,
  pathLinks,
  songNumberFromId,
  stepAvailable,
  stepOneNote,
  stepStatuses,
} from "@/lib/learn/songPath"

const path = (patch: Partial<PathState>): PathState => ({ ...EMPTY_PATH, ...patch })

describe("stepStatuses", () => {
  it("starts with step 1 current and the rest locked", () => {
    expect(stepStatuses(undefined, false)).toEqual(["current", "locked", "locked"])
  })

  it("step 1 needs both listen and words", () => {
    expect(stepStatuses(path({ listen: true }), false)).toEqual(["current", "locked", "locked"])
    expect(stepStatuses(path({ listen: true, words: true }), false)).toEqual(["done", "current", "locked"])
  })

  it("moves on to chords after the meaning quiz", () => {
    expect(stepStatuses(path({ listen: true, words: true, meaning: true }), false)).toEqual(["done", "done", "current"])
  })

  it("everything is done once chords are done", () => {
    expect(stepStatuses(path({ listen: true, words: true, meaning: true, chords: true }), false)).toEqual([
      "done",
      "done",
      "done",
    ])
  })

  it("skip ahead opens the steps after the current one", () => {
    expect(stepStatuses(undefined, true)).toEqual(["current", "open", "open"])
    expect(stepStatuses(path({ listen: true, words: true }), true)).toEqual(["done", "current", "open"])
  })

  it("a step finished early by skipping stays done and step 1 stays current", () => {
    expect(stepStatuses(path({ chords: true }), false)).toEqual(["current", "locked", "done"])
    expect(stepStatuses(path({ meaning: true }), true)).toEqual(["current", "done", "open"])
  })

  it("only a locked step is unavailable", () => {
    expect(stepAvailable("locked")).toBe(false)
    expect(stepAvailable("open")).toBe(true)
    expect(stepAvailable("current")).toBe(true)
    expect(stepAvailable("done")).toBe(true)
  })
})

describe("currentStep and headline", () => {
  it("finds the first unfinished step", () => {
    expect(currentStep(undefined)).toBe(1)
    expect(currentStep(path({ listen: true, words: true }))).toBe(2)
    expect(currentStep(path({ listen: true, words: true, meaning: true, chords: true }))).toBeNull()
  })

  it("writes the headline", () => {
    expect(pathHeadline(undefined)).toBe("Not started")
    expect(pathHeadline(path({ listen: true }))).toBe("Step 1 of 3")
    expect(pathHeadline(path({ listen: true, words: true }))).toBe("Step 2 of 3")
    expect(pathHeadline(path({ listen: true, words: true, meaning: true, chords: true }))).toBe("Song learned")
  })

  it("says which half of step 1 is left", () => {
    expect(stepOneNote(undefined)).toBe("Two parts: listen, then word cards.")
    expect(stepOneNote(path({ listen: true }))).toBe("Listened. Word cards are left.")
    expect(stepOneNote(path({ words: true }))).toBe("Word cards done. Listen to the song once.")
    expect(stepOneNote(path({ listen: true, words: true }))).toBe("Listened, and all word cards done.")
  })
})

describe("links", () => {
  it("builds the routes, with harmonium by path only", () => {
    expect(pathLinks("ps-3", 3)).toEqual({
      listen: "/song-v2/ps-3",
      words: "/learn/words?song=3",
      quiz: "/learn/quiz?song=3",
      harmonium: "/harmonium-v2",
      chords: "/harmonium-v2/chords",
    })
  })

  it("reads the song number from an id", () => {
    expect(songNumberFromId("ps-12")).toBe(12)
    expect(songNumberFromId("PS-7")).toBe(7)
    expect(songNumberFromId("other")).toBeNull()
  })
})

describe("nextSongToLearn", () => {
  const learned = path({ listen: true, words: true, meaning: true, chords: true })
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
