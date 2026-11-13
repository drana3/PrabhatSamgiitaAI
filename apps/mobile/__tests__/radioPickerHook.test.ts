import { afterEach, describe, expect, it } from "vitest"

import { randomPlayableSongNumber, setRadioPicker } from "@/lib/playableAudio"

describe("the Radio picker hook behind randomPlayableSongNumber", () => {
  afterEach(() => setRadioPicker(null))

  it("without a picker it is the old plain random pick (never the excluded number)", () => {
    for (let i = 0; i < 50; i += 1) expect(randomPlayableSongNumber(10)).not.toBe(10)
  })

  it("with a picker, its answer is the next track (and it is told which track plays now)", () => {
    const asked: number[] = []
    setRadioPicker((exclude) => {
      asked.push(exclude)
      return 1_000_000_123
    })
    expect(randomPlayableSongNumber(77)).toBe(1_000_000_123)
    expect(asked).toEqual([77])
  })

  it("a picker with nothing to offer (null) falls back to the plain pick instead of going silent", () => {
    setRadioPicker(() => null)
    const n = randomPlayableSongNumber(10)
    expect(n).toBeGreaterThanOrEqual(1)
    expect(n).not.toBe(10)
  })

  it("the picker can be removed again", () => {
    setRadioPicker(() => 5)
    setRadioPicker(null)
    expect(randomPlayableSongNumber(5)).not.toBe(5)
  })
})
