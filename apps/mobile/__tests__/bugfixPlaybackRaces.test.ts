import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { apiSongDetail } from "./helpers/apiSongDetail"
import { catalogPlayer } from "./helpers/nativePlayer"

// The test double is a vi.fn() object; the real RNTP types do not expose .mock.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fakePlayer = async () => (await catalogPlayer()) as any

/**
 * BUG-05 (playback races: two songs at once, next/previous broken, intermittent
 * start failure) and BUG-27 (spinner stuck on the play button) regressions.
 */

vi.mock("expo-av", () => ({
  Audio: {
    Sound: { createAsync: vi.fn() },
    setAudioModeAsync: vi.fn(async () => undefined),
    setIsEnabledAsync: vi.fn(async () => undefined),
  },
}))

vi.mock("@/lib/client", () => ({
  api: { fetchSong: vi.fn() },
}))

vi.mock("@/stores/preferencesStore", () => ({
  usePreferencesStore: { getState: () => ({ recordRecentPlay: vi.fn() }) },
}))

vi.mock("@/lib/audioFocus", () => ({
  releaseExtraAudio: vi.fn(async () => undefined),
  setPlaybackIntent: vi.fn(),
  setSongPlaybackYield: vi.fn(),
  setSongPlayingGuard: vi.fn(),
}))

vi.mock("@/lib/offlineAudio", () => ({
  toPlayableLocalUri: (uri: string) => uri,
  resolvePlaybackUri: vi.fn(async (_n: number, url?: string | null) =>
    url?.trim() ? { uri: url.trim(), local: false } : null,
  ),
  useOfflineAudioStore: { getState: () => ({ files: {} }) },
}))

function seed(number: number) {
  return {
    id: `ps-${number}`,
    number,
    title: `Song ${number}`,
    shortDescription: "",
    imageUrl: "https://example.com/a.jpg",
    thumbnailUrl: "https://example.com/a.jpg",
    themes: [],
    mood: "",
    meaning: "",
    lyrics: "",
    translation: "",
    durationSeconds: 300,
    performer: "",
    videos: [],
    audioUrl: `https://example.com/${number}.mp3`,
    mediaHydrated: true,
  }
}

function deferred<T = void>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms))

async function addedUrls() {
  const TrackPlayer = await fakePlayer()
  return TrackPlayer.add.mock.calls.map((call: unknown[]) => (call[0] as { url: string }).url)
}

describe("playback races (BUG-05)", () => {
  beforeEach(async () => {
    vi.resetModules()
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true })))
    const { api } = await import("@/lib/client")
    vi.mocked(api.fetchSong).mockImplementation(async (n: number) => apiSongDetail(n) as never)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("a superseded load never starts its stream (no two songs at once)", async () => {
    const { usePlayerStore } = await import("@/stores/playerStore")
    const TrackPlayer = await fakePlayer()
    TrackPlayer.setRepeatMode.mockClear()
    const gate = deferred()
    TrackPlayer.setRepeatMode.mockImplementationOnce(async () => gate.promise)

    usePlayerStore.getState().loadSong(seed(1) as never, [1])
    await vi.waitFor(() => expect(TrackPlayer.setRepeatMode).toHaveBeenCalled())

    // Song 1 is mid-start (hydrated, waiting on the native player). User picks song 2.
    usePlayerStore.getState().loadSong(seed(2) as never, [2], "default")
    await vi.waitFor(async () => expect(await addedUrls()).toContain("https://example.com/2.mp3"))

    gate.resolve()
    await tick()

    expect(await addedUrls()).not.toContain("https://example.com/1.mp3")
    expect(usePlayerStore.getState().currentSong?.number).toBe(2)
  })

  it("a slow next() in a playlist cannot override a newer load", async () => {
    const { usePlayerStore } = await import("@/stores/playerStore")
    const { api } = await import("@/lib/client")
    const TrackPlayer = await fakePlayer()
    const slow = deferred<ReturnType<typeof apiSongDetail>>()
    vi.mocked(api.fetchSong).mockImplementation(async (n: number) =>
      n === 11 ? (slow.promise as never) : (apiSongDetail(n) as never),
    )

    usePlayerStore.getState().loadSong(seed(10) as never, [10, 11], "playlist")
    await vi.waitFor(async () => expect(await addedUrls()).toContain("https://example.com/10.mp3"))

    usePlayerStore.getState().next() // hydrates 11 (slow)
    await tick()
    usePlayerStore.getState().loadSong(seed(20) as never, [20], "default")
    await vi.waitFor(async () => expect(await addedUrls()).toContain("https://example.com/20.mp3"))

    slow.resolve(apiSongDetail(11))
    await tick()

    expect(usePlayerStore.getState().currentSong?.number).toBe(20)
    // Song 11 may sit in the native queue as the prefetched upcoming track, but
    // the active (playing) track must be song 20.
    const active = (await TrackPlayer.getActiveTrack()) as { url?: string } | null
    expect(active?.url).toBe("https://example.com/20.mp3")
  })
})

