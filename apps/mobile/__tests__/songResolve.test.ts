import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/client", () => ({
  api: {
    fetchSong: vi.fn(),
    fetchNotation: vi.fn(),
  },
}))

import { api } from "@/lib/client"
import { songPlaceholder } from "@/lib/songMap"
import { instantSongBundle, rememberSongPreview, resolveSongBundle } from "@/lib/songs"

describe("instant song open", () => {
  beforeEach(() => {
    vi.mocked(api.fetchSong).mockReset()
    vi.mocked(api.fetchNotation).mockReset()
  })

  it("paints a catalog song immediately from the tapped search row", () => {
    rememberSongPreview(
      songPlaceholder(88, {
        title: "Bandhu from search",
        shortDescription: "Opening line from search",
      }),
    )
    const bundle = instantSongBundle("ps-88")
    expect(bundle?.song.number).toBe(88)
    expect(bundle?.song.title).toBe("Bandhu from search")
  })

  it("keeps that song when the live detail request fails", async () => {
    rememberSongPreview(songPlaceholder(89, { title: "Kept after timeout" }))
    vi.mocked(api.fetchSong).mockResolvedValue(null)
    const bundle = await resolveSongBundle(["ps-89"])
    expect(bundle?.song.title).toBe("Kept after timeout")
    expect(bundle?.song.number).toBe(89)
  })

  it("does not report a valid catalog number as missing", async () => {
    vi.mocked(api.fetchSong).mockResolvedValue(null)
    const bundle = await resolveSongBundle("ps-12")
    expect(bundle?.song.number).toBe(12)
    expect(bundle?.song.id).toBe("ps-12")
  })

  it("returns null only for unreadable song ids", async () => {
    expect(instantSongBundle("nope")).toBeNull()
    expect(await resolveSongBundle("nope")).toBeNull()
  })
})
