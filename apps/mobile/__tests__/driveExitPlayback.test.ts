import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { catalogPlayer, catalogPlayerEvents, waitForCatalogAdd } from "./helpers/nativePlayer"

import { shouldAutoStartRandomOnDriveFocus } from "@/lib/driveAutoStart"

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

const driveSong = {
  id: "ps-3302",
  number: 3302,
  title: "Drive song",
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
  audioUrl: "https://example.com/3302.mp3",
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
    __psAdvancingQueue?: boolean
  }
  bag.__psSound = null
  bag.__psLoadId = 0
  bag.__psPlayToken = 0
  bag.__psAudioChain = Promise.resolve()
  bag.__psMediaCache = new Map()
  bag.__psStopAfterCurrentTrack = false
  bag.__psAdvancingQueue = false
}

describe("shouldAutoStartRandomOnDriveFocus", () => {
  it("does not hijack an active Saved playlist", () => {
    expect(
      shouldAutoStartRandomOnDriveFocus({
        driveAutoAdvance: false,
        playbackMode: "playlist",
        playlistBounds: [26, 102, 680],
      }),
    ).toBe(false)
  })

  it("starts random on a fresh drive visit", () => {
    expect(
      shouldAutoStartRandomOnDriveFocus({
        driveAutoAdvance: false,
        playbackMode: "default",
        playlistBounds: null,
      }),
    ).toBe(true)
  })

  it("does not restart random when a drive random session is already active", () => {
    expect(
      shouldAutoStartRandomOnDriveFocus({
        driveAutoAdvance: true,
        playbackMode: "random",
        playlistBounds: null,
      }),
    ).toBe(false)
  })
})

