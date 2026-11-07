import { beforeEach, describe, expect, it, vi } from "vitest"

import type { MockSong } from "@/data/mock"
import { cancelPendingNumber, goNext, goPrevious, playNumber, type ControllerDeps } from "@/lib/playerV2/controller"

/** The newest request wins (checkup P5): a slow answer for an older one never plays. */

function song(number: number): MockSong {
  return { id: `ps-${number}`, number, title: `Song ${number}`, audioUrl: `https://a/${number}.mp3` } as MockSong
}

function setup(queue = [1, 2, 3, 4, 5]) {
  const state = { currentSong: song(1), queue, playbackMode: "default" as const, playlistBounds: null, position: 0 }
  const answers = new Map<number, (s: MockSong | null) => void>()
  const loaded: number[] = []
  const deps: ControllerDeps = {
    getPlayer: () => state,
    getPrefs: () => ({ playMode: "this", repeatMode: "off", versionByNumber: {} }),
    loadSong: vi.fn((s: MockSong) => {
      loaded.push(s.number)
      state.currentSong = s
    }),
    loadNumber: (n) => new Promise((resolve) => answers.set(n, resolve)),
    isPlayable: () => true,
    remember: vi.fn(),
    seekTo: vi.fn(),
  }
  return { deps, state, answers, loaded }
}

describe("playNumber and Next", () => {
  beforeEach(() => cancelPendingNumber())

  it("an older slow answer does not play after a newer one", async () => {
    const { deps, answers, loaded } = setup()
    const first = playNumber(deps, 2)
    const second = playNumber(deps, 3)
    answers.get(3)?.(song(3))
    await second
    answers.get(2)?.(song(2))
    await first
    expect(loaded).toEqual([3])
  })

  it("the older answer arriving first is dropped too", async () => {
    const { deps, answers, loaded } = setup()
    const first = playNumber(deps, 2)
    const second = playNumber(deps, 3)
    answers.get(2)?.(song(2))
    await first
    answers.get(3)?.(song(3))
    await second
    expect(loaded).toEqual([3])
  })

  it("two quick Next taps move two songs, not one", async () => {
    const { deps, answers, loaded } = setup()
    goNext(deps)
    goNext(deps)
    expect([...answers.keys()]).toEqual([2, 3])
    answers.get(2)?.(song(2))
    answers.get(3)?.(song(3))
    await vi.waitFor(() => expect(loaded).toEqual([3]))
  })

  it("Next then Previous steps back from the song being loaded", async () => {
    const { deps, answers } = setup()
    goNext(deps) // loading 2
    goPrevious(deps) // from 2 back to 1, not from 1 to nothing
    expect([...answers.keys()]).toEqual([2, 1])
  })

  it("a song chosen another way cancels a load in flight", async () => {
    const { deps, answers, loaded } = setup()
    const pending = playNumber(deps, 2)
    cancelPendingNumber()
    answers.get(2)?.(song(2))
    await pending
    expect(loaded).toEqual([])
  })

  it("a failed load does not block the next step", async () => {
    const { deps, answers, loaded } = setup()
    const pending = playNumber(deps, 2)
    answers.get(2)?.(null)
    await pending
    goNext(deps)
    answers.get(2)?.(song(2))
    await vi.waitFor(() => expect(loaded).toEqual([2]))
  })
})
