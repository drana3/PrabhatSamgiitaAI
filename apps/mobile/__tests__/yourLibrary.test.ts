import { describe, expect, it } from "vitest"

import {
  LIBRARY_CHIPS,
  buildLibraryRows,
  downloadsMeta,
  emptyLibraryText,
  filterLibraryRows,
  isLibraryChip,
  orderByRecent,
  showNewPlaylistRow,
  showSignInInvite,
  uploadsMeta,
  type LibraryInput,
} from "@/lib/library/yourLibrary"

const input: LibraryInput = {
  savedSongCount: 7,
  savedKiirtanCount: 3,
  downloads: { count: 4, bytes: 540 * 1024 * 1024 },
  uploads: { total: 3, removed: 2 },
  playlists: [
    { id: "a", name: "Morning meditation", songNumbers: [1, 3, 5] },
    { id: "b", name: "Evening kiirtan", songNumbers: [2, 4, 6, 7, 8] },
  ],
}

describe("buildLibraryRows", () => {
  it("lists Mine, saved Kiirtans, playlists (newest first), Downloads, My uploads", () => {
    const rows = buildLibraryRows(input)
    expect(rows.map((r) => r.id)).toEqual(["mine", "kiirtans-saved", "pl-b", "pl-a", "downloads", "uploads"])
  })

  it("writes the one-line meta of each row", () => {
    const meta = Object.fromEntries(buildLibraryRows(input).map((r) => [r.id, r.meta]))
    expect(meta.mine).toBe("Saved songs · 7")
    expect(meta["kiirtans-saved"]).toBe("Kiirtans · 3 saved")
    expect(meta["pl-b"]).toBe("Playlist · 5 songs")
    expect(meta.downloads).toBe("On this phone · 4 songs · 540 MB")
    expect(meta.uploads).toBe("Your recordings · 2 removed")
  })

  it("keeps the fixed rows with a quiet line when they are empty", () => {
    const rows = buildLibraryRows({ ...input, savedSongCount: 0, savedKiirtanCount: 0, downloads: { count: 0, bytes: 0 }, uploads: { total: 0, removed: 0 }, playlists: [] })
    expect(rows.map((r) => r.id)).toEqual(["mine", "kiirtans-saved", "downloads", "uploads"])
    expect(rows.map((r) => r.meta)).toEqual([
      "Saved songs · none yet",
      "Kiirtans · none saved yet",
      "On this phone · nothing yet",
      "Your recordings · none yet",
    ])
  })

  it("says 1 song, not 1 songs", () => {
    const rows = buildLibraryRows({ ...input, playlists: [{ id: "x", name: "One", songNumbers: [9] }] })
    expect(rows.find((r) => r.id === "pl-x")?.meta).toBe("Playlist · 1 song")
  })

  it("uses the first four songs of a playlist for its collage", () => {
    const row = buildLibraryRows(input).find((r) => r.id === "pl-b")
    expect(row?.cover).toEqual({ kind: "playlist", numbers: [2, 4, 6, 7] })
  })

  it("points every row at a screen", () => {
    const target = Object.fromEntries(buildLibraryRows(input).map((r) => [r.id, r.target]))
    expect(target.mine).toBe("/songs-v2?chip=saved")
    expect(target["kiirtans-saved"]).toBe("/v2/kiirtan?filter=saved")
    expect(target["pl-a"]).toBe("/playlist-v2/a")
    expect(target.downloads).toBe("/storage")
    expect(target.uploads).toBe("/v2/kiirtan?filter=mine")
  })

  it("puts rows with a known last use first, newest first, others keep their order", () => {
    const rows = buildLibraryRows({ ...input, recent: { mineAt: 100, uploadsAt: 200 } })
    expect(rows.map((r) => r.id)).toEqual(["uploads", "mine", "kiirtans-saved", "pl-b", "pl-a", "downloads"])
  })
})

