import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { catalogPlayer, catalogPlayerEvents, waitForCatalogAdd } from "./helpers/nativePlayer"

import {
  shouldAdvanceAfterTrackEnd,
  shouldAdvanceAfterTrackEndInDrive,
  shouldAutoAdvanceTrack,
} from "@/lib/playbackQueue"

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

const baseSong = {
  id: "ps-42",
  number: 42,
  title: "Test",
  shortDescription: "",
  imageUrl: "https://example.com/a.jpg",
  thumbnailUrl: "https://example.com/a.jpg",
  themes: [],
  mood: "",
  meaning: "",
  lyrics: "",
  translation: "",
  durationSeconds: 120,
  performer: "",
  videos: [],
  audioUrl: "https://example.com/42.mp3",
  mediaHydrated: true,
}

function resetAudioBag() {
  const bag = globalThis as typeof globalThis & {
    __psSound?: unknown
    __psLoadId?: number
    __psPlayToken?: number
    __psAudioChain?: Promise<void>
    __psMediaCache?: Map<number, unknown>
    __psStopAfterCurrentTrack?: boolean
    __psFinishedTrackKey?: string | null
  }
  bag.__psSound = null
  bag.__psLoadId = 0
  bag.__psPlayToken = 0
  bag.__psAudioChain = Promise.resolve()
  bag.__psMediaCache = new Map()
  bag.__psStopAfterCurrentTrack = false
  bag.__psFinishedTrackKey = null
}

function fireTrackEnd(sound: ReturnType<typeof createMockSound>) {
  const onStatus = sound.setOnPlaybackStatusUpdate.mock.calls.at(-1)?.[0] as (
    status: object,
  ) => void
  onStatus({
    isLoaded: true,
    isPlaying: false,
    isBuffering: false,
    didJustFinish: true,
    positionMillis: 120_000,
    durationMillis: 120_000,
  })
}

describe("repeat — queue policy (normal vs drive)", () => {
  const listenQueue = [42, 1, 2]

  it("normal: repeat off does not auto-advance a casual multi-song queue", () => {
    expect(shouldAdvanceAfterTrackEnd("default", 42, listenQueue)).toBe(false)
    expect(shouldAdvanceAfterTrackEnd("playlist", 42, listenQueue)).toBe(true)
  })

  it("normal: single-song queue never auto-advances without repeat", () => {
    expect(shouldAdvanceAfterTrackEnd("default", 42, [42])).toBe(false)
  })

  it("drive: random advances while focused unless drive repeat is on", () => {
    expect(shouldAdvanceAfterTrackEndInDrive("random", 42, [42], true, false, true)).toBe(true)
    expect(shouldAdvanceAfterTrackEndInDrive("random", 42, [42], true, true, true)).toBe(false)
  })

  it("drive: playlist advances mid-list unless drive repeat is on", () => {
    const bounds = [1000, 1001, 1002]
    expect(shouldAdvanceAfterTrackEndInDrive("playlist", 1000, bounds, true, false, true)).toBe(
      true,
    )
    expect(shouldAdvanceAfterTrackEndInDrive("playlist", 1000, bounds, true, true, true)).toBe(
      false,
    )
  })

  it("drive: session stays on while UI unfocused (e.g. lock screen)", () => {
    expect(shouldAutoAdvanceTrack("random", 42, [42], true, false, false)).toBe(true)
    expect(shouldAutoAdvanceTrack("random", 42, [42], true, true, false)).toBe(false)
  })

  it("drive: no advance after session ended", () => {
    expect(shouldAutoAdvanceTrack("random", 42, [42], false, false, false)).toBe(false)
  })
})

