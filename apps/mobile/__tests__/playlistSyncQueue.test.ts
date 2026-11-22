import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/client", () => ({
  api: {
    createMemberPlaylist: vi.fn(),
    deleteMemberPlaylist: vi.fn(),
    renameMemberPlaylist: vi.fn(),
    addMemberPlaylistSong: vi.fn(),
    removeMemberPlaylistSong: vi.fn(),
  },
}))

vi.mock("@/lib/playlistCache", () => ({
  writePlaylistCache: vi.fn().mockResolvedValue(undefined),
}))

describe("playlistSyncQueue", () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    const { resetPlaylistSyncQueue } = await import("@/lib/playlistSyncQueue")
    resetPlaylistSyncQueue()
  })

  it("hides server playlists that were deleted until refresh confirms absence", async () => {
    const { mergePlaylistsFromServer, deletePlaylistOnServer, resetPlaylistSyncQueue } =
      await import("@/lib/playlistSyncQueue")
    const { api } = await import("@/lib/client")
    vi.mocked(api.deleteMemberPlaylist).mockResolvedValue(undefined)

    await deletePlaylistOnServer("11111111-1111-1111-1111-111111111111")

    const remote = [
      { id: "11111111-1111-1111-1111-111111111111", name: "Old", songs: [] },
      { id: "22222222-2222-2222-2222-222222222222", name: "Keep", songs: [] },
    ]
    const merged = mergePlaylistsFromServer(remote)
    expect(merged).toHaveLength(1)
    expect(merged[0]?.id).toBe("22222222-2222-2222-2222-222222222222")

    resetPlaylistSyncQueue()
    expect(mergePlaylistsFromServer(remote)).toHaveLength(2)
  })

  it("cancels a local-only playlist without calling the API", async () => {
    const { deletePlaylistOnServer, enqueuePlaylistSync } = await import("@/lib/playlistSyncQueue")
    const { api } = await import("@/lib/client")

    enqueuePlaylistSync({ type: "create", tempId: "local-1", name: "Draft" })
    await deletePlaylistOnServer("local-1")

    expect(api.deleteMemberPlaylist).not.toHaveBeenCalled()
  })
})