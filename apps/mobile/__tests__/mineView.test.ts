import { describe, expect, it } from "vitest"

import {
  downloadsRowSummary,
  listViewState,
  mineSyncStatus,
  playlistMeta,
  savedNewestFirst,
  songEyebrow,
} from "@/lib/mineView"

describe("listViewState", () => {
  it("never shows loading and empty together", () => {
    expect(listViewState({ loading: true, count: 0 })).toBe("loading")
    expect(listViewState({ loading: false, count: 0 })).toBe("empty")
  })
  it("shows the list as soon as there is data, even while syncing", () => {
    expect(listViewState({ loading: true, count: 2 })).toBe("list")
    expect(listViewState({ loading: false, count: 2 })).toBe("list")
  })
})

describe("labels", () => {
  it("describes playlists", () => {
    expect(playlistMeta(9)).toBe("9 songs · made by you")
    expect(playlistMeta(1)).toBe("1 song · made by you")
    expect(playlistMeta(0)).toBe("No songs yet · made by you")
  })
  it("marks offline songs", () => {
    expect(songEyebrow(3, false)).toBe("PS 3")
    expect(songEyebrow(3, true)).toBe("PS 3 · Offline")
  })
  it("summarises downloads", () => {
    expect(downloadsRowSummary(0, "0 B")).toBe("No downloads yet")
    expect(downloadsRowSummary(1, "3.7 MB")).toBe("1 recording · 3.7 MB")
    expect(downloadsRowSummary(4, "16.9 MB")).toBe("4 recordings · 16.9 MB")
  })
})

describe("savedNewestFirst", () => {
  it("reverses, drops duplicates and junk", () => {
    expect(savedNewestFirst([1, 5, 3, 5, 0, Number.NaN, -2])).toEqual([5, 3, 1])
    expect(savedNewestFirst([])).toEqual([])
  })
})

describe("mineSyncStatus", () => {
  const base = { mode: "signed_in" as const, syncAvailable: true, syncing: false, error: null }
  it("is hidden when all is well", () => {
    expect(mineSyncStatus(base)).toEqual({ kind: "hidden" })
  })
  it("tells guests why nothing syncs", () => {
    expect(mineSyncStatus({ ...base, mode: "guest" }).kind).toBe("local")
  })
  it("reports a build without member sync", () => {
    expect(mineSyncStatus({ ...base, syncAvailable: false }).kind).toBe("local")
  })
  it("shows syncing, and an error beats syncing", () => {
    expect(mineSyncStatus({ ...base, syncing: true }).kind).toBe("syncing")
    expect(mineSyncStatus({ ...base, syncing: true, error: "Offline" })).toEqual({ kind: "error", text: "Offline" })
  })
})

describe("songTitleFromHit", () => {
  it("prefers the first line, then the title, then the number", async () => {
    const { songTitleFromHit } = await import("@/lib/mineView")
    expect(songTitleFromHit({ firstLine: "Bandhu he niye calo", title: "PS 1" }, 1)).toBe("Bandhu he niye calo")
    expect(songTitleFromHit({ firstLine: "  ", title: "Guidance" }, 1)).toBe("Guidance")
    expect(songTitleFromHit(undefined, 7)).toBe("Prabhat Samgiita 7")
  })
})
