import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/client", () => ({
  api: {
    fetchSong: vi.fn(),
    fetchSongLocalization: vi.fn(),
    fetchNotation: vi.fn(),
  },
}))

import { api } from "@/lib/client"
import {
  fetchNotationCached,
  fetchSongDetailCached,
  fetchSongLocalizationCached,
  peekSongDetail,
} from "@/lib/songCache"

describe("songCache", () => {
  beforeEach(() => {
    vi.mocked(api.fetchSong).mockReset()
    vi.mocked(api.fetchSongLocalization).mockReset()
    vi.mocked(api.fetchNotation).mockReset()
  })

  it("caches song detail after the first fetch", async () => {
    vi.mocked(api.fetchSong).mockResolvedValue({
      number: 1,
      title: "Bandhu",
      is_verified: true,
      related_songs: [],
      media: [],
    } as never)

    const first = await fetchSongDetailCached(1)
    const second = await fetchSongDetailCached(1)
    expect(first?.number).toBe(1)
    expect(second?.number).toBe(1)
    expect(api.fetchSong).toHaveBeenCalledTimes(1)
    expect(peekSongDetail(1)?.title).toBe("Bandhu")
  })

  it("caches localization meaning", async () => {
    vi.mocked(api.fetchSongLocalization).mockResolvedValue({
      localized_meaning: "अर्थ",
      localized_title: null,
    } as never)
    const first = await fetchSongLocalizationCached(1, "Hindi")
    const second = await fetchSongLocalizationCached(1, "Hindi")
    expect(first?.localized_meaning).toBe("अर्थ")
    expect(second?.localized_meaning).toBe("अर्थ")
    expect(api.fetchSongLocalization).toHaveBeenCalledTimes(1)
  })

  it("caches notation by tonic", async () => {
    vi.mocked(api.fetchNotation).mockResolvedValue({
      tonic: "C",
      notation: { lines: [] },
    } as never)
    await fetchNotationCached(1, "C")
    await fetchNotationCached(1, "C")
    expect(api.fetchNotation).toHaveBeenCalledTimes(1)
  })
})
