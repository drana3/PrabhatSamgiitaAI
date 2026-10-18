import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { apiSongDetail } from "./helpers/apiSongDetail"
import { catalogPlayer, catalogPlayerEvents, waitForCatalogAdd } from "./helpers/nativePlayer"

import { nextQueueNumber, shouldAutoAdvanceTrack } from "@/lib/playbackQueue"
import { playlistQueueForPlayback } from "@/lib/playlistPlayback"

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
  return {
    setOnPlaybackStatusUpdate: vi.fn(),
    getStatusAsync: vi.fn(async () => ({ ...status })),
    playAsync: vi.fn(async () => {
      status = { ...status, isPlaying: true }
    }),
    pauseAsync: vi.fn(async () => {
      status = { ...status, isPlaying: false }
    }),
    unloadAsync: vi.fn(async () => undefined),
    setStatusAsync: vi.fn(async (patch: { shouldPlay?: boolean; isLooping?: boolean }) => {
      if (typeof patch.shouldPlay === "boolean") {
        status = { ...status, isPlaying: patch.shouldPlay }
      }
    }),
    setPositionAsync: vi.fn(async (ms: number) => {
      status = { ...status, positionMillis: ms }
    }),
    setVolumeAsync: vi.fn(async () => undefined),
  }
}

const createAsync = vi.fn()
const fetchSong = vi.fn()

vi.mock("expo-av", () => ({
  Audio: {
    Sound: { createAsync },
    setAudioModeAsync: vi.fn(async () => undefined),
    setIsEnabledAsync: vi.fn(async () => undefined),
  },
}))

vi.mock("@/lib/client", () => ({
  api: { fetchSong },
}))

vi.mock("@/stores/preferencesStore", () => ({
  usePreferencesStore: {
    getState: () => ({ recordRecentPlay: vi.fn() }),
  },
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

const BOUNDS = [1000, 1001, 1002]

function songFor(number: number) {
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

function resetAudioBag() {
  const bag = globalThis as typeof globalThis & {
    __psSound?: unknown
    __psLoadId?: number
    __psPlayToken?: number
    __psAudioChain?: Promise<void>
    __psMediaCache?: Map<number, unknown>
    __psStopAfterCurrentTrack?: boolean
    __psAdvancingQueue?: boolean
    __psFinishedTrackKey?: string | null
  }
  bag.__psSound = null
  bag.__psLoadId = 0
  bag.__psPlayToken = 0
  bag.__psAudioChain = Promise.resolve()
  bag.__psMediaCache = new Map()
  bag.__psStopAfterCurrentTrack = false
  bag.__psAdvancingQueue = false
  bag.__psFinishedTrackKey = null
}

describe("playlistPlayback helpers", () => {
  it("uses playlist bounds for advance queue", () => {
    expect(playlistQueueForPlayback("playlist", BOUNDS, [99, 1000])).toEqual(BOUNDS)
    expect(playlistQueueForPlayback("default", BOUNDS, [5, 6])).toEqual([5, 6])
  })
})

describe("saved playlist — player store regression", () => {
  beforeEach(() => {
    vi.resetModules()
    createAsync.mockReset()
    fetchSong.mockReset()
    fetchSong.mockImplementation(async (n: number) => apiSongDetail(n))
    resetAudioBag()
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true })))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it("advances to the next bound song when a track ends outside Drive", async () => {
    const sound = createMockSound({
      isLoaded: true,
      isPlaying: true,
      positionMillis: 0,
      durationMillis: 300_000,
    })
    createAsync.mockImplementation(async () => ({ sound }))

    const { usePlayerStore } = await import("@/stores/playerStore")
    usePlayerStore.setState({
      driveScreenFocused: false,
      driveAutoAdvance: false,
      activePlaylist: { id: "p1", name: "Morning" },
    })
    usePlayerStore.getState().loadSong(songFor(1000) as never, BOUNDS, "playlist")
    await waitForCatalogAdd(1)
    await vi.waitFor(() => expect(fetchSong).toHaveBeenCalledWith(1001))
    const TrackPlayer = await catalogPlayer()
    await TrackPlayer.skipToNext()
    await vi.waitFor(() => expect(usePlayerStore.getState().currentSong?.number).toBe(1001))
    expect(usePlayerStore.getState().playbackMode).toBe("playlist")
    expect(usePlayerStore.getState().playlistBounds).toEqual(BOUNDS)
    expect(shouldAutoAdvanceTrack("playlist", 1000, BOUNDS, false, false, false)).toBe(true)
    expect(nextQueueNumber("playlist", 1000, BOUNDS)).toBe(1001)
  })

  it("stops after the last playlist song without wrapping to the first", async () => {
    const sound = createMockSound({
      isLoaded: true,
      isPlaying: true,
      positionMillis: 299_000,
      durationMillis: 300_000,
    })
    createAsync.mockResolvedValue({ sound })

    const { usePlayerStore } = await import("@/stores/playerStore")
    usePlayerStore.getState().loadSong(songFor(1002) as never, BOUNDS, "playlist")
    const TrackPlayer = await waitForCatalogAdd(1)
    await vi.waitFor(() => expect(TrackPlayer.play).toHaveBeenCalled())
    await vi.waitFor(() => expect(TrackPlayer.removeUpcomingTracks).toHaveBeenCalled())
    fetchSong.mockClear()
    const { __emitTrackPlayer, Event } = await catalogPlayerEvents()
    __emitTrackPlayer(Event.PlaybackQueueEnded, {})
    await vi.waitFor(() => expect(usePlayerStore.getState().isPlaying).toBe(false))
    expect(fetchSong).not.toHaveBeenCalled()
    expect(usePlayerStore.getState().currentSong?.number).toBe(1002)
    expect(shouldAutoAdvanceTrack("playlist", 1002, BOUNDS, false, false, false)).toBe(false)
    expect(nextQueueNumber("playlist", 1002, BOUNDS)).toBeNull()
  })

  it("next() walks playlist bounds while not in Drive random mode", async () => {
    const { usePlayerStore } = await import("@/stores/playerStore")
    const bag = globalThis as typeof globalThis & {
      __psSound?: { setStatusAsync: () => Promise<void> }
    }
    bag.__psSound = { setStatusAsync: vi.fn().mockResolvedValue(undefined) }

    usePlayerStore.setState({
      playbackMode: "playlist",
      playlistBounds: BOUNDS,
      queue: BOUNDS,
      currentSong: songFor(1000) as never,
      driveScreenFocused: false,
      driveAutoAdvance: false,
    })

    usePlayerStore.getState().next()
    await vi.waitFor(() => expect(fetchSong).toHaveBeenCalledWith(1001))
    bag.__psSound = null
  })

  it("playPlaylist end-to-end sets bounds used for advance", async () => {
    const sound = createMockSound({
      isLoaded: true,
      isPlaying: true,
      positionMillis: 0,
      durationMillis: 300_000,
    })
    createAsync.mockImplementation(async () => ({ sound }))

    const { usePlayerStore } = await import("@/stores/playerStore")
    const { playPlaylist } = await import("@/lib/playPlaylist")

    const err = await playPlaylist({
      id: "p1",
      name: "Bounds test",
      songs: [
        { song_number: 1000, position: 1 },
        { song_number: 1001, position: 2 },
      ],
    } as never)

    expect(err).toBeNull()
    await vi.waitFor(() => expect(usePlayerStore.getState().currentSong?.number).toBe(1000))
    expect(usePlayerStore.getState().playlistBounds).toEqual([1000, 1001])
    expect(usePlayerStore.getState().activePlaylist).toEqual({ id: "p1", name: "Bounds test" })
  })
})
