import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/client", () => ({
  api: {
    fetchMemberPlaylists: vi.fn(),
    createMemberPlaylist: vi.fn(),
    renameMemberPlaylist: vi.fn(),
    deleteMemberPlaylist: vi.fn(),
    addMemberPlaylistSong: vi.fn(),
    removeMemberPlaylistSong: vi.fn(),
  },
}))

vi.mock("@/lib/memberAuth", () => ({
  memberAuthAvailable: () => true,
}))

vi.mock("@/stores/authStore", () => ({
  useAuthStore: {
    getState: () => ({ mode: "signed_in" }),
  },
}))

vi.mock("@/lib/playlistCache", () => ({
  peekPlaylistCache: vi.fn(() => null),
  readPlaylistCache: vi.fn().mockResolvedValue([]),
  writePlaylistCache: vi.fn().mockResolvedValue(undefined),
  writePlaylistCacheSoon: vi.fn(),
  clearPlaylistCache: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/playlistSyncQueue", () => ({
  bindPlaylistSyncHandlers: vi.fn(),
  enqueuePlaylistSync: vi.fn(),
  flushPlaylistSyncNow: vi.fn(),
  resetPlaylistSyncQueue: vi.fn(),
}))

describe("playlistStore optimistic updates", () => {
  beforeEach(async () => {
    const { usePlaylistStore } = await import("@/stores/playlistStore")
    usePlaylistStore.setState({ playlists: [], loading: false, syncing: false, error: null })
  })

  it("adds a song locally before server sync", async () => {
    const { usePlaylistStore } = await import("@/stores/playlistStore")
    usePlaylistStore.setState({
      playlists: [{ id: "p1", name: "Morning", songs: [{ song_number: 1, position: 1 }] }],
    })
    const result = await usePlaylistStore.getState().addSong("p1", 2)
    expect(result).toMatchObject({ id: "p1", songs: [{ song_number: 1 }, { song_number: 2 }] })
    expect(usePlaylistStore.getState().playlists[0]?.songs).toHaveLength(2)
  })
})
