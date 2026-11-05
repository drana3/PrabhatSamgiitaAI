import { describe, expect, it } from "vitest"

import {
  formatPlaylistCreatedLabel,
  playlistCreatedMs,
  sortPlaylistsNewestFirst,
} from "@/lib/playlistDisplay"

describe("playlistDisplay", () => {
  it("reads created_at and local optimistic ids", () => {
    expect(
      playlistCreatedMs({
        id: "p1",
        name: "A",
        created_at: "2026-10-08T10:00:00.000Z",
        songs: [],
      }),
    ).toBe(Date.parse("2026-10-08T10:00:00.000Z"))
    expect(
      playlistCreatedMs({ id: "local-1700000000000-abc", name: "B", songs: [] }),
    ).toBe(1700000000000)
  })

  it("sorts newest first", () => {
    const sorted = sortPlaylistsNewestFirst([
      { id: "1", name: "Old", created_at: "2020-01-01T00:00:00.000Z", songs: [] },
      { id: "2", name: "New", created_at: "2026-01-01T00:00:00.000Z", songs: [] },
    ])
    expect(sorted.map((p) => p.id)).toEqual(["2", "1"])
  })

  it("formats created label", () => {
    const label = formatPlaylistCreatedLabel({
      id: "1",
      name: "X",
      created_at: "2026-10-08T15:30:00.000Z",
      songs: [],
    })
    expect(label.startsWith("Created ")).toBe(true)
    expect(label.length).toBeGreaterThan(10)
  })
})
