import { describe, expect, it } from "vitest"

import {
  addToQueue,
  clearUpcoming,
  moveItem,
  playNext,
  queueOrigin,
  removeNumber,
  restoreOrder,
  shuffleUpcoming,
  sourceLabel,
  stepPlayable,
} from "@/lib/playerV2/queueOps"

describe("queue operations", () => {
  it("reorders without mutating", () => {
    const q = [1, 2, 3, 4]
    expect(moveItem(q, 0, 2)).toEqual([2, 3, 1, 4])
    expect(moveItem(q, 3, 0)).toEqual([4, 1, 2, 3])
    expect(moveItem(q, 1, 99)).toEqual([1, 3, 4, 2])
    expect(moveItem(q, 9, 0)).toEqual(q)
    expect(q).toEqual([1, 2, 3, 4])
  })

  it("removes, plays next, adds and clears", () => {
    expect(removeNumber([1, 2, 3], 2)).toEqual([1, 3])
    expect(playNext([1, 2, 3, 4], 1, 4)).toEqual([1, 4, 2, 3])
    expect(playNext([1, 2, 3], 2, 9)).toEqual([1, 2, 9, 3])
    expect(playNext([1, 2], null, 9)).toEqual([9, 1, 2])
    expect(addToQueue([1, 2], 3)).toEqual([1, 2, 3])
    expect(addToQueue([1, 2], 2)).toEqual([1, 2])
    expect(clearUpcoming([1, 2, 3, 4], 2)).toEqual([1, 2])
    expect(clearUpcoming([1, 2], null)).toEqual([])
    expect(clearUpcoming([1, 2], 99)).toEqual([99])
  })

  it("shuffles only what comes after the current song", () => {
    const rng = () => 0.3
    const out = shuffleUpcoming([1, 2, 3, 4, 5, 6], 3, rng)
    expect(out.slice(0, 3)).toEqual([1, 2, 3])
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5, 6])
    expect(out).not.toEqual([1, 2, 3, 4, 5, 6])
  })

  it("restores the original order, honouring removals and additions", () => {
    expect(restoreOrder([3, 1, 2], [1, 2, 3])).toEqual([1, 2, 3])
    expect(restoreOrder([3, 1], [1, 2, 3])).toEqual([1, 3])
    expect(restoreOrder([3, 9, 1], [1, 2, 3])).toEqual([1, 3, 9])
  })

  it("steps over songs without audio and wraps only when asked", () => {
    const playable = (n: number) => n !== 2
    expect(stepPlayable([1, 2, 3], 1, 1, playable)).toBe(3)
    expect(stepPlayable([1, 2, 3], 3, 1, playable)).toBeNull()
    expect(stepPlayable([1, 2, 3], 3, 1, playable, true)).toBe(1)
    expect(stepPlayable([1, 2, 3], 3, -1, playable)).toBe(1)
    expect(stepPlayable([1, 2, 3], 1, -1, playable)).toBeNull()
    expect(stepPlayable([1, 2, 3], 1, -1, playable, true)).toBe(3)
    expect(stepPlayable([1], 1, 1, playable, true)).toBeNull()
    expect(stepPlayable([1, 2, 3], 9, 1, playable)).toBeNull()
  })

  it("captions rows and the source chip", () => {
    expect(queueOrigin(5, new Set([5]))).toBe("Mine")
    expect(queueOrigin(6, new Set([5]))).toBe("Catalog")
    expect(sourceLabel({ playbackMode: "default", playlistName: null })).toBe("All songs")
    expect(sourceLabel({ playbackMode: "playlist", playlistName: "Morning" })).toBe("Morning")
    expect(sourceLabel({ playbackMode: "playlist", playlistName: null })).toBe("Playlist")
    expect(sourceLabel({ playbackMode: "random", playlistName: null })).toBe("Random")
    expect(sourceLabel({ playbackMode: "default", playlistName: null, override: " Today " })).toBe("Today")
  })
})
