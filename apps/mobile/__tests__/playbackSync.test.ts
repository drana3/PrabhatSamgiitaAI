import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { apiSongDetail } from "./helpers/apiSongDetail"
import { createRemoteHandlers, type RemoteDeps } from "@/lib/playback/remoteCommands"
import { patchForSignal, signalFromState } from "@/lib/playback/nativeSignals"

/**
 * The UI follows the sound: a pause from the lock screen, headphones or a phone call reaches the
 * play button, and Play after it needs one tap (checkup P1).
 */

vi.mock("expo-av", () => ({
  Audio: {
    Sound: { createAsync: vi.fn() },
    setAudioModeAsync: vi.fn(async () => undefined),
    setIsEnabledAsync: vi.fn(async () => undefined),
  },
}))
vi.mock("@/lib/client", () => ({ api: { fetchSong: vi.fn() } }))
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

const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function player(): Promise<any> {
  return await import("react-native-track-player")
}

async function startPlaying() {
  const { usePlayerStore } = await import("@/stores/playerStore")
  const rn = await player()
  usePlayerStore.getState().loadSong(seed(1) as never, [1, 2, 3], "playlist")
  await vi.waitFor(() => expect(rn.default.play).toHaveBeenCalled())
  await vi.waitFor(() => expect(usePlayerStore.getState().isBuffering).toBe(false))
  return { usePlayerStore, rn }
}

describe("signals", () => {
  it("maps native states to signals", () => {
    expect(signalFromState("playing")).toBe("playing")
    expect(signalFromState("paused")).toBe("paused")
    expect(signalFromState("loading")).toBe("buffering")
    expect(signalFromState("none")).toBe("stopped")
  })

  it("a pause outside a track change always wins; inside one it is noise", () => {
    expect(patchForSignal("paused", { inTransition: false }, { wantPlaying: true })).toEqual({
      isPlaying: false,
      isBuffering: false,
      wantPlaying: false,
    })
    expect(patchForSignal("paused", { inTransition: true }, { wantPlaying: true })).toBeNull()
    expect(patchForSignal("wants-pause", { inTransition: false }, { wantPlaying: true })?.wantPlaying).toBe(false)
  })
})

describe("playback state sync", () => {
  beforeEach(async () => {
    vi.resetModules()
    // The fake player is shared by the whole file: drop the listeners of the previous test's app.
    ;(await player()).__resetFakeTrackPlayer()
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true })))
    const { api } = await import("@/lib/client")
    vi.mocked(api.fetchSong).mockImplementation(async (n: number) => apiSongDetail(n) as never)
  })
  afterEach(() => vi.unstubAllGlobals())

  it("a pause from the lock screen or headphones reaches the button, and one tap resumes", async () => {
    const { usePlayerStore, rn } = await startPlaying()
    expect(usePlayerStore.getState().isPlaying).toBe(true)

    rn.__emitTrackPlayer(rn.Event.PlaybackState, { state: rn.State.Paused })
    expect(usePlayerStore.getState().isPlaying).toBe(false)

    rn.default.play.mockClear()
    usePlayerStore.getState().togglePlay()
    expect(usePlayerStore.getState().isPlaying).toBe(true)
    await vi.waitFor(() => expect(rn.default.play).toHaveBeenCalledTimes(1))
  })

  it("play-when-ready false (a call, Siri, another app) pauses the button", async () => {
    const { usePlayerStore, rn } = await startPlaying()
    rn.__emitTrackPlayer(rn.Event.PlaybackPlayWhenReadyChanged, { playWhenReady: false })
    expect(usePlayerStore.getState().isPlaying).toBe(false)
  })

  it("after a call ends and the system resumes the sound, the button shows playing again", async () => {
    const { usePlayerStore, rn } = await startPlaying()
    rn.__emitTrackPlayer(rn.Event.PlaybackState, { state: rn.State.Paused })
    expect(usePlayerStore.getState().isPlaying).toBe(false)
    rn.__emitTrackPlayer(rn.Event.PlaybackState, { state: rn.State.Playing })
    expect(usePlayerStore.getState().isPlaying).toBe(true)
  })

  it("the pause the app causes while swapping tracks does not flip the button", async () => {
    const { usePlayerStore, rn } = await startPlaying()
    usePlayerStore.getState().loadSong(seed(5) as never, [5], "default")
    rn.__emitTrackPlayer(rn.Event.PlaybackState, { state: rn.State.Stopped })
    rn.__emitTrackPlayer(rn.Event.PlaybackPlayWhenReadyChanged, { playWhenReady: false })
    expect(usePlayerStore.getState().isPlaying).toBe(true)
    await vi.waitFor(() => expect(usePlayerStore.getState().isBuffering).toBe(false))
    expect(usePlayerStore.getState().currentSong?.number).toBe(5)
  })

  it("back in the foreground the store asks the player and corrects a missed pause", async () => {
    const { usePlayerStore, rn } = await startPlaying()
    // The JS side missed the pause event while suspended: the sound is paused natively.
    rn.default.getPlaybackState.mockResolvedValueOnce({ state: rn.State.Paused })
    usePlayerStore.getState().reconcileForegroundCatalogPlayback()
    await vi.waitFor(() => expect(usePlayerStore.getState().isPlaying).toBe(false))
  })
})

