import { describe, expect, it } from "vitest"

import {
  buildSaveRows,
  computeSaveState,
  createdToast,
  isSaved,
  itemFromSongId,
  itemKey,
  nextPlaylistName,
  orderPlaylists,
  sameSaveState,
  saveButtonLabel,
  saveToast,
  toggleMembership,
  trackCountLabel,
  type PlaylistLike,
} from "@/lib/save/saveToSheet"

const pl = (id: string, name: string, numbers: number[], created_at?: string): PlaylistLike => ({
  id,
  name,
  created_at,
  songs: numbers.map((song_number) => ({ song_number })),
})

describe("toggleMembership", () => {
  it("adds a missing id and removes a present one", () => {
    expect(toggleMembership(["ps-1"], "ps-2")).toEqual(["ps-1", "ps-2"])
    expect(toggleMembership(["ps-1", "ps-2"], "ps-1")).toEqual(["ps-2"])
  })
  it("does not mutate and never doubles", () => {
    const ids = ["a"]
    toggleMembership(ids, "b")
    expect(ids).toEqual(["a"])
    expect(toggleMembership(toggleMembership(ids, "b"), "b")).toEqual(["a"])
  })
})

describe("computeSaveState", () => {
  const playlists = [pl("p1", "Morning", [5, 7]), pl("p2", "Evening", [7])]
  it("reads Mine and every playlist the song is in", () => {
    const state = computeSaveState(
      { kind: "song", number: 7 },
      { savedSongIds: ["ps-7"], kiirtanSavedIds: [], playlists },
    )
    expect(state).toEqual({ inMine: true, playlistIds: ["p1", "p2"] })
    expect(isSaved(state)).toBe(true)
  })
  it("a song only in a playlist counts as saved, not as Mine", () => {
    const state = computeSaveState({ kind: "song", number: 5 }, { savedSongIds: [], kiirtanSavedIds: [], playlists })
    expect(state).toEqual({ inMine: false, playlistIds: ["p1"] })
    expect(isSaved(state)).toBe(true)
  })
  it("an unknown song is not saved", () => {
    const state = computeSaveState({ kind: "song", number: 99 }, { savedSongIds: ["ps-7"], kiirtanSavedIds: [], playlists })
    expect(isSaved(state)).toBe(false)
  })
  it("a Kiirtan reads its own saved ids and ignores playlists", () => {
    const state = computeSaveState({ kind: "kiirtan", id: "k1" }, { savedSongIds: ["ps-7"], kiirtanSavedIds: ["k1"], playlists })
    expect(state).toEqual({ inMine: true, playlistIds: [] })
  })
  it("a Kiirtan id never matches a song number", () => {
    const state = computeSaveState({ kind: "kiirtan", id: "ps-7" }, { savedSongIds: ["ps-7"], kiirtanSavedIds: [], playlists })
    expect(state.inMine).toBe(false)
  })
  it("compares two states", () => {
    expect(sameSaveState({ inMine: true, playlistIds: ["a"] }, { inMine: true, playlistIds: ["a"] })).toBe(true)
    expect(sameSaveState({ inMine: true, playlistIds: ["a"] }, { inMine: false, playlistIds: ["a"] })).toBe(false)
    expect(sameSaveState({ inMine: true, playlistIds: ["a"] }, { inMine: true, playlistIds: [] })).toBe(false)
  })
})

describe("orderPlaylists", () => {
  it("puts the newest first by created_at", () => {
    const list = [pl("a", "A", [], "2026-01-01T00:00:00Z"), pl("b", "B", [], "2026-03-01T00:00:00Z"), pl("c", "C", [], "2026-02-01T00:00:00Z")]
    expect(orderPlaylists(list).map((p) => p.id)).toEqual(["b", "c", "a"])
  })
  it("falls back to the reverse of the order they were made in", () => {
    const list = [pl("a", "A", []), pl("b", "B", []), pl("c", "C", [])]
    expect(orderPlaylists(list).map((p) => p.id)).toEqual(["c", "b", "a"])
  })
  it("does not mutate the input", () => {
    const list = [pl("a", "A", []), pl("b", "B", [])]
    orderPlaylists(list)
    expect(list.map((p) => p.id)).toEqual(["a", "b"])
  })
})

describe("buildSaveRows", () => {
  const playlists = [pl("p1", "Morning", [5, 7], "2026-01-01T00:00:00Z"), pl("p2", "Evening", [7], "2026-02-01T00:00:00Z"), pl("p3", "Empty", [])]
  it("lists Mine first, then playlists newest first, with counts and ticks", () => {
    const item = { kind: "song", number: 7 } as const
    const state = { inMine: true, playlistIds: ["p1", "p2"] }
    const rows = buildSaveRows(item, state, playlists)
    expect(rows.map((r) => r.name)).toEqual(["Mine", "Empty", "Evening", "Morning"])
    expect(rows[0]).toMatchObject({ kind: "mine", subtitle: "Saved songs", on: true })
    expect(rows[1]).toMatchObject({ kind: "playlist", id: "p3", subtitle: "0 songs", on: false })
    expect(rows[2]).toMatchObject({ id: "p2", subtitle: "1 song", on: true })
    expect(rows[3]).toMatchObject({ id: "p1", subtitle: "2 songs", on: true })
  })
  it("a Kiirtan sees Mine only", () => {
    const rows = buildSaveRows({ kind: "kiirtan", id: "k1" }, { inMine: false, playlistIds: [] }, playlists)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ kind: "mine", on: false })
  })
  it("with no playlists it is Mine alone", () => {
    expect(buildSaveRows({ kind: "song", number: 1 }, { inMine: false, playlistIds: [] }, [])).toHaveLength(1)
  })
})

describe("copy", () => {
  it("toasts", () => {
    expect(saveToast("Mine", true)).toBe("Added to Mine")
    expect(saveToast("Mine", false)).toBe("Removed from Mine")
    expect(saveToast("Morning", true)).toBe("Added to Morning")
    expect(saveToast("Morning", false)).toBe("Removed from Morning")
    expect(createdToast("Playlist 2")).toBe("Added to Playlist 2")
  })
  it("button label", () => {
    expect(saveButtonLabel(false)).toBe("Add to…")
    expect(saveButtonLabel(true)).toBe("Saved. Change")
  })
  it("song counts", () => {
    expect(trackCountLabel(1)).toBe("1 song")
    expect(trackCountLabel(0)).toBe("0 songs")
    expect(trackCountLabel(12)).toBe("12 songs")
  })
  it("next playlist name skips taken names", () => {
    expect(nextPlaylistName([])).toBe("Playlist 1")
    expect(nextPlaylistName([{ name: "Morning" }, { name: "Evening" }])).toBe("Playlist 3")
    expect(nextPlaylistName([{ name: "Playlist 2" }, { name: "x" }])).toBe("Playlist 3")
  })
})

describe("item ids", () => {
  it("keys and parses song ids", () => {
    expect(itemKey({ kind: "song", number: 12 })).toBe("ps-12")
    expect(itemKey({ kind: "kiirtan", id: "k" })).toBe("kiirtan:k")
    expect(itemFromSongId("ps-12")).toEqual({ kind: "song", number: 12 })
    expect(itemFromSongId("x-12")).toBeNull()
  })
})
