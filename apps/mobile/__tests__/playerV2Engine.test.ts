import { beforeEach, describe, expect, it, vi } from "vitest"

import { apiSongDetail } from "./helpers/apiSongDetail"
import { catalogPlayer, catalogPlayerEvents, waitForCatalogAdd } from "./helpers/nativePlayer"

const fetchSong = vi.fn(async (n: number) => apiSongDetail(n))

vi.mock("expo-av", () => ({
  Audio: {
    Sound: { createAsync: vi.fn() },
    setAudioModeAsync: vi.fn(async () => undefined),
    setIsEnabledAsync: vi.fn(async () => undefined),
  },
}))
vi.mock("@/lib/client", () => ({ api: { fetchSong } }))
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

const song = (number: number) => ({
  id: `ps-${number}`,
  number,
  title: `Song ${number}`,
  shortDescription: "",
  imageUrl: "https://example.com/a.jpg",
  thumbnailUrl: "https://example.com/a.jpg",
  themes: [],
  meaning: "",
  lyrics: "",
  translation: "",
  durationSeconds: 120,
  performer: "",
  videos: [],
  audioUrl: `https://example.com/${number}.mp3`,
  mediaHydrated: true,
})

describe("engine additions for the redesigned player", () => {
  beforeEach(async () => {
    vi.resetModules()
    fetchSong.mockClear()
    fetchSong.mockImplementation(async (n: number) => apiSongDetail(n))
    const bag = globalThis as typeof globalThis & Record<string, unknown>
    bag.__psMediaCache = new Map()
    bag.__psLoadGeneration = 0
    bag.__psWantPlaying = false
    const { setTrackEndHook } = await import("@/lib/playback/trackEndHook")
    setTrackEndHook(null)
  })

  it("setRate clamps to 0.5x to 1.5x and tells the native player", async () => {
    const { usePlayerStore } = await import("@/stores/playerStore")
    const TrackPlayer = await catalogPlayer()
    usePlayerStore.getState().setRate(2)
    expect(usePlayerStore.getState().rate).toBe(1.5)
    usePlayerStore.getState().setRate(0.1)
    expect(usePlayerStore.getState().rate).toBe(0.5)
    await vi.waitFor(() => expect(TrackPlayer.setRate).toHaveBeenCalledWith(0.5))
  })

  it("keeps the chosen speed when the next song starts", async () => {
    const { usePlayerStore } = await import("@/stores/playerStore")
    const TrackPlayer = await catalogPlayer()
    usePlayerStore.setState({ rate: 0.75 })
    vi.mocked(TrackPlayer.setRate).mockClear()
    usePlayerStore.getState().loadSong(song(42) as never, [42])
    await vi.waitFor(() => expect(TrackPlayer.setRate).toHaveBeenCalledWith(0.75))
  })

  it("does not touch the native rate at normal speed", async () => {
    const { usePlayerStore } = await import("@/stores/playerStore")
    const TrackPlayer = await catalogPlayer()
    vi.mocked(TrackPlayer.setRate).mockClear()
    usePlayerStore.getState().loadSong(song(42) as never, [42])
    await waitForCatalogAdd(1)
    expect(TrackPlayer.setRate).not.toHaveBeenCalled()
  })

  it("replaceQueue makes a saved playlist follow the new list", async () => {
    const { usePlayerStore } = await import("@/stores/playerStore")
    usePlayerStore.setState({
      playbackMode: "playlist",
      playlistBounds: [1, 2, 3],
      queue: [1, 2, 3],
    })
    usePlayerStore.getState().replaceQueue([1, 3])
    expect(usePlayerStore.getState().queue).toEqual([1, 3])
    expect(usePlayerStore.getState().playlistBounds).toEqual([1, 3])
  })

  it("replaceQueue leaves a casual queue's bounds alone", async () => {
    const { usePlayerStore } = await import("@/stores/playerStore")
    usePlayerStore.setState({ playbackMode: "default", playlistBounds: null, queue: [1, 2, 3] })
    usePlayerStore.getState().replaceQueue([3, 2])
    expect(usePlayerStore.getState().queue).toEqual([3, 2])
    expect(usePlayerStore.getState().playlistBounds).toBeNull()
  })

  it("a track-end hook that handles the end stops the engine from advancing", async () => {
    const { usePlayerStore } = await import("@/stores/playerStore")
    const { setTrackEndHook } = await import("@/lib/playback/trackEndHook")
    usePlayerStore.getState().loadSong(song(42) as never, [42, 1, 2], "playlist")
    await waitForCatalogAdd(1)
    await new Promise((r) => setTimeout(r, 40))
    const onTrackEnded = vi.fn(() => true)
    setTrackEndHook({ shouldHoldUpcoming: () => false, onTrackEnded })
    const TrackPlayer = await catalogPlayer()
    vi.mocked(TrackPlayer.skipToNext).mockClear()
    const { __emitTrackPlayer, Event } = await catalogPlayerEvents()
    __emitTrackPlayer(Event.PlaybackQueueEnded, {})
    await new Promise((r) => setTimeout(r, 40))
    expect(onTrackEnded).toHaveBeenCalledTimes(1)
    expect(TrackPlayer.skipToNext).not.toHaveBeenCalled()
  })

  it("without a hook, or when the hook declines, the engine advances as before", async () => {
    const { usePlayerStore } = await import("@/stores/playerStore")
    const { setTrackEndHook } = await import("@/lib/playback/trackEndHook")
    usePlayerStore.getState().loadSong(song(42) as never, [42, 1, 2], "playlist")
    await waitForCatalogAdd(1)
    await new Promise((r) => setTimeout(r, 40))
    setTrackEndHook({ shouldHoldUpcoming: () => false, onTrackEnded: () => false })
    const TrackPlayer = await catalogPlayer()
    vi.mocked(TrackPlayer.skipToNext).mockClear()
    const { __emitTrackPlayer, Event } = await catalogPlayerEvents()
    __emitTrackPlayer(Event.PlaybackQueueEnded, {})
    await vi.waitFor(() => expect(TrackPlayer.skipToNext).toHaveBeenCalledTimes(1))
  })

  it("while the hook holds the upcoming song, the native queue gets no second track", async () => {
    const { usePlayerStore } = await import("@/stores/playerStore")
    const { setTrackEndHook } = await import("@/lib/playback/trackEndHook")
    setTrackEndHook({ shouldHoldUpcoming: () => true, onTrackEnded: () => false })
    const TrackPlayer = await catalogPlayer()
    vi.mocked(TrackPlayer.add).mockClear()
    usePlayerStore.getState().loadSong(song(42) as never, [42, 1, 2], "playlist")
    await waitForCatalogAdd(1)
    await new Promise((r) => setTimeout(r, 60))
    expect(TrackPlayer.add).toHaveBeenCalledTimes(1)
  })

  it("with no hold, the upcoming song is queued as before", async () => {
    const { usePlayerStore } = await import("@/stores/playerStore")
    const TrackPlayer = await catalogPlayer()
    vi.mocked(TrackPlayer.add).mockClear()
    usePlayerStore.getState().loadSong(song(42) as never, [42, 1, 2], "playlist")
    await waitForCatalogAdd(2)
    expect(vi.mocked(TrackPlayer.add).mock.calls.length).toBeGreaterThanOrEqual(2)
  })
})
