import { beforeEach, describe, expect, it, vi } from "vitest"

import type { MemberPlaylist } from "@prabhat/core"

import { apiSongDetail } from "./helpers/apiSongDetail"

const loadSong = vi.fn()
const setState = vi.fn()
const fetchSong = vi.fn()

vi.mock("@/stores/playerStore", () => ({
  usePlayerStore: {
    setState,
    getState: () => ({ loadSong }),
  },
}))

vi.mock("@/lib/client", () => ({
  api: { fetchSong },
}))

vi.mock("@/lib/songCache", () => ({
  peekSongDetail: vi.fn(() => null),
}))

vi.mock("@/lib/lyricSearch", () => ({
  catalogSongsByNumbers: vi.fn((numbers: number[]) =>
    numbers.map((n) => ({ number: n, title: `PS ${n}`, firstLine: `Line ${n}` })),
  ),
}))

function playlist(overrides: Partial<MemberPlaylist> = {}): MemberPlaylist {
  return {
    id: "pl-morning",
    name: "Morning",
    songs: [
      { song_number: 1000, position: 1 },
      { song_number: 10, position: 2 },
      { song_number: 1001, position: 3 },
    ],
    ...overrides,
  } as MemberPlaylist
}

describe("playPlaylist", () => {
  beforeEach(() => {
    vi.resetModules()
    loadSong.mockReset()
    setState.mockReset()
    fetchSong.mockReset()
    fetchSong.mockImplementation(async (n: number) => apiSongDetail(n))
  })

  it("orders songs by playlist position", async () => {
    const { playlistSongNumbers, playPlaylist } = await import("@/lib/playPlaylist")
    expect(playlistSongNumbers(playlist())).toEqual([1000, 10, 1001])
    await playPlaylist(playlist())
    expect(loadSong).toHaveBeenCalledTimes(1)
    const [, numbers, mode] = loadSong.mock.calls[0]!
    expect(numbers).toEqual([1000, 10, 1001])
    expect(mode).toBe("playlist")
  })

  it("sets active playlist metadata before loading audio", async () => {
    const { playPlaylist } = await import("@/lib/playPlaylist")
    await playPlaylist(playlist())
    expect(setState).toHaveBeenCalledWith({
      activePlaylist: { id: "pl-morning", name: "Morning" },
    })
    expect(loadSong).toHaveBeenCalled()
  })

  it("starts at startAt when it is in the playlist", async () => {
    const { playPlaylist } = await import("@/lib/playPlaylist")
    await playPlaylist(playlist(), 1001)
    expect(loadSong.mock.calls[0]?.[0].number).toBe(1001)
  })

  it("skips an unplayable first song to the next playable entry", async () => {
    const { playPlaylist } = await import("@/lib/playPlaylist")
    await playPlaylist({
      ...playlist(),
      songs: [{ song_number: 10, position: 1 }, { song_number: 1000, position: 2 }],
    } as MemberPlaylist)
    expect(loadSong.mock.calls[0]?.[0].number).toBe(1000)
  })

  it("delegates hydration to the player when the starter has no stream URL", async () => {
    const { playPlaylist } = await import("@/lib/playPlaylist")
    const { peekSongDetail } = await import("@/lib/songCache")
    vi.mocked(peekSongDetail).mockReturnValue(null)

    await playPlaylist({
      id: "p1",
      name: "Solo",
      songs: [{ song_number: 1000, position: 1 }],
    } as MemberPlaylist)

    expect(fetchSong).not.toHaveBeenCalled()
    expect(loadSong).toHaveBeenCalledTimes(1)
    expect(loadSong.mock.calls[0]?.[0].number).toBe(1000)
  })

  it("returns an error when the playlist is empty", async () => {
    const { playPlaylist } = await import("@/lib/playPlaylist")
    const message = await playPlaylist({
      id: "empty",
      name: "Empty",
      songs: [],
    } as MemberPlaylist)
    expect(message).toMatch(/no songs/i)
    expect(loadSong).not.toHaveBeenCalled()
  })

  it("still hands off to the player when the starter has no cached URL", async () => {
    const { playPlaylist } = await import("@/lib/playPlaylist")
    const message = await playPlaylist({
      id: "p1",
      name: "One",
      songs: [{ song_number: 99999, position: 1 }],
    } as MemberPlaylist)
    expect(message).toBeNull()
    expect(loadSong).toHaveBeenCalledTimes(1)
    expect(loadSong.mock.calls[0]?.[0].number).toBe(99999)
  })
})
