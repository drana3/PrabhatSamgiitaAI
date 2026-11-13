import { describe, expect, it } from "vitest"

import { buildMyUploads, isSystemPlaylistId, MY_UPLOADS_ID } from "@/lib/playlists/myUploads"
import { defaultCoverFor } from "@/lib/playlists/playlistCover"

const up = (id: string, addedAt: number, status: string, kind?: string) =>
  ({ id, title: `T ${id}`, addedAt, status, kind }) as never

describe("My uploads system playlist", () => {
  it("does not exist without a live upload", () => {
    expect(buildMyUploads([])).toBeNull()
    expect(buildMyUploads([up("a", 1, "uploading"), up("b", 2, "failed"), up("c", 3, "removed")])).toBeNull()
  })

  it("lists live uploads of every kind, newest first, with a count", () => {
    const r = buildMyUploads([
      up("old", 100, "published", "kiirtan"),
      up("new", 300, "published", "lecture"),
      up("mid", 200, "published", "story"),
      up("busy", 400, "uploading", "kiirtan"),
    ])!
    expect(r.items.map((i) => i.id)).toEqual(["new", "mid", "old"])
    expect(r.items.map((i) => i.kind)).toEqual(["lecture", "story", "kiirtan"])
    expect(r.count).toBe(3)
  })

  it("treats an old upload without a kind as kiirtan", () => {
    expect(buildMyUploads([up("a", 1, "published")])!.items[0].kind).toBe("kiirtan")
  })

  it("is not editable, has a stable id and a stable cover", () => {
    const r = buildMyUploads([up("a", 1, "published")])!
    expect(r.editable).toBe(false)
    expect(r.id).toBe(MY_UPLOADS_ID)
    expect(r.cover).toBe(defaultCoverFor(MY_UPLOADS_ID))
  })

  it("breaks a tie on time by putting the later-added first", () => {
    const r = buildMyUploads([up("first", 5, "published"), up("second", 5, "published")])!
    expect(r.items.map((i) => i.id)).toEqual(["second", "first"])
  })

  it("recognises system ids", () => {
    expect(isSystemPlaylistId(MY_UPLOADS_ID)).toBe(true)
    expect(isSystemPlaylistId("local-123")).toBe(false)
  })
})