describe("drive exit — end-to-end player regression", () => {
  beforeEach(() => {
    vi.resetModules()
    createAsync.mockReset()
    fetchSong.mockReset()
    fetchSong.mockResolvedValue({
      number: 1,
      title: "PS 1",
      first_line: "One",
      audio_url: "https://example.com/1.mp3",
    })
    resetAudioBag()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it("leaving Drive stops playback and track finish does not fetch PS 1", async () => {
    const sound = createMockSound({
      isLoaded: true,
      isPlaying: true,
      positionMillis: 299_000,
      durationMillis: 300_000,
    })
    createAsync.mockResolvedValue({ sound })

    const { usePlayerStore } = await import("@/stores/playerStore")
    usePlayerStore.setState({ driveScreenFocused: true, driveAutoAdvance: true })
    usePlayerStore.getState().loadSong(driveSong as never, [3302], "random")
    await waitForCatalogAdd(1)

    usePlayerStore.getState().setDriveScreenFocused(false)
    usePlayerStore.getState().exitDriveMode()
    const afterExit = usePlayerStore.getState()
    expect(afterExit.playbackMode).toBe("default")
    expect(afterExit.stopQueueAfterCurrentTrack).toBe(false)
    expect(afterExit.isPlaying).toBe(false)
    expect(afterExit.queue).toEqual([])
    expect(afterExit.currentSong).toBeNull()

    await new Promise((r) => setTimeout(r, 80))
    fetchSong.mockClear()

    const onStatus = sound.setOnPlaybackStatusUpdate.mock.calls.at(-1)?.[0] as (
      status: object,
    ) => void
    onStatus?.({
      isLoaded: true,
      isPlaying: false,
      isBuffering: false,
      didJustFinish: true,
      positionMillis: 300_000,
      durationMillis: 300_000,
    })

    expect(usePlayerStore.getState().isPlaying).toBe(false)
    expect(fetchSong).not.toHaveBeenCalled()
    expect(usePlayerStore.getState().currentSong).toBeNull()
    expect(usePlayerStore.getState().stopQueueAfterCurrentTrack).toBe(false)
  })

  it("foreground reconcile does not cancel an in-flight skip", async () => {
    const { usePlayerStore } = await import("@/stores/playerStore")
    const bag = globalThis as typeof globalThis & {
      __psSound?: unknown
      __psAdvancingQueue?: boolean
      __psLoadId?: number
    }
    bag.__psSound = null
    bag.__psAdvancingQueue = true
    const loadBefore = bag.__psLoadId ?? 0
    usePlayerStore.setState({
      driveAutoAdvance: true,
      playbackMode: "random",
      isPlaying: true,
      currentSong: driveSong as never,
    })
    const TrackPlayer = await catalogPlayer()
    TrackPlayer.add.mockClear()
    usePlayerStore.getState().reconcileForegroundCatalogPlayback()
    await new Promise((r) => setTimeout(r, 50))
    expect(TrackPlayer.add).not.toHaveBeenCalled()
    expect(usePlayerStore.getState().isPlaying).toBe(true)
  })

  it("after lock (background note) foreground reconcile resumes the same handle", async () => {
    const sound = createMockSound({
      isLoaded: true,
      isPlaying: true,
      positionMillis: 60_000,
      durationMillis: 300_000,
    })
    const bag = globalThis as typeof globalThis & { __psSound?: unknown }
    bag.__psSound = sound

    const { usePlayerStore } = await import("@/stores/playerStore")
    usePlayerStore.setState({
      driveAutoAdvance: true,
      playbackMode: "random",
      isPlaying: false,
      currentSong: driveSong as never,
    })
    const bagWant = globalThis as typeof globalThis & { __psWantPlaying?: boolean }
    bagWant.__psWantPlaying = true
    const TrackPlayer = await catalogPlayer()
    TrackPlayer.add.mockClear()
    TrackPlayer.reset.mockClear()
    usePlayerStore.getState().noteAppBackgroundPlayback()
    usePlayerStore.getState().reconcileForegroundCatalogPlayback()
    await new Promise((r) => setTimeout(r, 50))
    expect(TrackPlayer.reset).not.toHaveBeenCalled()
    expect(TrackPlayer.add).not.toHaveBeenCalled()
  })

  it("scheduled drive blur exit is cancelled when the app backgrounds (lock screen)", async () => {
    const { usePlayerStore } = await import("@/stores/playerStore")
    usePlayerStore.setState({
      driveScreenFocused: true,
      driveAutoAdvance: true,
      playbackMode: "random",
      currentSong: driveSong as never,
    })
    usePlayerStore.getState().scheduleDriveBlurExit()
    usePlayerStore.getState().noteAppBackgroundPlayback()
    await new Promise((r) => setTimeout(r, 1300))
    expect(usePlayerStore.getState().driveAutoAdvance).toBe(true)
    expect(usePlayerStore.getState().playbackMode).toBe("random")
  })

  it("foreground reconcile does not open a new stream when the handle was lost", async () => {
    const { usePlayerStore } = await import("@/stores/playerStore")
    const bag = globalThis as typeof globalThis & { __psSound?: unknown; __psWantPlaying?: boolean }
    bag.__psSound = null
    bag.__psWantPlaying = true
    const TrackPlayer = await catalogPlayer()
    TrackPlayer.add.mockClear()
    fetchSong.mockClear()

    usePlayerStore.setState({
      driveScreenFocused: true,
      driveAutoAdvance: true,
      playbackMode: "random",
      isPlaying: true,
      currentSong: driveSong as never,
    })

    usePlayerStore.getState().reconcileForegroundCatalogPlayback()
    await new Promise((r) => setTimeout(r, 50))
    expect(TrackPlayer.add).not.toHaveBeenCalled()
    expect(usePlayerStore.getState().isPlaying).toBe(true)
  })

  it("second drive entry loads one stream after exit and prepare", async () => {
    const sound1 = createMockSound({
      isLoaded: true,
      isPlaying: true,
      positionMillis: 0,
      durationMillis: 300_000,
    })
    const sound2 = createMockSound({
      isLoaded: true,
      isPlaying: true,
      positionMillis: 0,
      durationMillis: 300_000,
    })
    createAsync.mockResolvedValueOnce({ sound: sound1 }).mockResolvedValueOnce({ sound: sound2 })

    const { usePlayerStore } = await import("@/stores/playerStore")
    usePlayerStore.setState({ driveScreenFocused: true, driveAutoAdvance: true })
    usePlayerStore.getState().loadSong(driveSong as never, [3302], "random")
    await waitForCatalogAdd(1)

    usePlayerStore.getState().exitDriveMode()
    await new Promise((r) => setTimeout(r, 100))
    await usePlayerStore.getState().prepareCatalogAudioForDriveEntry()
    await new Promise((r) => setTimeout(r, 100))

    const second = { ...driveSong, number: 1200, id: "ps-1200", audioUrl: "https://example.com/1200.mp3" }
    usePlayerStore.setState({ driveScreenFocused: true })
    usePlayerStore.getState().enterDrivePlayback()
    usePlayerStore.getState().loadSong(second as never, [1200], "random")
    await waitForCatalogAdd(2)
    const TrackPlayer = await catalogPlayer()
    expect(TrackPlayer.reset).toHaveBeenCalled()
  })

  it("prepareCatalogAudioForDriveEntry clears native handle before a new drive start", async () => {
    const sound = createMockSound({
      isLoaded: true,
      isPlaying: true,
      positionMillis: 0,
      durationMillis: 300_000,
    })
    createAsync.mockResolvedValue({ sound })

    const { usePlayerStore } = await import("@/stores/playerStore")
    usePlayerStore.setState({ driveScreenFocused: true, driveAutoAdvance: true })
    usePlayerStore.getState().loadSong(driveSong as never, [3302], "random")
    await waitForCatalogAdd(1)

    usePlayerStore.getState().exitDriveMode()
    await new Promise((r) => setTimeout(r, 80))

    const TrackPlayer = await catalogPlayer()
    TrackPlayer.reset.mockClear()
    TrackPlayer.stop.mockClear()
    await usePlayerStore.getState().prepareCatalogAudioForDriveEntry()
    await new Promise((r) => setTimeout(r, 80))
    expect(TrackPlayer.reset.mock.calls.length + TrackPlayer.stop.mock.calls.length).toBeGreaterThan(0)
  })

  it("after leave Drive, next() does not fetch another song", async () => {
    const { usePlayerStore } = await import("@/stores/playerStore")
    const bag = globalThis as typeof globalThis & {
      __psStopAfterCurrentTrack?: boolean
      __psSound?: { setStatusAsync: () => Promise<void> }
    }
    bag.__psSound = {
      setStatusAsync: vi.fn().mockResolvedValue(undefined),
    }
    usePlayerStore.setState({
      driveAutoAdvance: true,
      playbackMode: "random",
      driveScreenFocused: true,
      currentSong: driveSong as never,
      queue: [3302],
    })
    usePlayerStore.getState().exitDriveMode()
    usePlayerStore.getState().next()
    expect(fetchSong).not.toHaveBeenCalled()
    expect(usePlayerStore.getState().currentSong).toBeNull()
    bag.__psSound = null
  })

  it("song page sync does not widen queue while stop-after-current is active", async () => {
    const { usePlayerStore } = await import("@/stores/playerStore")
    usePlayerStore.setState({
      currentSong: driveSong as never,
      queue: [3302],
      playbackMode: "default",
      stopQueueAfterCurrentTrack: true,
    })
    const bag = globalThis as typeof globalThis & { __psStopAfterCurrentTrack?: boolean }
    bag.__psStopAfterCurrentTrack = true

    usePlayerStore.getState().syncCurrentSong(driveSong as never, [3302, 1, 2, 3])
    expect(usePlayerStore.getState().queue).toEqual([3302])
    expect(usePlayerStore.getState().stopQueueAfterCurrentTrack).toBe(true)
  })

  it("after leaving Drive, song page play does not chain to PS 1 on track end", async () => {
    const sound = createMockSound({
      isLoaded: true,
      isPlaying: true,
      positionMillis: 1000,
      durationMillis: 300_000,
    })
    createAsync.mockResolvedValue({ sound })

    const { usePlayerStore } = await import("@/stores/playerStore")
    usePlayerStore.setState({ driveScreenFocused: true })
    usePlayerStore.getState().loadSong(driveSong as never, [3302], "random")
    await waitForCatalogAdd(1)

    usePlayerStore.getState().exitDriveMode()
    expect(usePlayerStore.getState().stopQueueAfterCurrentTrack).toBe(false)
    expect(usePlayerStore.getState().isPlaying).toBe(false)
    expect(usePlayerStore.getState().playbackMode).toBe("default")

    fetchSong.mockClear()
    const { __emitTrackPlayer, Event } = await catalogPlayerEvents()
    __emitTrackPlayer(Event.PlaybackQueueEnded, {})
    await new Promise((r) => setTimeout(r, 40))
    expect(fetchSong).not.toHaveBeenCalled()
    expect(usePlayerStore.getState().currentSong).toBeNull()
  })

  it("after leave Drive, stream attach failure does not skip to PS 1", async () => {
    const sound = createMockSound({
      isLoaded: true,
      isPlaying: true,
      positionMillis: 0,
      durationMillis: 300_000,
    })
    createAsync.mockResolvedValue({ sound })

    const { usePlayerStore } = await import("@/stores/playerStore")
    usePlayerStore.setState({ driveScreenFocused: true })
    usePlayerStore.getState().loadSong(driveSong as never, [3302], "random")
    await waitForCatalogAdd(1)

    usePlayerStore.getState().exitDriveMode()
    fetchSong.mockClear()

    const onStatus = sound.setOnPlaybackStatusUpdate.mock.calls.at(-1)?.[0] as (
      status: object,
    ) => void
    onStatus?.({ isLoaded: false, error: "network" })

    await new Promise((r) => setTimeout(r, 50))
    expect(fetchSong).not.toHaveBeenCalled()
    expect(usePlayerStore.getState().currentSong).toBeNull()
  })
})
