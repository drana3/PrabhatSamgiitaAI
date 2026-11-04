import { describe, expect, it } from "vitest"

import { mockCounts, mockIntervals, mockKind } from "@/lib/learn/mockupCards"

const deck = Array.from({ length: 10 }, (_, i) => `w${i}`)

describe("mockup card logic", () => {
  it("makes the last two cards review cards and the rest new", () => {
    expect(mockKind("w0", deck, {})).toBe("new")
    expect(mockKind("w7", deck, {})).toBe("new")
    expect(mockKind("w8", deck, {})).toBe("due")
    expect(mockKind("w9", deck, {})).toBe("due")
  })

  it("turns Again and Hard answers into learning cards", () => {
    expect(mockKind("w2", deck, { w2: "again" })).toBe("learning")
    expect(mockKind("w9", deck, { w9: "hard" })).toBe("learning")
    expect(mockKind("w2", deck, { w2: "good" })).toBe("new")
  })

  it("counts the queue like the prototype", () => {
    expect(mockCounts(deck, deck, {})).toEqual({ newCount: 8, learningCount: 0, dueCount: 2 })
    expect(mockCounts(deck.slice(1), deck, { w3: "again" })).toEqual({ newCount: 6, learningCount: 1, dueCount: 2 })
  })

  it("uses the fixed button times", () => {
    expect(mockIntervals("steps", false, false)).toEqual({ again: "<1m", hard: "10m", good: "1d", easy: "3d" })
    expect(mockIntervals("steps", true, false).easy).toBe("14d")
    expect(mockIntervals("adaptive", false, true).good).toBe("15m")
    expect(mockIntervals("daily", true, false).easy).toBe("7d")
  })
})
