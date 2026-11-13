import { beforeEach, describe, expect, it } from "vitest"

import { coverPool } from "@/lib/playlists/playlistCover"
import { usePlaylistCoverStore } from "@/stores/playlistCoverStore"

describe("playlist cover store", () => {
  beforeEach(() => usePlaylistCoverStore.getState().clear())

  it("assigns a photo once and keeps it", () => {
    const s = usePlaylistCoverStore.getState()
    const first = s.assignRandom("p1", null, () => 0)
    const again = usePlaylistCoverStore.getState().assignRandom("p1", null, () => 0.9)
    expect(again).toBe(first)
    expect(usePlaylistCoverStore.getState().covers.p1).toBe(first)
  })

  it("can avoid the previous photo", () => {
    const pool = coverPool()
    expect(usePlaylistCoverStore.getState().assignRandom("p2", pool[0].n, () => 0)).toBe(pool[1].n)
  })

  it("moves the choice from the temporary id to the server id", () => {
    const s = usePlaylistCoverStore.getState()
    s.set("local-1", coverPool()[4].n)
    usePlaylistCoverStore.getState().move("local-1", "42")
    const covers = usePlaylistCoverStore.getState().covers
    expect(covers["42"]).toBe(coverPool()[4].n)
    expect(covers["local-1"]).toBeUndefined()
  })

  it("removes one and clears all", () => {
    const s = usePlaylistCoverStore.getState()
    s.set("a", coverPool()[0].n)
    usePlaylistCoverStore.getState().set("b", coverPool()[1].n)
    usePlaylistCoverStore.getState().remove("a")
    expect(Object.keys(usePlaylistCoverStore.getState().covers)).toEqual(["b"])
    usePlaylistCoverStore.getState().clear()
    expect(usePlaylistCoverStore.getState().covers).toEqual({})
  })
})
