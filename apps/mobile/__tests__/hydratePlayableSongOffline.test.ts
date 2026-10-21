import { beforeEach, describe, expect, it, vi } from "vitest"

const { fetchSong, resolvePlaybackUri } = vi.hoisted(() => ({
  fetchSong: vi.fn(),
  resolvePlaybackUri: vi.fn(),
}))

vi.mock("@/lib/client", () => ({
  api: { fetchSong },
}))

vi.mock("@/lib/offlineAudio", () => ({
  resolvePlaybackUri,
}))

vi.mock("@/lib/playback/nativeCatalogPlayer", () => ({
  enqueueTrack: vi.fn(),
  nativeQueueLengthPastIndex: vi.fn(async () => 0),
  nativeRemoveUpcomingTracks: vi.fn(),
  songToTrack: vi.fn((song: { number: number }, url: string) => ({ id: `ps-${song.number}`, url })),
  trackIdToSongNumber: vi.fn(),
  getActiveCatalogTrackNumber: vi.fn(() => null),
}))

vi.mock("@/lib/playback/trackPlayerBridge", () => ({
  getTrackPlayer: vi.fn(),
  isTrackPlayerLinked: vi.fn(() => false),
}))

vi.mock("@/lib/playback/radioSession", () => ({
  getRadioSession: vi.fn(() => ({ kind: "casual" })),
  setRadioSession: vi.fn(),
  resetRadioSession: vi.fn(),
}))

import { hydratePlayableSong } from "@/lib/playback/radioAdvance"

describe("hydratePlayableSong offline", () => {
  beforeEach(() => {
    fetchSong.mockReset()
    resolvePlaybackUri.mockReset()
  })

  it("uses a saved local file without calling the API when seed has no audioUrl", async () => {
    resolvePlaybackUri.mockResolvedValue({
      uri: "file:///docs/offline-audio/12.mp3",
      local: true,
    })
    const song = await hydratePlayableSong(12, {
      id: "ps-12",
      number: 12,
      title: "Song 12",
      shortDescription: "",
      imageUrl: "",
      thumbnailUrl: "",
      themes: [],
      meaning: "",
      lyrics: "",
      translation: "",
      durationSeconds: 300,
      performer: "",
      videos: [],
      audioUrl: null,
    })
    expect(fetchSong).not.toHaveBeenCalled()
    expect(song?.audioUrl).toBe("file:///docs/offline-audio/12.mp3")
  })

  it("does not fall back to a stale file:// URI when the offline copy is gone", async () => {
    resolvePlaybackUri.mockResolvedValue(null)
    fetchSong.mockRejectedValue(new Error("offline"))
    const song = await hydratePlayableSong(12, {
      id: "ps-12",
      number: 12,
      title: "Song 12",
      shortDescription: "",
      imageUrl: "",
      thumbnailUrl: "",
      themes: [],
      meaning: "",
      lyrics: "",
      translation: "",
      durationSeconds: 300,
      performer: "",
      videos: [],
      audioUrl: "file:///docs/offline-audio/12.mp3",
    })
    expect(song).toBeNull()
  })
})
