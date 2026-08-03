import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Evidence-driven regression: opening the song page over an already-playing
 * track must not break pause. The song page calls syncCurrentSong (metadata
 * only) — it must never create a second Audio.Sound.
 */

type Status = {
  isLoaded: true
  isPlaying: boolean
  isBuffering?: boolean
  positionMillis: number
  durationMillis: number
  didJustFinish?: boolean
}

function createMockSound(initial: Status) {
  let status = { ...initial }
  const sound = {
    setOnPlaybackStatusUpdate: vi.fn(),
    getStatusAsync: vi.fn(async () => ({ ...status })),
    playAsync: vi.fn(async () => {
      status = { ...status, isPlaying: true }
    }),
    pauseAsync: vi.fn(async () => {
      status = { ...status, isPlaying: false }
    }),
    stopAsync: vi.fn(async () => {
      status = { ...status, isPlaying: false }
    }),
    unloadAsync: vi.fn(async () => undefined),
    setStatusAsync: vi.fn(async (patch: { shouldPlay?: boolean }) => {
      if (typeof patch.shouldPlay === "boolean") {
        status = { ...status, isPlaying: patch.shouldPlay }
      }
    }),
    setPositionAsync: vi.fn(async (ms: number) => {
      status = { ...status, positionMillis: ms }
    }),
    setVolumeAsync: vi.fn(async () => undefined),
    /** test helper */
    _setPlaying(playing: boolean) {
      status = { ...status, isPlaying: playing }
    },
  }
  return sound
}

const createAsync = vi.fn()
const setAudioModeAsync = vi.fn(async () => undefined)
const setIsEnabledAsync = vi.fn(async () => undefined)

vi.mock("expo-av", () => ({
  Audio: {
    Sound: { createAsync },
    setAudioModeAsync,
    setIsEnabledAsync,
  },
}))

vi.mock("@/lib/client", () => ({
  api: {
    fetchSong: vi.fn(async () => null),
  },
}))

vi.mock("@/stores/preferencesStore", () => ({
  usePreferencesStore: {
    getState: () => ({
      recordRecentPlay: vi.fn(),
    }),
  },
}))

const song = {
  id: "ps-1",
  number: 1,
  title: "Test",
  shortDescription: "Test",
  imageUrl: "https://example.com/a.jpg",
  thumbnailUrl: "https://example.com/a.jpg",
  themes: ["devotion"],
  mood: "peaceful",
  language: "Bengali",
  durationSeconds: 120,
  lyrics: "la",
  meaning: "meaning",
  performer: "Artist",
  audioUrl: "https://example.com/a.mp3",
  mediaHydrated: true,
  videos: [],
}

describe("playerStore song-page handoff", () => {
  beforeEach(() => {
    vi.resetModules()
    createAsync.mockReset()
    setAudioModeAsync.mockReset()
    setIsEnabledAsync.mockReset()
    const bag = globalThis as typeof globalThis & {
      __psSound?: unknown
      __psLoadId?: number
      __psPlayToken?: number
      __psAudioChain?: Promise<void>
    }
    bag.__psSound = null
    bag.__psLoadId = 0
    bag.__psPlayToken = 0
    bag.__psAudioChain = Promise.resolve()
  })

  it("syncCurrentSong does not create a second Sound while one is playing", async () => {
    const sound = createMockSound({
      isLoaded: true,
      isPlaying: true,
      positionMillis: 15_000,
      durationMillis: 120_000,
    })
    createAsync.mockResolvedValue({ sound })

    const { usePlayerStore } = await import("@/stores/playerStore")
    usePlayerStore.getState().loadSong(song as never, [1])
    await vi.waitFor(() => expect(createAsync).toHaveBeenCalledTimes(1))

    usePlayerStore.getState().syncCurrentSong(
      { ...song, title: "Updated title", audioUrl: song.audioUrl } as never,
      [1, 2],
    )

    expect(createAsync).toHaveBeenCalledTimes(1)
    expect(usePlayerStore.getState().currentSong?.title).toBe("Updated title")
    expect(usePlayerStore.getState().queue).toEqual([1, 2])
  })

  it("pause after syncCurrentSong stops the same Sound instance", async () => {
    const sound = createMockSound({
      isLoaded: true,
      isPlaying: true,
      positionMillis: 20_000,
      durationMillis: 120_000,
    })
    createAsync.mockResolvedValue({ sound })

    const { usePlayerStore } = await import("@/stores/playerStore")
    usePlayerStore.getState().loadSong(song as never)
    await vi.waitFor(() => expect(usePlayerStore.getState().isPlaying).toBe(true))

    usePlayerStore.getState().syncCurrentSong(song as never)
    usePlayerStore.getState().pause()

    await vi.waitFor(() => expect(sound.pauseAsync).toHaveBeenCalled())
    expect(usePlayerStore.getState().isPlaying).toBe(false)
    // Must not spawn another player during song-page open + pause.
    expect(createAsync).toHaveBeenCalledTimes(1)
  })

  it("loadSong for the same track does not recreate audio", async () => {
    const sound = createMockSound({
      isLoaded: true,
      isPlaying: true,
      positionMillis: 5_000,
      durationMillis: 120_000,
    })
    createAsync.mockResolvedValue({ sound })

    const { usePlayerStore } = await import("@/stores/playerStore")
    usePlayerStore.getState().loadSong(song as never)
    await vi.waitFor(() => expect(createAsync).toHaveBeenCalledTimes(1))

    usePlayerStore.getState().loadSong(song as never, [1, 3])
    await Promise.resolve()
    expect(createAsync).toHaveBeenCalledTimes(1)
  })
})
