import { describe, expect, it } from "vitest"

import { parseNumberParam, quizHref, songPathHref, wordsHref } from "@/lib/learn/routes"

describe("learn routes", () => {
  it("builds word and quiz links", () => {
    expect(wordsHref()).toBe("/learn/words")
    expect(wordsHref({ song: 3 })).toBe("/learn/words?song=3")
    expect(quizHref()).toBe("/learn/quiz")
    expect(quizHref({ level: 1 })).toBe("/learn/quiz")
    expect(quizHref({ level: 2 })).toBe("/learn/quiz?level=2")
    expect(quizHref({ song: 1 })).toBe("/learn/quiz?song=1")
    expect(quizHref({ level: 2, song: 1 })).toBe("/learn/quiz?level=2&song=1")
    expect(songPathHref("ps-1")).toBe("/learn/song/ps-1")
  })

  it("parses numeric params and rejects the rest", () => {
    expect(parseNumberParam("3")).toBe(3)
    expect(parseNumberParam(["4", "5"])).toBe(4)
    expect(parseNumberParam(undefined)).toBeUndefined()
    expect(parseNumberParam("abc")).toBeUndefined()
    expect(parseNumberParam("0")).toBeUndefined()
    expect(parseNumberParam("2.5")).toBeUndefined()
  })
})
