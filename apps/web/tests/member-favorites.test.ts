import { afterEach, describe, expect, it, vi } from "vitest"

import { addFavoriteSong, removeFavoriteSong } from "@/lib/member"

describe("member favorites client", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("posts favorites with credentials and returns song numbers", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [42, 7],
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(addFavoriteSong(42)).resolves.toEqual({ ok: true, favorites: [42, 7] })
    expect(fetchMock).toHaveBeenCalledWith("/api/member/favorites", expect.objectContaining({
      method: "POST",
      credentials: "same-origin",
      body: JSON.stringify({ song_number: 42 }),
    }))
  })

  it("surfaces API detail when saving fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ detail: "Sign in is required" }),
    }))

    await expect(addFavoriteSong(1)).resolves.toEqual({
      ok: false,
      error: "Sign in is required",
    })
  })

  it("deletes favorites with credentials", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(removeFavoriteSong(9)).resolves.toEqual({ ok: true, favorites: [] })
    expect(fetchMock).toHaveBeenCalledWith("/api/member/favorites/9", expect.objectContaining({
      method: "DELETE",
      credentials: "same-origin",
    }))
  })
})
