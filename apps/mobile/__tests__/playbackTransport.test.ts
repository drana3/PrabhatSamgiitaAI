import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import playable from "@/assets/playable-audio-numbers.json"
import { apiSongDetail } from "./helpers/apiSongDetail"

/**
 * Next and Previous work from every source of the command (buttons, mini player, lock screen,
 * headphones, car) in plain lists and in saved playlists, and have a defined end (checkup P2).
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

const [A, B, C] = (playable as number[]).slice(0, 3) as [number, number, number]

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

const tick = (ms = 40) => new Promise((r) => setTimeout(r, ms))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function rntp(): Promise<any> {
  return await import("react-native-track-player")
}

/** The same wiring as realControllerDeps in lib/playerV2/services.ts, without the app-only modules. */
async function wireTransport(
  usePlayerStore: typeof import("@/stores/playerStore").usePlayerStore,
  transport: typeof import("@/lib/playerV2/transport"),
  repeatMode: "off" | "all" | "one" = "off",
) {
  const { hasPlayableAudio } = await import("@/lib/playableAudio")
  const { hydratePlayableSong } = await import("@/lib/playback/radioAdvance")
  transport.setTransportDeps(() => ({
    getPlayer: () => {
      const s = usePlayerStore.getState()
      return {
        currentSong: s.currentSong,
        queue: s.queue,
        playbackMode: s.playbackMode,
        playlistBounds: s.playlistBounds,
        position: s.position,
      }
    },
    getPrefs: () => ({ playMode: "this", repeatMode, versionByNumber: {} }) as never,
    loadSong: (song, queue, mode) => usePlayerStore.getState().loadSong(song, queue, mode),
    loadNumber: (n) => hydratePlayableSong(n),
    isPlayable: (n) => hasPlayableAudio(n),
    remember: () => undefined,
    seekTo: (s) => usePlayerStore.getState().seekTo(s),
  }))
}

async function activeUrl() {
  const rn = await rntp()
  return ((await rn.default.getActiveTrack()) as { url?: string } | null)?.url
}

describe("next and previous from the lock screen", () => {
  beforeEach(async () => {
    vi.resetModules()
    // The fake player is shared by the whole file: drop the listeners of the previous test's app.
    ;(await rntp()).__resetFakeTrackPlayer()
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true })))
    const { api } = await import("@/lib/client")
    vi.mocked(api.fetchSong).mockImplementation(async (n: number) => apiSongDetail(n) as never)
  })
  afterEach(() => vi.unstubAllGlobals())

  async function boot(mode: "default" | "playlist") {
    const { usePlayerStore } = await import("@/stores/playerStore")
    const { playbackService } = await import("../playbackService")
    const transport = await import("@/lib/playerV2/transport")
    await wireTransport(usePlayerStore, transport)
    const rn = await rntp()
    await playbackService({ playerStore: () => usePlayerStore, transport: () => transport })
    usePlayerStore.getState().loadSong(seed(A) as never, [A, B, C], mode)
    await vi.waitFor(async () => expect(await activeUrl()).toBe(`https://example.com/${A}.mp3`))
    return { usePlayerStore, rn }
  }

  for (const mode of ["default", "playlist"] as const) {
    it(`Next and Previous walk a ${mode} list`, async () => {
      const { usePlayerStore, rn } = await boot(mode)

      rn.__emitTrackPlayer(rn.Event.RemoteNext, {})
      await vi.waitFor(() => expect(usePlayerStore.getState().currentSong?.number).toBe(B))
      await vi.waitFor(async () => expect(await activeUrl()).toBe(`https://example.com/${B}.mp3`))

      usePlayerStore.setState({ position: 0 })
      rn.__emitTrackPlayer(rn.Event.RemotePrevious, {})
      await vi.waitFor(() => expect(usePlayerStore.getState().currentSong?.number).toBe(A))
    })
  }

  it("Next on the last song stays where it is; Previous on the first restarts it", async () => {
    const { usePlayerStore, rn } = await boot("default")
    rn.__emitTrackPlayer(rn.Event.RemotePrevious, {})
    await tick()
    expect(usePlayerStore.getState().currentSong?.number).toBe(A)
    expect(rn.default.seekTo).toHaveBeenCalledWith(0)

    usePlayerStore.getState().loadSong(seed(C) as never, [A, B, C], "default")
    await vi.waitFor(async () => expect(await activeUrl()).toBe(`https://example.com/${C}.mp3`))
    await tick()
    rn.__emitTrackPlayer(rn.Event.RemoteNext, {})
    await tick()
    expect(usePlayerStore.getState().currentSong?.number).toBe(C)
    expect(await activeUrl()).toBe(`https://example.com/${C}.mp3`)
    expect(rn.default.skipToNext).not.toHaveBeenCalled()
  })

  it("Previous after 3 seconds restarts the song instead of leaving it", async () => {
    const { usePlayerStore, rn } = await boot("default")
    usePlayerStore.getState().loadSong(seed(B) as never, [A, B, C], "default")
    await vi.waitFor(() => expect(usePlayerStore.getState().currentSong?.number).toBe(B))
    usePlayerStore.setState({ position: 40 })
    rn.__emitTrackPlayer(rn.Event.RemotePrevious, {})
    await tick()
    expect(usePlayerStore.getState().currentSong?.number).toBe(B)
    expect(rn.default.seekTo).toHaveBeenCalledWith(0)
  })
})

describe("every play has a real queue", () => {
  beforeEach(() => vi.resetModules())

  it("a song played alone is a queue of one, never the stale list of an earlier screen", async () => {
    const { usePlayerStore } = await import("@/stores/playerStore")
    usePlayerStore.getState().loadSong(seed(A) as never, [A, B, C], "default")
    expect(usePlayerStore.getState().queue).toEqual([A, B, C])
    usePlayerStore.getState().loadSong(seed(999) as never, undefined, "default")
    expect(usePlayerStore.getState().queue).toEqual([999])
  })

  it("canSkipNext is false on the last song and in a queue of one", async () => {
    const { usePlayerStore } = await import("@/stores/playerStore")
    const transport = await import("@/lib/playerV2/transport")
    await wireTransport(usePlayerStore, transport)
    const { canSkipNext } = transport
    usePlayerStore.getState().loadSong(seed(B) as never, [A, B, C], "default")
    expect(canSkipNext()).toBe(true)
    usePlayerStore.getState().loadSong(seed(C) as never, [A, B, C], "default")
    expect(canSkipNext()).toBe(false)
    usePlayerStore.getState().loadSong(seed(A) as never, [A], "default")
    expect(canSkipNext()).toBe(false)
  })
})
