import { beforeEach, describe, expect, it, vi } from "vitest"

type PlayerSlice = {
  driveAutoAdvance: boolean
  playbackMode: "default" | "playlist" | "random"
  activePlaylist: { id: string; name: string } | null
  playlistBounds: number[] | null
  queue: number[]
  currentSong: { number: number; id: string } | null
  hasAudio: boolean
}

let playerState: PlayerSlice

vi.mock("@/stores/playerStore", () => ({
  usePlayerStore: {
    getState: () => playerState,
    setState: (patch: Partial<PlayerSlice>) => {
      playerState = { ...playerState, ...patch }
    },
  },
}))

describe("releasePlaybackForDeletedPlaylist", () => {
  beforeEach(async () => {
    vi.resetModules()
    playerState = {
      driveAutoAdvance: false,
      playbackMode: "default",
      activePlaylist: null,
      playlistBounds: null,
      queue: [],
      currentSong: null,
      hasAudio: false,
    }
  })

  it("switches Drive playlist mode to random without clearing the current song", async () => {
    const { releasePlaybackForDeletedPlaylist } = await import("@/lib/playlistPlayerBridge")

    playerState = {
      driveAutoAdvance: true,
      playbackMode: "playlist",
      activePlaylist: { id: "p1", name: "Morning" },
      playlistBounds: [10, 11],
      queue: [10, 11],
      currentSong: { number: 10, id: "ps-10" },
      hasAudio: true,
    }

    releasePlaybackForDeletedPlaylist("p1")

    expect(playerState.playbackMode).toBe("random")
    expect(playerState.activePlaylist).toBeNull()
    expect(playerState.playlistBounds).toBeNull()
    expect(playerState.currentSong?.number).toBe(10)
    expect(playerState.driveAutoAdvance).toBe(true)
  })

  it("no-ops when another playlist is active", async () => {
    const { releasePlaybackForDeletedPlaylist } = await import("@/lib/playlistPlayerBridge")

    playerState = {
      driveAutoAdvance: true,
      playbackMode: "random",
      activePlaylist: { id: "other", name: "Other" },
      playlistBounds: null,
      queue: [],
      currentSong: null,
      hasAudio: false,
    }

    releasePlaybackForDeletedPlaylist("p1")

    expect(playerState.activePlaylist?.id).toBe("other")
    expect(playerState.playbackMode).toBe("random")
  })
})