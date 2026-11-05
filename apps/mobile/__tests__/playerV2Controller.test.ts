import { describe, expect, it, vi } from "vitest"

import type { MockSong } from "@/data/mock"
import {
  canGoNext,
  createTrackEndHook,
  goNext,
  goPrevious,
  nextRepeatMode,
  playVersion,
  type ControllerDeps,
} from "@/lib/playerV2/controller"
import { versionsFromSong } from "@/lib/playerV2/versions"

function song(number: number, withVersions = 3): MockSong {
  const recordings = Array.from({ length: withVersions }, (_, i) => ({
    title: i === 1 ? "Guitar" : `Take ${i + 1}`,
    url: `https://a/${number}-${i + 1}.mp3`,
    provider: "direct_audio",
  }))
  return {
    id: `ps-${number}`,
    number,
    title: `Song ${number}`,
    audioUrl: recordings[0]!.url,
    audioRecordings: recordings,
  } as MockSong
}

function makeDeps(over: {
  current?: MockSong | null
  queue?: number[]
  playbackMode?: "default" | "playlist" | "random"
  playMode?: "this" | "all"
  repeatMode?: "off" | "all" | "one"
  versionByNumber?: Record<string, string>
  position?: number
  unplayable?: number[]
}) {
  const state = {
    currentSong: over.current === undefined ? song(1) : over.current,
    queue: over.queue ?? [1, 2, 3],
    playbackMode: over.playbackMode ?? ("default" as const),
    playlistBounds: null as number[] | null,
    position: over.position ?? 0,
  }
  const prefs = {
    playMode: over.playMode ?? ("this" as const),
    repeatMode: over.repeatMode ?? ("off" as const),
    versionByNumber: over.versionByNumber ?? {},
  }
  const loadSong = vi.fn()
  const remember = vi.fn()
  const seekTo = vi.fn()
  const deps: ControllerDeps = {
    getPlayer: () => state,
    getPrefs: () => prefs,
    loadSong,
    loadNumber: async (n) => song(n),
    isPlayable: (n) => !(over.unplayable ?? []).includes(n),
    remember,
    seekTo,
  }
  return { deps, state, prefs, loadSong, remember, seekTo }
}

const flush = () => new Promise((r) => setTimeout(r, 0))