describe("downloadsMeta and uploadsMeta", () => {
  it("falls back to the count while sizes are being read", () => {
    expect(downloadsMeta(2, null)).toBe("On this phone · 2 songs")
    expect(downloadsMeta(1, null)).toBe("On this phone · 1 song")
  })
  it("shows the count of uploads when none was removed", () => {
    expect(uploadsMeta(3, 0)).toBe("Your recordings · 3")
  })
})

describe("orderByRecent", () => {
  it("does not mutate and is stable for equal rows", () => {
    const rows = [{ id: "a", recentAt: null }, { id: "b", recentAt: 5 }, { id: "c", recentAt: null }]
    expect(orderByRecent(rows).map((r) => r.id)).toEqual(["b", "a", "c"])
    expect(rows.map((r) => r.id)).toEqual(["a", "b", "c"])
  })
})

describe("filterLibraryRows", () => {
  const rows = buildLibraryRows(input)
  it("All shows everything", () => {
    expect(filterLibraryRows(rows, "all", "")).toHaveLength(6)
  })
  it("Songs: Mine, playlists and Downloads", () => {
    expect(filterLibraryRows(rows, "songs", "").map((r) => r.id)).toEqual(["mine", "pl-b", "pl-a", "downloads"])
  })
  it("Kiirtans: saved Kiirtans and uploads", () => {
    expect(filterLibraryRows(rows, "kiirtans", "").map((r) => r.id)).toEqual(["kiirtans-saved", "uploads"])
  })
  it("Playlists, Downloads and Uploads", () => {
    expect(filterLibraryRows(rows, "playlists", "").map((r) => r.id)).toEqual(["pl-b", "pl-a"])
    expect(filterLibraryRows(rows, "downloads", "").map((r) => r.id)).toEqual(["downloads"])
    expect(filterLibraryRows(rows, "uploads", "").map((r) => r.id)).toEqual(["uploads"])
  })
  it("searches names, ignoring case and extra spaces", () => {
    expect(filterLibraryRows(rows, "all", "  EVENING ").map((r) => r.id)).toEqual(["pl-b"])
    expect(filterLibraryRows(rows, "all", "morning  med").map((r) => r.id)).toEqual(["pl-a"])
  })
  it("a keyword finds the fixed row", () => {
    expect(filterLibraryRows(rows, "all", "saved").map((r) => r.id)).toEqual(["mine", "kiirtans-saved"])
  })
  it("combines a chip with a search", () => {
    expect(filterLibraryRows(rows, "kiirtans", "uploads").map((r) => r.id)).toEqual(["uploads"])
    expect(filterLibraryRows(rows, "playlists", "uploads")).toEqual([])
  })
})

describe("small rules", () => {
  it("offers New playlist where a playlist belongs, never while searching", () => {
    expect(showNewPlaylistRow("all", "")).toBe(true)
    expect(showNewPlaylistRow("songs", "")).toBe(true)
    expect(showNewPlaylistRow("playlists", "")).toBe(true)
    expect(showNewPlaylistRow("kiirtans", "")).toBe(false)
    expect(showNewPlaylistRow("downloads", "")).toBe(false)
    expect(showNewPlaylistRow("all", "ev")).toBe(false)
  })
  it("invites guests only", () => {
    expect(showSignInInvite(false)).toBe(true)
    expect(showSignInInvite(true)).toBe(false)
  })
  it("has the six chips Dada asked for, in order", () => {
    expect(LIBRARY_CHIPS.map((c) => c.label)).toEqual(["All", "Songs", "Kiirtans", "Playlists", "Downloads", "Uploads"])
    expect(isLibraryChip("uploads")).toBe(true)
    expect(isLibraryChip("nope")).toBe(false)
  })
  it("says what is missing", () => {
    expect(emptyLibraryText("all", "zzz")).toBe("Nothing called “zzz” in your library.")
    expect(emptyLibraryText("playlists", "")).toBe("No playlists here yet.")
  })
})