describe("playlist step failures (BUG-05 / BUG-27)", () => {
  beforeEach(async () => {
    vi.resetModules()
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true })))
    const { api } = await import("@/lib/client")
    // Song 11 has no stream and the detail fetch fails: it cannot be played.
    vi.mocked(api.fetchSong).mockImplementation(async (n: number) =>
      n === 11 ? (null as never) : (apiSongDetail(n) as never),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("next() onto an unplayable playlist song clears the loading spinner", async () => {
    const { usePlayerStore } = await import("@/stores/playerStore")
    usePlayerStore.getState().loadSong(seed(10) as never, [10, 11], "playlist")
    await vi.waitFor(async () => expect(await addedUrls()).toContain("https://example.com/10.mp3"))

    usePlayerStore.getState().next()
    await tick(60)

    const state = usePlayerStore.getState()
    expect(state.isBuffering).toBe(false)
    expect(state.isPlaying).toBe(false)
    expect(state.audioError).toBeTruthy()
  })

  it("previous() onto an unplayable playlist song clears the loading spinner", async () => {
    const { usePlayerStore } = await import("@/stores/playerStore")
    usePlayerStore.getState().loadSong(seed(12) as never, [11, 12], "playlist")
    await vi.waitFor(async () => expect(await addedUrls()).toContain("https://example.com/12.mp3"))

    usePlayerStore.getState().previous()
    await tick(60)

    const state = usePlayerStore.getState()
    expect(state.isBuffering).toBe(false)
    expect(state.isPlaying).toBe(false)
    expect(state.audioError).toBeTruthy()
  })
})

describe("placeholder duration (BUG-27)", () => {
  beforeEach(async () => {
    vi.resetModules()
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true })))
    const { api } = await import("@/lib/client")
    vi.mocked(api.fetchSong).mockImplementation(async (n: number) => apiSongDetail(n) as never)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("does not publish the 5:00 catalog placeholder as the track duration", async () => {
    const { usePlayerStore } = await import("@/stores/playerStore")
    usePlayerStore.getState().loadSong(seed(30) as never, [30], "default")
    await vi.waitFor(async () => expect(await addedUrls()).toContain("https://example.com/30.mp3"))
    expect(usePlayerStore.getState().duration).toBe(0)
  })

  it("takes the real duration from the native progress event", async () => {
    const { usePlayerStore } = await import("@/stores/playerStore")
    const events = (await import("react-native-track-player")) as unknown as {
      Event: { PlaybackProgressUpdated: string }
      __emitTrackPlayer: (event: string, payload: unknown) => void
    }
    usePlayerStore.getState().loadSong(seed(31) as never, [31], "default")
    await vi.waitFor(async () => expect(await addedUrls()).toContain("https://example.com/31.mp3"))
    events.__emitTrackPlayer(events.Event.PlaybackProgressUpdated, { position: 4, duration: 187 })
    expect(usePlayerStore.getState().duration).toBe(187)
  })

  it("keeps the duration unknown when the native player reports 0 while loading", async () => {
    const { usePlayerStore } = await import("@/stores/playerStore")
    const events = (await import("react-native-track-player")) as unknown as {
      Event: { PlaybackProgressUpdated: string }
      __emitTrackPlayer: (event: string, payload: unknown) => void
    }
    usePlayerStore.getState().loadSong(seed(32) as never, [32], "default")
    await vi.waitFor(async () => expect(await addedUrls()).toContain("https://example.com/32.mp3"))
    events.__emitTrackPlayer(events.Event.PlaybackProgressUpdated, { position: 0, duration: 0 })
    expect(usePlayerStore.getState().duration).toBe(0)
  })
})
