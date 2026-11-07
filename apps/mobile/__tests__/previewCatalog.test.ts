import { readFileSync } from "node:fs"
import path from "node:path"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => undefined),
    removeItem: vi.fn(async () => undefined),
  },
}))
vi.mock("@/lib/client", () => ({ api: { fetchSongs: vi.fn() } }))

import type { SongSummary } from "@prabhat/core"

import { MOCK_STORAGE } from "@/lib/fixtures/songsMock"
import { homeSong } from "@/lib/fixtures/home"
import { LEARN_SONG_TITLES } from "@/lib/fixtures/learn"
import { PREVIEW_SONG_PICKS } from "@/lib/fixtures/notifications"
import { TODAY_FIXTURE_SONGS } from "@/lib/fixtures/today"
import { REAL_SONGS_1_TO_7 } from "@/lib/fixtures/realSongs"
import { FALLBACK_NOTICE, previewSummary, previewTitle, previewTitleOrNumber, resolvePreviewRows, usePreviewCatalog } from "@/lib/previewCatalog"
import { ensurePreviewCatalog } from "@/lib/previewCatalogLoader"
import { api } from "@/lib/client"
import { resetCatalogMemory } from "@/lib/catalog"
import { displayTitle } from "@/lib/songsV2/entry"

const row = (number: number, title: string): SongSummary => ({ number, title, first_line: title, is_verified: true }) as SongSummary

beforeEach(() => {
  usePreviewCatalog.setState({ rows: [], source: "fallback", notice: null, loading: true, refreshing: false })
  vi.mocked(api.fetchSongs).mockReset()
  resetCatalogMemory()
})

describe("fallback fixture", () => {
  it("is PS 1 to 7 exactly as data/generated/songs.json has them", () => {
    const file = path.resolve(__dirname, "../../../data/generated/songs.json")
    const all = JSON.parse(readFileSync(file, "utf8")) as Array<{ number: string | number; title: string; first_line: string | null }>
    expect(all).toHaveLength(5018)
    for (const song of REAL_SONGS_1_TO_7) {
      const real = all.find((r) => Number(r.number) === song.number)!
      expect(song.title).toBe(real.title)
      expect(song.first_line).toBe(real.first_line)
    }
    expect(REAL_SONGS_1_TO_7.map((s) => s.number)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it("gives the sample fixtures real titles for PS 1 to 7 before the catalog has loaded", () => {
    // the API sends decomposed accents; compare what the eye sees
    expect(previewTitle(3)?.normalize("NFC")).toBe("Ándhára Sheśe Álora Deshe")
    expect(previewTitle(2)?.normalize("NFC")).toBe("E Gán Ámár, Álor Jharańá Dhárá")
    expect(previewTitle(4000)).toBeUndefined()
    expect(previewTitleOrNumber(4000)).toBe("Prabhat Samgiita 4000")
    expect(homeSong(1).title).toBe("Bandhu He Niye Calo")
    for (const item of MOCK_STORAGE) expect(item.title.normalize("NFC")).toBe(previewTitle(item.songNumber)?.normalize("NFC"))
  })
})

describe("fixtures that name songs use the catalog's titles", () => {
  const real = (n: number) => REAL_SONGS_1_TO_7.find((r) => r.number === n)!.title
  const same = (n: number, title: string) => expect(title.normalize("NFC")).toBe(displayTitle(real(n)).normalize("NFC"))
  it("today, notifications and learn point at PS 1 to 7 with their real titles", () => {
    for (const song of Object.values(TODAY_FIXTURE_SONGS)) same(song.number, song.title)
    for (const pick of PREVIEW_SONG_PICKS) same(pick.number, pick.title)
    for (const [n, title] of Object.entries(LEARN_SONG_TITLES)) same(Number(n), title)
  })
})

describe("resolvePreviewRows", () => {
  it("uses live rows as they are", () => {
    const songs = [row(1, "A"), row(2, "B")]
    expect(resolvePreviewRows({ songs, fromCache: false })).toEqual({ rows: songs, source: "api", notice: null })
    expect(resolvePreviewRows({ songs, fromCache: true }).source).toBe("cache")
  })
  it("falls back to the seven real songs with a quiet note when nothing came back", () => {
    const out = resolvePreviewRows({ songs: [], fromCache: false })
    expect(out.source).toBe("fallback")
    expect(out.notice).toBe(FALLBACK_NOTICE)
    expect(out.rows.map((r) => r.number)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })
})

describe("ensurePreviewCatalog", () => {
  it("loads the live catalog once and answers titles for any number", async () => {
    const live = Array.from({ length: 5018 }, (_, i) => row(i + 1, i === 3999 ? "JHARANA DHARA" : `SONG ${i + 1}`))
    vi.mocked(api.fetchSongs).mockResolvedValue(live)
    await Promise.all([ensurePreviewCatalog(), ensurePreviewCatalog()])
    expect(api.fetchSongs).toHaveBeenCalledTimes(1)
    expect(usePreviewCatalog.getState()).toMatchObject({ source: "api", loading: false, notice: null })
    expect(previewTitle(4000)).toBe("Jharana Dhara")
    expect(previewSummary(5018)?.number).toBe(5018)
    // already live: no second request unless forced
    await ensurePreviewCatalog()
    expect(api.fetchSongs).toHaveBeenCalledTimes(1)
    await ensurePreviewCatalog(true)
    expect(api.fetchSongs).toHaveBeenCalledTimes(2)
  })

  it("shows the sample when the API is unreachable, then keeps live rows if a refresh fails", async () => {
    vi.mocked(api.fetchSongs).mockResolvedValue([])
    await ensurePreviewCatalog()
    expect(usePreviewCatalog.getState()).toMatchObject({ source: "fallback", notice: FALLBACK_NOTICE, loading: false })
    expect(usePreviewCatalog.getState().rows).toHaveLength(7)

    const live = [row(1, "BANDHU HE NIYE CALO"), ...Array.from({ length: 99 }, (_, i) => row(i + 2, `S ${i}`))]
    vi.mocked(api.fetchSongs).mockResolvedValue(live)
    await ensurePreviewCatalog(true)
    expect(usePreviewCatalog.getState().source).toBe("api")

    vi.mocked(api.fetchSongs).mockResolvedValue([])
    await ensurePreviewCatalog(true)
    expect(usePreviewCatalog.getState().rows).toHaveLength(100)
  })

  it("shapes titles the way the real build does", () => {
    expect(displayTitle("BANDHU HE NIYE CALO")).toBe("Bandhu He Niye Calo")
  })
})
