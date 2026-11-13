import { describe, expect, it } from "vitest"

import { coalescePlaylistOps, pendingRequestCount } from "@/lib/playlistSyncOps"
import type { PlaylistSyncOp } from "@/lib/playlistSyncQueue"

describe("coalescePlaylistOps", () => {
  it("leaves unrelated ops alone, in order", () => {
    const ops: PlaylistSyncOp[] = [
      { type: "add", id: "p1", songNumber: 1 },
      { type: "add", id: "p1", songNumber: 2 },
      { type: "add", id: "p2", songNumber: 1 },
    ]
    expect(coalescePlaylistOps(ops)).toEqual(ops)
  })

  it("cancels add then remove of the same song", () => {
    expect(
      coalescePlaylistOps([
        { type: "add", id: "p1", songNumber: 4 },
        { type: "remove", id: "p1", songNumber: 4 },
      ]),
    ).toEqual([])
  })

  it("cancels remove then add of the same song", () => {
    expect(
      coalescePlaylistOps([
        { type: "remove", id: "p1", songNumber: 4 },
        { type: "add", id: "p1", songNumber: 4 },
      ]),
    ).toEqual([])
  })

  it("keeps the last add when the song bounces back", () => {
    expect(
      coalescePlaylistOps([
        { type: "add", id: "p1", songNumber: 4 },
        { type: "remove", id: "p1", songNumber: 4 },
        { type: "add", id: "p1", songNumber: 4 },
      ]),
    ).toEqual([{ type: "add", id: "p1", songNumber: 4 }])
  })

  it("does not cancel across different songs or playlists", () => {
    const ops: PlaylistSyncOp[] = [
      { type: "add", id: "p1", songNumber: 4 },
      { type: "remove", id: "p1", songNumber: 5 },
      { type: "remove", id: "p2", songNumber: 4 },
    ]
    expect(coalescePlaylistOps(ops)).toEqual(ops)
  })

  it("collapses repeated identical ops", () => {
    expect(
      coalescePlaylistOps([
        { type: "add", id: "p1", songNumber: 4 },
        { type: "add", id: "p1", songNumber: 4 },
      ]),
    ).toHaveLength(1)
  })

  it("keeps only the last rename", () => {
    expect(
      coalescePlaylistOps([
        { type: "rename", id: "p1", name: "A" },
        { type: "rename", id: "p1", name: "B" },
        { type: "rename", id: "p1", name: "C" },
      ]),
    ).toEqual([{ type: "rename", id: "p1", name: "C" }])
  })

  it("folds a rename into a pending create", () => {
    expect(
      coalescePlaylistOps([
        { type: "create", tempId: "local-1-x", name: "Draft" },
        { type: "rename", id: "local-1-x", name: "Morning" },
      ]),
    ).toEqual([{ type: "create", tempId: "local-1-x", name: "Morning" }])
  })

  it("delete drops earlier ops on that playlist and keeps the delete", () => {
    expect(
      coalescePlaylistOps([
        { type: "rename", id: "p1", name: "A" },
        { type: "add", id: "p1", songNumber: 2 },
        { type: "add", id: "p2", songNumber: 2 },
        { type: "delete", id: "p1" },
      ]),
    ).toEqual([
      { type: "add", id: "p2", songNumber: 2 },
      { type: "delete", id: "p1" },
    ])
  })

  it("delete of a playlist that was only created locally sends nothing", () => {
    expect(
      coalescePlaylistOps([
        { type: "create", tempId: "local-1-x", name: "Draft" },
        { type: "add", id: "local-1-x", songNumber: 9 },
        { type: "delete", id: "local-1-x" },
      ]),
    ).toEqual([])
  })

  it("does not mutate its input and counts requests", () => {
    const ops: PlaylistSyncOp[] = [
      { type: "add", id: "p1", songNumber: 4 },
      { type: "remove", id: "p1", songNumber: 4 },
      { type: "rename", id: "p1", name: "X" },
    ]
    const copy = JSON.parse(JSON.stringify(ops))
    expect(pendingRequestCount(ops)).toBe(1)
    expect(ops).toEqual(copy)
  })
})
