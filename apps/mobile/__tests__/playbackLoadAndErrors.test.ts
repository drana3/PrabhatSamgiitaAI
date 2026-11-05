import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { apiSongDetail } from "./helpers/apiSongDetail"

/**
 * Loading and failing: pause on the spinner cancels the load (P6), a failure says why and Play retries (P7),
 * a song that never starts times out (P13), a list stops after a few failures in a row (P14).
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
vi.mock("@/lib/playback/playerError", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/playback/playerError")>()),
  LOAD_TIMEOUT_MS: 80,
}))

function seed(number: number, audioUrl: string | null = `https://example.com/${number}.mp3`) {
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
    audioUrl,
    mediaHydrated: Boolean(audioUrl),
  }
}

const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function player(): Promise<any> {
  return await import("react-native-track-player")
}

describe("loading and failing", () => {
  beforeEach(async () => {
    vi.resetModules()
    ;(await player()).__resetFakeTrackPlayer()
    // The media cache lives on globalThis and survives module resets.
    ;(globalThis as { __psMediaCache?: Map<number, unknown> }).__psMediaCache?.clear()
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true })))
    const { api } = await import("@/lib/client")
    vi.mocked(api.fetchSong).mockImplementation(async (n: number) => apiSongDetail(n) as never)
  })
  afterEach(() => vi.unstubAllGlobals())

  it("pause on the spinner cancels the load: the song does not start when the network answers", async () => {
    const { usePlayerStore } = await import("@/stores/playerStore")
    const { api } = await import("@/lib/client")
    const rn = await player()
    let answer: (v: unknown) => void = () => undefined
    vi.mocked(api.fetchSong).mockImplementation(() => new Promise((resolve) => (answer = resolve)) as never)

    usePlayerStore.getState().loadSong(seed(1, null) as never, [1, 2], "default")
    await vi.waitFor(() => expect(usePlayerStore.getState().isBuffering).toBe(true))
    usePlayerStore.getState().pause()
    expect(usePlayerStore.getState().isBuffering).toBe(false)
    expect(usePlayerStore.getState().isPlaying).toBe(false)

    answer(apiSongDetail(1))
    await tick(60)
    expect(rn.default.play).not.toHaveBeenCalled()
    expect(usePlayerStore.getState().isPlaying).toBe(false)

    // one tap on Play starts it
    vi.mocked(api.fetchSong).mockImplementation(async (n: number) => apiSongDetail(n) as never)
    usePlayerStore.getState().togglePlay()
    await vi.waitFor(() => expect(rn.default.play).toHaveBeenCalledTimes(1))
  })

  it("no connection and no saved copy says offline; a song without audio says so", async () => {
    const { usePlayerStore } = await import("@/stores/playerStore")
    const { api } = await import("@/lib/client")
    vi.mocked(api.fetchSong).mockRejectedValue(new Error("Network request failed"))
    usePlayerStore.getState().loadSong(seed(1, null) as never, [1], "default")
    await vi.waitFor(() => expect(usePlayerStore.getState().audioError).toBe("offline"))

    vi.mocked(api.fetchSong).mockResolvedValue({ number: 2, title: "PS 2", first_line: "x", media: [] } as never)
    usePlayerStore.getState().loadSong(seed(2, null) as never, [2], "default")
    await vi.waitFor(() => expect(usePlayerStore.getState().audioError).toBe("no-stream"))
  })

  it("Play after an error loads the song again", async () => {
    const { usePlayerStore } = await import("@/stores/playerStore")
    const rn = await player()
    usePlayerStore.getState().loadSong(seed(1) as never, [1, 2], "default")
    await vi.waitFor(() => expect(rn.default.play).toHaveBeenCalledTimes(1))
    await vi.waitFor(() => expect(usePlayerStore.getState().isBuffering).toBe(false))

    rn.__emitTrackPlayer(rn.Event.PlaybackError, { message: "boom" })
    await vi.waitFor(() => expect(usePlayerStore.getState().audioError).toBe("failed"))
    expect(usePlayerStore.getState().isPlaying).toBe(false)

    rn.default.reset.mockClear()
    usePlayerStore.getState().togglePlay()
    await vi.waitFor(() => expect(usePlayerStore.getState().audioError).toBeNull())
    await vi.waitFor(() => expect(rn.default.play).toHaveBeenCalledTimes(2))
  })

  it("a song that never starts ends the spinner with a timeout message", async () => {
    const { usePlayerStore } = await import("@/stores/playerStore")
    const rn = await player()
    rn.default.play.mockImplementationOnce(async () => undefined) // accepted, never plays
    usePlayerStore.getState().loadSong(seed(1) as never, [1], "default")
    await vi.waitFor(() => expect(rn.default.play).toHaveBeenCalled())
    expect(usePlayerStore.getState().isBuffering).toBe(true)
    await vi.waitFor(() => expect(usePlayerStore.getState().audioError).toBe("timeout"), { timeout: 2000 })
    expect(usePlayerStore.getState().isBuffering).toBe(false)
    expect(usePlayerStore.getState().isPlaying).toBe(false)
  })

  it("a list stops after three failures in a row instead of skipping forever", async () => {
    const { usePlayerStore } = await import("@/stores/playerStore")
    const rn = await player()
    usePlayerStore.getState().loadSong(seed(1) as never, [1, 2, 3, 4, 5], "playlist")
    await vi.waitFor(() => expect(rn.default.play).toHaveBeenCalled())
    await vi.waitFor(() => expect(usePlayerStore.getState().isBuffering).toBe(false))
    rn.default.pause.mockClear()
    // A skip onto a broken song does not start playing it
    rn.default.skipToNext.mockImplementation(async () => undefined)

    for (let i = 0; i < 3; i += 1) {
      rn.__emitTrackPlayer(rn.Event.PlaybackError, { message: "boom" })
      await tick(20)
    }
    expect(usePlayerStore.getState().audioError).toBe("failed")
    expect(usePlayerStore.getState().isPlaying).toBe(false)
    expect(rn.default.pause).toHaveBeenCalled()
  })

  it("a song that plays resets the count of failures", async () => {
    const { usePlayerStore } = await import("@/stores/playerStore")
    const rn = await player()
    usePlayerStore.getState().loadSong(seed(1) as never, [1, 2, 3, 4, 5], "playlist")
    await vi.waitFor(() => expect(rn.default.play).toHaveBeenCalled())
    await vi.waitFor(() => expect(usePlayerStore.getState().isBuffering).toBe(false))

    rn.default.skipToNext.mockImplementation(async () => undefined)
    for (let i = 0; i < 2; i += 1) {
      rn.__emitTrackPlayer(rn.Event.PlaybackError, { message: "boom" })
      await tick(20)
      rn.__emitTrackPlayer(rn.Event.PlaybackState, { state: rn.State.Playing })
    }
    rn.__emitTrackPlayer(rn.Event.PlaybackError, { message: "boom" })
    await tick(20)
    expect(usePlayerStore.getState().audioError).toBeNull()
  })
})
