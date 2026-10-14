import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { apiSongDetail } from "./helpers/apiSongDetail"
import { catalogPlayer, waitForCatalogAdd } from "./helpers/nativePlayer"

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
  resolvePlaybackUri: vi.fn(async (_n: number, url?: string | null) =>
    url?.trim() ? { uri: url.trim(), local: false } : null,
  ),
  useOfflineAudioStore: { getState: () => ({ files: {} }) },
}))

const starter = {
  id: "ps-10",
  number: 10,
  title: "Ten",
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
  audioUrl: "https://example.com/10.mp3",
  mediaHydrated: true,
}

async function startDriveRandom() {
  const { usePlayerStore } = await import("@/stores/playerStore")
  usePlayerStore.setState({
    driveScreenFocused: true,
    driveAutoAdvance: true,
    playbackMode: "random",
  })
  usePlayerStore.getState().loadSong(starter as never, [10], "random")
  await waitForCatalogAdd(1)
  return { usePlayerStore }
}

describe("Drive random — native queue (one stream)", () => {
  beforeEach(async () => {
    vi.resetModules()
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true })))
    const { api } = await import("@/lib/client")
    vi.mocked(api.fetchSong).mockImplementation(async (n: number) => apiSongDetail(n))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("plays the current track and prefetches the next native queue item", async () => {
    await startDriveRandom()
    const TrackPlayer = await catalogPlayer()
    await vi.waitFor(() => expect(TrackPlayer.add.mock.calls.length).toBeGreaterThanOrEqual(2))
    expect(TrackPlayer.reset).toHaveBeenCalled()
    expect(TrackPlayer.play).toHaveBeenCalled()
  })

  it("lock then unlock does not reset the native queue", async () => {
    const { usePlayerStore } = await startDriveRandom()
    const TrackPlayer = await catalogPlayer()
    const adds = TrackPlayer.add.mock.calls.length
    TrackPlayer.reset.mockClear()
    usePlayerStore.getState().noteAppBackgroundPlayback()
    usePlayerStore.getState().reassertBackgroundPlayback()
    usePlayerStore.getState().reconcileForegroundCatalogPlayback()
    await new Promise((r) => setTimeout(r, 40))
    expect(TrackPlayer.reset).not.toHaveBeenCalled()
    expect(TrackPlayer.add.mock.calls.length).toBe(adds)
    expect(usePlayerStore.getState().driveAutoAdvance).toBe(true)
  })

  it("next() skips on the native queue", async () => {
    const { usePlayerStore } = await startDriveRandom()
    const TrackPlayer = await catalogPlayer()
    await vi.waitFor(() => expect(TrackPlayer.add.mock.calls.length).toBeGreaterThanOrEqual(2))
    usePlayerStore.getState().next()
    await vi.waitFor(() => expect(TrackPlayer.skipToNext).toHaveBeenCalled())
  })
})