describe("repeat — player store track end", () => {
  beforeEach(() => {
    vi.resetModules()
    createAsync.mockReset()
    fetchSong.mockReset()
    fetchSong.mockImplementation(async (n: number) => ({
      number: n,
      title: `PS ${n}`,
      first_line: "Line",
      media: [
        {
          kind: "audio" as const,
          url: `https://example.com/${n}.mp3`,
          provider: "direct_audio",
          title: "Recording",
        },
      ],
    }))
    resetAudioBag()
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true })))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  async function loadDefault(sound: ReturnType<typeof createMockSound>, queue: number[]) {
    createAsync.mockImplementation(async () => ({ sound }))
    const { usePlayerStore } = await import("@/stores/playerStore")
    usePlayerStore.getState().loadSong(baseSong as never, queue, "default")
    await waitForCatalogAdd(1)
    return usePlayerStore
  }

  it("normal mode: repeat on loops instead of playing PS 1 from related queue", async () => {
    const sound = createMockSound({
      isLoaded: true,
      isPlaying: true,
      positionMillis: 0,
      durationMillis: 120_000,
    })
    const usePlayerStore = await loadDefault(sound, [42, 1, 2])
    usePlayerStore.setState({
      repeat: true,
      driveRepeat: false,
      playbackMode: "playlist",
      queue: [42, 1, 2],
    })
    await new Promise((r) => setTimeout(r, 60))
    fetchSong.mockClear()
    usePlayerStore.getState().toggleRepeat()
    if (!usePlayerStore.getState().repeat) usePlayerStore.getState().toggleRepeat()
    const TrackPlayer = await catalogPlayer()
    await vi.waitFor(() => expect(TrackPlayer.setRepeatMode).toHaveBeenCalled())
    expect(usePlayerStore.getState().currentSong?.number).toBe(42)
  })

  it("saved playlist: repeat on loops the last song in the playlist", async () => {
    const sound = createMockSound({
      isLoaded: true,
      isPlaying: true,
      positionMillis: 0,
      durationMillis: 120_000,
    })
    createAsync.mockImplementation(async () => ({ sound }))
    const { usePlayerStore } = await import("@/stores/playerStore")
    usePlayerStore.getState().loadSong(
      { ...baseSong, number: 2, id: "ps-2" } as never,
      [1, 2],
      "playlist",
    )
    await waitForCatalogAdd(1)
    usePlayerStore.setState({
      repeat: true,
      driveRepeat: false,
      driveAutoAdvance: false,
      playbackMode: "playlist",
      playlistBounds: [1, 2],
      queue: [1, 2],
      currentSong: { ...baseSong, number: 2, id: "ps-2" } as never,
    })
    const TrackPlayer = await catalogPlayer()
    TrackPlayer.setRepeatMode.mockClear()
    usePlayerStore.getState().toggleRepeat()
    if (!usePlayerStore.getState().repeat) usePlayerStore.getState().toggleRepeat()
    await vi.waitFor(() =>
      expect(TrackPlayer.setRepeatMode).toHaveBeenCalledWith(expect.anything()),
    )
    fetchSong.mockClear()
    const { __emitTrackPlayer, Event } = await catalogPlayerEvents()
    __emitTrackPlayer(Event.PlaybackQueueEnded, {})
    await new Promise((r) => setTimeout(r, 40))
    expect(fetchSong).not.toHaveBeenCalled()
  })

  it("normal mode: repeat off advances to the next listen-queue song", async () => {
    const sound = createMockSound({
      isLoaded: true,
      isPlaying: true,
      positionMillis: 0,
      durationMillis: 120_000,
    })
    const usePlayerStore = await loadDefault(sound, [42, 1, 2])
    usePlayerStore.setState({
      repeat: false,
      driveRepeat: false,
      playbackMode: "playlist",
      playlistBounds: [42, 1, 2],
      queue: [42, 1, 2],
    })
    await new Promise((r) => setTimeout(r, 60))
    fetchSong.mockClear()
    const { __emitTrackPlayer, Event } = await catalogPlayerEvents()
    __emitTrackPlayer(Event.PlaybackQueueEnded, {})
    await vi.waitFor(() => expect(fetchSong).toHaveBeenCalledWith(1))
  })

  it("drive mode: drive repeat on loops random playback (no next song fetch)", async () => {
    const sound = createMockSound({
      isLoaded: true,
      isPlaying: true,
      positionMillis: 0,
      durationMillis: 120_000,
    })
    createAsync.mockImplementation(async () => ({ sound }))
    const { usePlayerStore } = await import("@/stores/playerStore")
    usePlayerStore.setState({ driveScreenFocused: true })
    usePlayerStore.getState().loadSong(baseSong as never, [42], "random")
    await waitForCatalogAdd(1)
    usePlayerStore.setState({
      driveAutoAdvance: true,
      driveRepeat: true,
      repeat: false,
      playbackMode: "random",
    })
    await new Promise((r) => setTimeout(r, 60))
    fetchSong.mockClear()
    usePlayerStore.getState().toggleDriveRepeat()
    if (!usePlayerStore.getState().driveRepeat) usePlayerStore.getState().toggleDriveRepeat()
    const TrackPlayer = await catalogPlayer()
    await vi.waitFor(() => expect(TrackPlayer.setRepeatMode).toHaveBeenCalled())
    expect(usePlayerStore.getState().currentSong?.number).toBe(42)
  })

  it("drive mode: drive repeat off advances random playback while Drive is focused", async () => {
    const sound = createMockSound({
      isLoaded: true,
      isPlaying: true,
      positionMillis: 0,
      durationMillis: 120_000,
    })
    createAsync.mockImplementation(async () => ({ sound }))
    const { usePlayerStore } = await import("@/stores/playerStore")
    usePlayerStore.setState({ driveScreenFocused: true })
    usePlayerStore.getState().loadSong(baseSong as never, [42], "random")
    await waitForCatalogAdd(1)
    usePlayerStore.setState({
      driveAutoAdvance: true,
      driveRepeat: false,
      repeat: false,
      playbackMode: "random",
    })
    await new Promise((r) => setTimeout(r, 60))
    fetchSong.mockClear()
    const { __emitTrackPlayer, Event } = await catalogPlayerEvents()
    __emitTrackPlayer(Event.PlaybackQueueEnded, {})
    await vi.waitFor(() => expect(fetchSong).toHaveBeenCalled())
  })

  it("drive mode: mini-player repeat also loops random drive playback when drive repeat is off", async () => {
    const sound = createMockSound({
      isLoaded: true,
      isPlaying: true,
      positionMillis: 0,
      durationMillis: 120_000,
    })
    createAsync.mockImplementation(async () => ({ sound }))
    const { usePlayerStore } = await import("@/stores/playerStore")
    usePlayerStore.setState({ driveScreenFocused: true })
    usePlayerStore.getState().loadSong(baseSong as never, [42], "random")
    await waitForCatalogAdd(1)
    usePlayerStore.setState({
      driveAutoAdvance: true,
      driveRepeat: false,
      repeat: true,
      playbackMode: "random",
    })
    await new Promise((r) => setTimeout(r, 60))
    fetchSong.mockClear()
    usePlayerStore.getState().toggleRepeat()
    const TrackPlayer = await catalogPlayer()
    await vi.waitFor(() => expect(TrackPlayer.setRepeatMode).toHaveBeenCalled())
  })
})
