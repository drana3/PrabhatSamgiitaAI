import { beforeEach, describe, expect, it, vi } from "vitest"

import { apiSongDetail } from "./helpers/apiSongDetail"

/** A song the engine moves to by itself: it enters "Recent" and does not show the last song's length (checkup P24). */

const recordRecentPlay = vi.fn()

vi.mock("expo-av", () => ({
  Audio: {
    Sound: { createAsync: vi.fn() },
    setAudioModeAsync: vi.fn(async () => undefined),
    setIsEnabledAsync: vi.fn(async () => undefined),
  },
}))
vi.mock("@/lib/client", () => ({ api: { fetchSong: vi.fn() } }))
vi.mock("@/stores/preferencesStore", () => ({
  usePreferencesStore: { getState: () => ({ recordRecentPlay }) },
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

function seed(number: number, kind?: "kiirtan") {
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
    ...(kind ? { kind } : {}),
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function player(): Promise<any> {
  return await import("react-native-track-player")
}

describe("track change by the engine", () => {
  beforeEach(async () => {
    vi.resetModules()
    ;(await player()).__resetFakeTrackPlayer()
    ;(globalThis as { __psMediaCache?: Map<number, unknown> }).__psMediaCache?.clear()
    recordRecentPlay.mockClear()
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true })))
    const { api } = await import("@/lib/client")
    vi.mocked(api.fetchSong).mockImplementation(async (n: number) => apiSongDetail(n) as never)
  })

  async function playing() {
    const { usePlayerStore } = await import("@/stores/playerStore")
    const rn = await player()
    usePlayerStore.getState().loadSong(seed(1) as never, [1, 2, 3], "playlist")
    await vi.waitFor(() => expect(rn.default.play).toHaveBeenCalled())
    await vi.waitFor(() => expect(usePlayerStore.getState().isBuffering).toBe(false))
    recordRecentPlay.mockClear()
    return { usePlayerStore, rn }
  }

  it("records the new song in Recent and clears the old length", async () => {
    const { usePlayerStore, rn } = await playing()
    usePlayerStore.setState({ duration: 300 })
    const cache = (globalThis as { __psMediaCache: Map<number, unknown> }).__psMediaCache
    cache.set(2, seed(2))
    rn.__emitTrackPlayer(rn.Event.PlaybackActiveTrackChanged, { index: 1, track: { id: "ps-2" } })
    expect(usePlayerStore.getState().currentSong?.number).toBe(2)
    expect(usePlayerStore.getState().duration).toBe(0)
    expect(recordRecentPlay).toHaveBeenCalledTimes(1)
    expect(recordRecentPlay.mock.calls[0][0].number).toBe(2)
  })

  it("the same song again (a loop) is not a new play and keeps its length", async () => {
    const { usePlayerStore, rn } = await playing()
    usePlayerStore.setState({ duration: 300 })
    const cache = (globalThis as { __psMediaCache: Map<number, unknown> }).__psMediaCache
    cache.set(1, seed(1))
    rn.__emitTrackPlayer(rn.Event.PlaybackActiveTrackChanged, { index: 0, track: { id: "ps-1" } })
    expect(recordRecentPlay).not.toHaveBeenCalled()
    expect(usePlayerStore.getState().duration).toBe(300)
  })

  it("a Kiirtan does not enter Recent", async () => {
    const { rn } = await playing()
    const { cacheCatalogSong } = await import("@/lib/playback/catalogSongCache")
    cacheCatalogSong(seed(2, "kiirtan") as never)
    rn.__emitTrackPlayer(rn.Event.PlaybackActiveTrackChanged, { index: 1, track: { id: "ps-2" } })
    expect(recordRecentPlay).not.toHaveBeenCalled()
  })
})
