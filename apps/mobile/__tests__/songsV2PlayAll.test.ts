import { describe, expect, it } from "vitest"

import { appendToQueue, playAllPlan, queueToast } from "@/lib/songsV2/playAll"

describe("play all", () => {
  it("returns null for an empty list", () => {
    expect(playAllPlan([], () => true)).toBeNull()
  })
  it("starts at the first song with audio and keeps the order", () => {
    const plan = playAllPlan([5, 3, 9], (n) => n === 9)
    expect(plan).toEqual({ start: 9, queue: [5, 3, 9] })
  })
  it("starts at the first song when none has audio", () => {
    expect(playAllPlan([5, 3], () => false)?.start).toBe(5)
  })
  it("drops duplicates", () => {
    expect(playAllPlan([2, 2, 4], () => true)?.queue).toEqual([2, 4])
  })
})

describe("queue", () => {
  it("appends once", () => {
    expect(appendToQueue([1, 2], 3)).toEqual([1, 2, 3])
    expect(appendToQueue([1, 2], 2)).toEqual([1, 2])
    expect(appendToQueue([], 7)).toEqual([7])
  })
  it("words the toast", () => {
    expect(queueToast([1], 2)).toBe("Added PS 2 to the queue")
    expect(queueToast([1], 1)).toBe("PS 1 is already in the queue")
  })
})
