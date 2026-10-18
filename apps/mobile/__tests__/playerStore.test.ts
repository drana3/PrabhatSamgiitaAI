import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { apiSongDetail } from "./helpers/apiSongDetail"
import { catalogPlayer, waitForCatalogAdd } from "./helpers/nativePlayer"

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

vi.mock("@/lib/audioFocus", () => ({
  releaseExtraAudio: vi.fn(async () => undefined),
  setPlaybackIntent: vi.fn(),
  setSongPlaybackYield: vi.fn(),
  setSongPlayingGuard: vi.fn(),
}))

vi.mock("@/lib/offlineAudio", () => ({
  resolvePlaybackUri: vi.fn(async (_number: number, remoteUrl?: string | null) =>
    remoteUrl?.trim() ? { uri: remoteUrl.trim(), local: false } : null,
  ),
  useOfflineAudioStore: {
    getState: () => ({ files: {} }),
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
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true })))
    const bag = globalThis as typeof globalThis & {
      __psSound?: unknown
      __psLoadId?: number
      __psPlayToken?: number
      __psAudioChain?: Promise<void>
      __psModeReady?: boolean
      __psMediaCache?: Map<number, unknown>
      __psPreload?: unknown
    }
    bag.__psSound = null
    bag.__psLoadId = 0
    bag.__psPlayToken = 0
    bag.__psAudioChain = Promise.resolve()
    bag.__psModeReady = false
    bag.__psMediaCache = new Map()
    bag.__psPreload = null
    bag.__psWantPlaying = false
    bag.__psLastResumeNudgeMs = 0
    bag.__psAttachSession = null
  })

  afterEach(() => {
    vi.unstubAllGlobals()
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
    await waitForCatalogAdd(1)

    usePlayerStore.getState().syncCurrentSong(
      { ...song, title: "Updated title", audioUrl: song.audioUrl } as never,
      [1, 2],
    )

    const TrackPlayer = await catalogPlayer()
    expect(TrackPlayer.add).toHaveBeenCalledTimes(1)
    expect(usePlayerStore.getState().currentSong?.title).toBe("Updated title")
    expect(usePlayerStore.getState().queue).toEqual([1, 2])
  })

  it("configures the audio session to keep playing when the screen locks", async () => {
    const sound = createMockSound({
      isLoaded: true,
      isPlaying: true,
      positionMillis: 0,
      durationMillis: 120_000,
    })
    createAsync.mockResolvedValue({ sound })

    const { usePlayerStore } = await import("@/stores/playerStore")
    usePlayerStore.getState().loadSong(song as never)
    const TrackPlayer = await waitForCatalogAdd(1)
    expect(TrackPlayer.setupPlayer).toHaveBeenCalled()
    expect(TrackPlayer.updateOptions).toHaveBeenCalled()
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
    const TrackPlayerPlay = await waitForCatalogAdd(1)
    await vi.waitFor(() => expect(TrackPlayerPlay.play).toHaveBeenCalled())

    usePlayerStore.getState().syncCurrentSong(song as never)
    usePlayerStore.getState().pause()

    const TrackPlayer = await catalogPlayer()
    await vi.waitFor(() => expect(TrackPlayer.pause).toHaveBeenCalled())
    expect(usePlayerStore.getState().isPlaying).toBe(false)
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
    const TrackPlayer = await waitForCatalogAdd(1)

    const adds = TrackPlayer.add.mock.calls.length
    usePlayerStore.getState().loadSong(song as never, [1, 3])
    await Promise.resolve()
    expect(TrackPlayer.add.mock.calls.length).toBe(adds)
  })

  it("reloads audio when another recording of the same song is chosen", async () => {
    const { usePlayerStore } = await import("@/stores/playerStore")
    usePlayerStore.getState().loadSong(song as never)
    const TrackPlayer = await waitForCatalogAdd(1)
    TrackPlayer.add.mockClear()
    TrackPlayer.reset.mockClear()

    usePlayerStore.getState().playOrToggle({ ...song, audioUrl: "https://example.com/b.mp3" } as never)
    await waitForCatalogAdd(1)
    expect(TrackPlayer.reset).toHaveBeenCalled()
    expect(TrackPlayer.add.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ url: "https://example.com/b.mp3" }),
    )
  })

  it("rapid manual next() keeps a native queue instead of overlapping streams", async () => {
    const { usePlayerStore } = await import("@/stores/playerStore")
    const { api } = await import("@/lib/client")
    vi.mocked(api.fetchSong).mockImplementation(async (n: number) => apiSongDetail(n))
    usePlayerStore.setState({
      driveScreenFocused: true,
      driveAutoAdvance: true,
      playbackMode: "random",
    })
    usePlayerStore.getState().loadSong({ ...song, number: 10, id: "ps-10" } as never, [10], "random")
    const TrackPlayer = await waitForCatalogAdd(1)
    usePlayerStore.getState().next()
    usePlayerStore.getState().next()
    await vi.waitFor(() => expect(TrackPlayer.skipToNext).toHaveBeenCalled())
  })

  it("opens the local file instead of the remote stream", async () => {
    const { resolvePlaybackUri } = await import("@/lib/offlineAudio")
    vi.mocked(resolvePlaybackUri).mockResolvedValue({
      uri: "file:///docs/offline-audio/1.mp3",
      local: true,
    })
    const { usePlayerStore } = await import("@/stores/playerStore")
    usePlayerStore.getState().loadSong(song as never)
    const TrackPlayer = await catalogPlayer()
    await vi.waitFor(() => {
      expect(TrackPlayer.add.mock.calls.map((call) => call[0]?.url)).toContain(
        "file:///docs/offline-audio/1.mp3",
      )
    })
  })

  it("starts playback from home today URLs without waiting for mediaHydrated", async () => {
    const { resolvePlaybackUri } = await import("@/lib/offlineAudio")
    vi.mocked(resolvePlaybackUri).mockReset()
    vi.mocked(resolvePlaybackUri).mockResolvedValue({
      uri: "https://prabhatasamgiita.net/1-999/1.mp3",
      local: false,
    })
    const { usePlayerStore } = await import("@/stores/playerStore")
    usePlayerStore.getState().loadSong(
      {
        ...song,
        mediaHydrated: undefined,
        audioUrl: "https://prabhatasamgiita.net/1-999/1.mp3",
      } as never,
    )
    const TrackPlayer = await catalogPlayer()
    await vi.waitFor(() => {
      expect(TrackPlayer.add.mock.calls.map((call) => call[0]?.url)).toContain(
        "https://prabhatasamgiita.net/1-999/1.mp3",
      )
    })
  })

  it("ends drive auto-advance when leaving drive mode", async () => {
    const { usePlayerStore } = await import("@/stores/playerStore")
    usePlayerStore.setState({
      driveAutoAdvance: true,
      playbackMode: "random",
      playlistBounds: [1, 2, 3],
    })
    usePlayerStore.setState({ currentSong: { id: "ps-1", number: 1 } as never })
    usePlayerStore.getState().exitDriveMode()
    expect(usePlayerStore.getState().playbackMode).toBe("default")
    expect(usePlayerStore.getState().playlistBounds).toBeNull()
    expect(usePlayerStore.getState().driveAutoAdvance).toBe(false)
    expect(usePlayerStore.getState().queue).toEqual([])
    expect(usePlayerStore.getState().currentSong).toBeNull()
  })

  it("keeps saved playlist playback when drive mode was not started from drive", async () => {
    const { usePlayerStore } = await import("@/stores/playerStore")
    usePlayerStore.setState({
      driveAutoAdvance: false,
      playbackMode: "playlist",
      playlistBounds: [1000, 1001],
    })
    usePlayerStore.getState().exitDriveMode()
    expect(usePlayerStore.getState().playbackMode).toBe("playlist")
    expect(usePlayerStore.getState().playlistBounds).toEqual([1000, 1001])
  })
})