describe("play all versions", () => {
  it("plays the next version of the same song when one ends", () => {
    const { deps, loadSong, remember } = makeDeps({ playMode: "all" })
    const hook = createTrackEndHook(deps)
    expect(hook.onTrackEnded()).toBe(true)
    expect(remember).toHaveBeenCalledWith(1, "ps-1-v2")
    const [loaded, queue, mode] = loadSong.mock.calls[0]!
    expect(loaded.audioUrl).toBe("https://a/1-2.mp3")
    expect(queue).toEqual([1, 2, 3])
    expect(mode).toBe("default")
  })

  it("follows the remembered version when the url names none (offline copies have local urls)", () => {
    const current = { ...song(1), audioUrl: "file:///local.mp3" } as MockSong
    const { deps, loadSong } = makeDeps({
      current,
      playMode: "all",
      versionByNumber: { "1": "ps-1-v2" },
    })
    createTrackEndHook(deps).onTrackEnded()
    expect(loadSong.mock.calls[0]![0].audioUrl).toBe("https://a/1-3.mp3")
  })

  it("holds the upcoming song while versions remain, and not after the last", () => {
    const first = makeDeps({ playMode: "all" })
    expect(createTrackEndHook(first.deps).shouldHoldUpcoming()).toBe(true)
    // the third version is the one playing: its url is on the song, as playVersion sets it
    const onThird = { ...song(1), audioUrl: "https://a/1-3.mp3" } as MockSong
    const last = makeDeps({ current: onThird, playMode: "all", versionByNumber: { "1": "ps-1-v3" } })
    expect(createTrackEndHook(last.deps).shouldHoldUpcoming()).toBe(false)
    const single = makeDeps({ playMode: "this" })
    expect(createTrackEndHook(single.deps).shouldHoldUpcoming()).toBe(false)
  })

  it("after the last version a casual queue moves to the next song", async () => {
    const onThird = { ...song(1), audioUrl: "https://a/1-3.mp3" } as MockSong
    const { deps, loadSong } = makeDeps({ current: onThird, playMode: "all", versionByNumber: { "1": "ps-1-v3" } })
    expect(createTrackEndHook(deps).onTrackEnded()).toBe(true)
    await flush()
    expect(loadSong.mock.calls[0]![0].number).toBe(2)
  })

  it("leaves a saved playlist's own advance to the engine", () => {
    const { deps, loadSong, state } = makeDeps({ playMode: "this" })
    state.playbackMode = "playlist"
    state.playlistBounds = [1, 2, 3]
    expect(createTrackEndHook(deps).onTrackEnded()).toBe(false)
    expect(loadSong).not.toHaveBeenCalled()
  })

  it("repeat one never moves on", () => {
    const { deps, loadSong } = makeDeps({ playMode: "all", repeatMode: "one" })
    expect(createTrackEndHook(deps).onTrackEnded()).toBe(false)
    expect(loadSong).not.toHaveBeenCalled()
  })

  it("repeat all wraps to the first song at the end of the list, even in a playlist", async () => {
    const { deps, loadSong, state } = makeDeps({
      current: song(3, 1),
      repeatMode: "all",
      queue: [1, 2, 3],
    })
    state.playbackMode = "playlist"
    state.playlistBounds = [1, 2, 3]
    expect(createTrackEndHook(deps).onTrackEnded()).toBe(true)
    await flush()
    expect(loadSong.mock.calls[0]![0].number).toBe(1)
    expect(loadSong.mock.calls[0]![2]).toBe("playlist")
  })

  it("does nothing in a drive random session or with no song", () => {
    const random = makeDeps({ playbackMode: "random", playMode: "all" })
    expect(createTrackEndHook(random.deps).onTrackEnded()).toBe(false)
    const none = makeDeps({ current: null })
    expect(createTrackEndHook(none.deps).onTrackEnded()).toBe(false)
    expect(createTrackEndHook(none.deps).shouldHoldUpcoming()).toBe(false)
  })

  it("playVersion remembers the choice and loads that url in the same queue", () => {
    const { deps, loadSong, remember } = makeDeps({})
    const cur = song(1)
    const v = versionsFromSong(cur)[2]!
    playVersion(deps, cur, v)
    expect(remember).toHaveBeenCalledWith(1, "ps-1-v3")
    expect(loadSong.mock.calls[0]![0]).toMatchObject({ audioUrl: "https://a/1-3.mp3", mediaHydrated: true })
  })
})

describe("next and previous", () => {
  it("steps to the next playable song, skipping the ones without audio", async () => {
    const { deps, loadSong } = makeDeps({ unplayable: [2] })
    expect(canGoNext(deps)).toBe(true)
    expect(goNext(deps)).toBe(true)
    await flush()
    expect(loadSong.mock.calls[0]![0].number).toBe(3)
  })

  it("cannot go past the end unless repeat all", () => {
    const end = makeDeps({ current: song(3), queue: [1, 2, 3] })
    expect(canGoNext(end.deps)).toBe(false)
    expect(goNext(end.deps)).toBe(true)
    expect(end.loadSong).not.toHaveBeenCalled()
    const wrap = makeDeps({ current: song(3), queue: [1, 2, 3], repeatMode: "all" })
    expect(canGoNext(wrap.deps)).toBe(true)
  })

  it("previous restarts a song past three seconds, otherwise steps back", async () => {
    const late = makeDeps({ current: song(2), position: 30 })
    goPrevious(late.deps)
    expect(late.seekTo).toHaveBeenCalledWith(0)
    const early = makeDeps({ current: song(2), position: 1 })
    goPrevious(early.deps)
    await flush()
    expect(early.loadSong.mock.calls[0]![0].number).toBe(1)
    const first = makeDeps({ current: song(1), position: 1 })
    goPrevious(first.deps)
    expect(first.seekTo).toHaveBeenCalledWith(0)
  })

  it("hands drive random sessions back to the store", () => {
    const { deps } = makeDeps({ playbackMode: "random" })
    expect(goNext(deps)).toBe(false)
    expect(goPrevious(deps)).toBe(false)
  })

  it("cycles repeat off, all, one", () => {
    expect(nextRepeatMode("off")).toBe("all")
    expect(nextRepeatMode("all")).toBe("one")
    expect(nextRepeatMode("one")).toBe("off")
  })
})