describe("lock-screen commands", () => {
  beforeEach(async () => {
    vi.resetModules()
    // The fake player is shared by the whole file: drop the listeners of the previous test's app.
    ;(await player()).__resetFakeTrackPlayer()
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true })))
    const { api } = await import("@/lib/client")
    vi.mocked(api.fetchSong).mockImplementation(async (n: number) => apiSongDetail(n) as never)
  })
  afterEach(() => vi.unstubAllGlobals())

  it("Remote Pause stops the sound and the button; Remote Play starts both", async () => {
    const { usePlayerStore, rn } = await startPlaying()
    const { playbackService } = await import("../playbackService")
    await playbackService({
      playerStore: () => usePlayerStore,
      transport: () => null,
    })
    rn.__emitTrackPlayer(rn.Event.RemotePause, {})
    expect(usePlayerStore.getState().isPlaying).toBe(false)
    expect(rn.default.pause).toHaveBeenCalled()

    rn.default.play.mockClear()
    rn.__emitTrackPlayer(rn.Event.RemotePlay, {})
    expect(usePlayerStore.getState().isPlaying).toBe(true)
    await vi.waitFor(() => expect(rn.default.play).toHaveBeenCalled())
  })
})

function remoteDeps(over: Partial<RemoteDeps> = {}): RemoteDeps & Record<string, ReturnType<typeof vi.fn>> {
  return {
    hasSong: vi.fn(() => true),
    isPlaying: vi.fn(() => true),
    appPlay: vi.fn(),
    appPause: vi.fn(),
    appNext: vi.fn(),
    appPrevious: vi.fn(),
    appSeek: vi.fn(),
    nativePlay: vi.fn(async () => undefined),
    nativePause: vi.fn(async () => undefined),
    nativeStop: vi.fn(async () => undefined),
    nativeSeek: vi.fn(async () => undefined),
    nativeNext: vi.fn(async () => undefined),
    nativePrevious: vi.fn(async () => undefined),
    ...over,
  } as never
}

describe("remote commands", () => {
  it("go through the app when it has a song, to the native player when it does not", () => {
    const withSong = remoteDeps()
    const a = createRemoteHandlers(withSong)
    a.onPause()
    a.onNext()
    expect(withSong.appPause).toHaveBeenCalled()
    expect(withSong.appNext).toHaveBeenCalled()
    expect(withSong.nativePause).not.toHaveBeenCalled()

    const cold = remoteDeps({ hasSong: vi.fn(() => false) })
    const b = createRemoteHandlers(cold)
    b.onPause()
    b.onPrevious()
    expect(cold.nativePause).toHaveBeenCalled()
    expect(cold.nativePrevious).toHaveBeenCalled()
  })

  it("an interruption pauses, and resumes only if we were playing and it was not permanent", () => {
    const deps = remoteDeps()
    const r = createRemoteHandlers(deps)
    r.onDuck({ paused: true, permanent: false })
    expect(deps.appPause).toHaveBeenCalledTimes(1)
    r.onDuck({ paused: false, permanent: false })
    expect(deps.appPlay).toHaveBeenCalledTimes(1)

    const idle = remoteDeps({ isPlaying: vi.fn(() => false) })
    const r2 = createRemoteHandlers(idle)
    r2.onDuck({ paused: true, permanent: false })
    r2.onDuck({ paused: false, permanent: false })
    expect(idle.appPause).not.toHaveBeenCalled()
    expect(idle.appPlay).not.toHaveBeenCalled()

    const perm = remoteDeps()
    const r3 = createRemoteHandlers(perm)
    r3.onDuck({ paused: true, permanent: true })
    r3.onDuck({ paused: false, permanent: false })
    expect(perm.appPause).toHaveBeenCalledTimes(1)
    expect(perm.appPlay).not.toHaveBeenCalled()
  })

  it("seeks are ignored when the position is not a number", () => {
    const deps = remoteDeps()
    createRemoteHandlers(deps).onSeek(Number.NaN)
    expect(deps.appSeek).not.toHaveBeenCalled()
  })
})