describe("playback behavior matrix (drive exit)", () => {
  beforeEach(() => {
    vi.resetModules()
    createAsync.mockReset()
    const bag = globalThis as typeof globalThis & {
      __psSound?: unknown
      __psLoadId?: number
      __psPlayToken?: number
      __psAudioChain?: Promise<void>
      __psMediaCache?: Map<number, unknown>
    }
    bag.__psSound = null
    bag.__psLoadId = 0
    bag.__psPlayToken = 0
    bag.__psAudioChain = Promise.resolve()
    bag.__psMediaCache = new Map()
  })

  it("after leaving drive random, track end does not pick another song", async () => {
    const { usePlayerStore } = await import("@/stores/playerStore")
    const { shouldAdvanceAfterTrackEnd } = await import("@/lib/playbackQueue")
    const bag = globalThis as typeof globalThis & { __psLoadGeneration?: number }
    const loadBefore = bag.__psLoadGeneration ?? 0
    usePlayerStore.setState({
      driveAutoAdvance: true,
      playbackMode: "random",
      queue: [100, 200],
      currentSong: { ...song, number: 100, id: "ps-100" },
    })
    usePlayerStore.getState().exitDriveMode()
    const state = usePlayerStore.getState()
    expect(state.playbackMode).toBe("default")
    expect(state.queue).toEqual([])
    expect(state.currentSong).toBeNull()
    expect(state.isPlaying).toBe(false)
    expect(shouldAdvanceAfterTrackEnd(state.playbackMode, 100, state.queue)).toBe(false)
    expect(bag.__psLoadGeneration).toBeGreaterThan(loadBefore)
  })

  it("exitDriveMode bumps load id, stops playback, and clears stop-after-current", async () => {
    const { usePlayerStore } = await import("@/stores/playerStore")
    const bag = globalThis as typeof globalThis & { __psLoadGeneration?: number }
    const before = bag.__psLoadGeneration ?? 0
    usePlayerStore.setState({
      driveAutoAdvance: true,
      playbackMode: "random",
      currentSong: { ...song, number: 42, id: "ps-42" },
      isPlaying: true,
    })
    usePlayerStore.getState().exitDriveMode()
    await new Promise((r) => setTimeout(r, 50))
    expect(bag.__psLoadGeneration).toBeGreaterThan(before)
    expect(usePlayerStore.getState().playbackMode).toBe("default")
    expect(usePlayerStore.getState().queue).toEqual([])
    expect(usePlayerStore.getState().currentSong).toBeNull()
    expect(usePlayerStore.getState().stopQueueAfterCurrentTrack).toBe(false)
    expect(usePlayerStore.getState().isPlaying).toBe(false)
  })

  it("does not auto-advance when stopQueueAfterCurrentTrack is set", async () => {
    const { shouldAdvanceAfterTrackEnd } = await import("@/lib/playbackQueue")
    const { usePlayerStore } = await import("@/stores/playerStore")
    usePlayerStore.setState({
      stopQueueAfterCurrentTrack: true,
      playbackMode: "random",
      driveAutoAdvance: true,
      driveScreenFocused: true,
      queue: [42],
      currentSong: { ...song, number: 42, id: "ps-42" },
    })
    expect(shouldAdvanceAfterTrackEnd("random", 42, [42])).toBe(true)
    const state = usePlayerStore.getState()
    expect(state.stopQueueAfterCurrentTrack).toBe(true)
    usePlayerStore.getState().next()
    expect(usePlayerStore.getState().currentSong?.number).toBe(42)
  })

  it("reordering the drive queue updates playlist playback order", async () => {
    const { usePlayerStore } = await import("@/stores/playerStore")
    const { nextQueueNumber } = await import("@/lib/playbackQueue")
    usePlayerStore.setState({
      playbackMode: "playlist",
      playlistBounds: [1000, 1001, 1002],
      queue: [1000, 1001, 1002],
      currentSong: { ...song, number: 1000, id: "ps-1000" },
    })
    usePlayerStore.getState().setQueue([1001, 1000, 1002])
    expect(usePlayerStore.getState().playlistBounds).toEqual([1001, 1000, 1002])
    expect(nextQueueNumber("playlist", 1000, usePlayerStore.getState().playlistBounds!)).toBe(1002)
  })

  it("repeat loops the current song instead of advancing a listen queue", async () => {
    const { usePlayerStore } = await import("@/stores/playerStore")
    const { api } = await import("@/lib/client")
    usePlayerStore.getState().loadSong({ ...song, number: 42, id: "ps-42" } as never, [42, 1, 2], "default")
    const TrackPlayer = await waitForCatalogAdd(1)
    usePlayerStore.setState({
      repeat: true,
      playbackMode: "playlist",
      queue: [42, 1, 2],
      isPlaying: true,
    })
    usePlayerStore.getState().toggleRepeat()
    if (!usePlayerStore.getState().repeat) usePlayerStore.getState().toggleRepeat()
    await vi.waitFor(() => expect(TrackPlayer.setRepeatMode).toHaveBeenCalled())
    vi.mocked(api.fetchSong).mockClear()
    expect(usePlayerStore.getState().currentSong?.number).toBe(42)
  })

  it("leaving saved playlist for a casual song clears playlist metadata and starts casual playback", async () => {
    const { usePlayerStore } = await import("@/stores/playerStore")
    const bounds = [1000, 1001]
    usePlayerStore.setState({
      driveAutoAdvance: false,
      playbackMode: "playlist",
      playlistBounds: bounds,
      queue: bounds,
      activePlaylist: { id: "p1", name: "Morning" },
      currentSong: { ...song, number: 1000, id: "ps-1000" },
      hasAudio: true,
    })
    usePlayerStore.getState().loadSong(
      { ...song, number: 2000, id: "ps-2000", audioUrl: "https://example.com/2000.mp3" } as never,
      [2000, 2001],
    )
    await waitForCatalogAdd(1)
    const state = usePlayerStore.getState()
    expect(state.playbackMode).toBe("default")
    expect(state.playlistBounds).toBeNull()
    expect(state.activePlaylist).toBeNull()
    expect(state.currentSong?.number).toBe(2000)
  })

  it("after leaving drive playlist, bounded advance and queue continuation stop", async () => {
    const { usePlayerStore } = await import("@/stores/playerStore")
    const { shouldAdvanceAfterTrackEnd } = await import("@/lib/playbackQueue")
    const bounds = [1000, 1001, 1002]
    usePlayerStore.setState({
      driveAutoAdvance: true,
      playbackMode: "playlist",
      playlistBounds: bounds,
      queue: bounds,
      currentSong: { ...song, number: 1001, id: "ps-1001" },
    })
    usePlayerStore.getState().exitDriveMode()
    const state = usePlayerStore.getState()
    expect(state.playlistBounds).toBeNull()
    expect(state.queue).toEqual([])
    expect(state.currentSong).toBeNull()
    expect(shouldAdvanceAfterTrackEnd("default", 1001, [1001])).toBe(false)
  })
})
