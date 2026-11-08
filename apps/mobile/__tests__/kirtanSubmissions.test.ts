import { describe, expect, it } from "vitest"

import { isTypeOfKind } from "@/lib/kirtan/kind"
import type { RemoteRecording } from "@/lib/kirtan/remote"
import {
  addSubmission,
  buildSubmission,
  fromRemote,
  markFailed,
  markPublished,
  markPublishedLocal,
  markRemoved,
  mergeRemoteMine,
  newlyRemoved,
  retrySubmission,
  submissionCounts,
  submissionKey,
  validateSubmission,
  withdrawSubmission,
  type SubmissionInput,
} from "@/lib/kirtan/submissions"

const input: SubmissionInput = {
  kind: "kiirtan",
  fileName: "morning.mp3",
  fileUri: "blob:morning",
  title: "  Baba   Nam Kevalam ",
  author: "Group",
  style: "bengali",
  recordingType: "studio", performance: "solo",
  byAuthor: true,
  addedBy: "Dada",
  termsAccepted: true,
}

describe("validateSubmission", () => {
  it("names the first missing thing, top of the form first", () => {
    expect(validateSubmission(input)).toBeNull()
    expect(validateSubmission({ ...input, fileName: null, fileUri: null })).toBe("file")
    expect(validateSubmission({ ...input, fileUri: null })).toBe("file")
    expect(validateSubmission({ ...input, title: "  " })).toBe("title")
    expect(validateSubmission({ ...input, author: " " })).toBe("author")
    expect(validateSubmission({ ...input, termsAccepted: false })).toBe("terms")
  })

  it("checks the file format and size before the title", () => {
    expect(validateSubmission({ ...input, fileName: "notes.pdf", title: "" })).toBe("format")
    expect(validateSubmission({ ...input, fileSize: 61 * 1024 * 1024 })).toBe("size")
    expect(validateSubmission({ ...input, fileSize: 5 * 1024 * 1024 })).toBeNull()
  })

  it("asks for no type, and the author box is optional", () => {
    expect(validateSubmission({ ...input, byAuthor: false })).toBeNull()
    expect(validateSubmission({ ...input, kind: "bhajan" })).toBe("language") // a Bhajan names its language
    expect(validateSubmission({ ...input, kind: "bhajan", language: "hi" })).toBeNull()
    expect(Object.keys(input)).not.toContain("type")
    expect(Object.keys(input)).not.toContain("confirmed")
  })
})

const remote: RemoteRecording = {
  id: "r1",
  kind: "kiirtan",
  type: "other",
  title: "Baba Nam Kevalam",
  author: "Group",
  added_by: "Dada",
  author_id: "member-1",
  by_author: true,
  status: "published",
  duration_sec: 600,
  plays: 3,
  audio_url: "https://cdn.example/r1.mp3",
  thumbnail_url: null,
  published_at: "2026-11-01T10:00:00Z",
  created_at: "2026-11-01T09:59:00Z",
}

describe("submission life: uploading, published, failed, removed", () => {
  it("starts uploading with a tidy title, never waiting for review", () => {
    const sub = buildSubmission(input, 1000)
    expect(sub).toMatchObject({ status: "uploading", title: "Baba Nam Kevalam", addedBy: "Dada", durationSec: null, addedAt: 1000, audioUrl: "blob:morning", fileName: "morning.mp3" })
    expect(sub.id).toBe("sub-baba-nam-kevalam-1000")
  })

  it("derives the type itself: Other, valid for both kinds", () => {
    expect(buildSubmission(input, 1).type).toBe("other")
    const bhajan = buildSubmission({ ...input, kind: "bhajan" }, 1)
    expect(bhajan).toMatchObject({ kind: "bhajan", type: "other" })
    expect(isTypeOfKind("bhajan", bhajan.type)).toBe(true)
  })

  it("stores whether the author or performer sent it", () => {
    expect(buildSubmission(input, 1).byAuthor).toBe(true)
    expect(buildSubmission({ ...input, byAuthor: false }, 1).byAuthor).toBe(false)
  })

  it("refuses the same title twice only while the first upload is running", () => {
    const first = addSubmission([], buildSubmission(input, 1))
    expect(first.added).not.toBeNull()
    const again = addSubmission(first.list, buildSubmission(input, 2))
    expect(again.added).toBeNull()
    expect(again.duplicate?.status).toBe("uploading")
    const failed = markFailed(first.list, first.added!.id, { code: "network" })
    expect(addSubmission(failed, buildSubmission(input, 3)).added).not.toBeNull()
  })

  it("publishing replaces the phone file with the server recording and keeps the phone id", () => {
    const { list, added } = addSubmission([], buildSubmission(input, 1000))
    const live = markPublished(list, added!.id, remote)
    expect(live[0]).toMatchObject({ id: added!.id, status: "published", serverId: "r1", authorId: "member-1", audioUrl: "https://cdn.example/r1.mp3", durationSec: 600, addedAt: 1000 })
  })

  it("a failure can be retried, and a published one is never marked failed", () => {
    const { list, added } = addSubmission([], buildSubmission(input, 1))
    const failed = markFailed(list, added!.id, { code: "network" })
    expect(failed[0]).toMatchObject({ status: "failed", failure: { code: "network" } })
    const again = retrySubmission(failed, added!.id)
    expect(again[0].status).toBe("uploading")
    expect(again[0].failure).toBeUndefined()
    expect(retrySubmission(list, added!.id)[0].status).toBe("uploading")
    const live = markPublished(list, added!.id, remote)
    expect(markFailed(live, added!.id, { code: "server" })[0].status).toBe("published")
  })

  it("the demo preview publishes locally at once", () => {
    const { list, added } = addSubmission([], buildSubmission(input, 1))
    const failed = markFailed(list, added!.id, { code: "server" })
    const live = markPublishedLocal(failed, added!.id)
    expect(live[0].status).toBe("published")
    expect(live[0].failure).toBeUndefined()
  })

  it("lets a person dismiss anything that is not published", () => {
    const { list, added } = addSubmission([], buildSubmission(input, 1))
    expect(withdrawSubmission(list, added!.id)).toEqual([])
    const live = markPublishedLocal(list, added!.id)
    expect(withdrawSubmission(live, added!.id)).toHaveLength(1)
    const removed = markRemoved(live, added!.id, { reason: "Not yours.", at: 5 })
    expect(removed[0]).toMatchObject({ status: "removed", removedReason: "Not yours.", removedAt: 5 })
    expect(withdrawSubmission(removed, added!.id)).toEqual([])
  })

  it("counts by status", () => {
    const a = buildSubmission(input, 1)
    const b = buildSubmission({ ...input, title: "Another one" }, 2)
    const c = buildSubmission({ ...input, title: "Third" }, 3)
    const list = markRemoved(markPublishedLocal([a, b, c], b.id), b.id, { reason: "x", at: 1 })
    expect(submissionCounts(list)).toEqual({ uploading: 2, published: 0, failed: 0, removed: 1 })
  })
})

describe("the server's view", () => {
  it("fromRemote reads a published and a removed recording", () => {
    expect(fromRemote(remote)).toMatchObject({ id: "srv-r1", status: "published", serverId: "r1", plays: 3, addedAt: Date.parse("2026-11-01T10:00:00Z") })
    const gone = fromRemote({ ...remote, status: "removed", removed_reason: "Copyright.", removed_at: "2026-11-02T00:00:00Z" })
    expect(gone).toMatchObject({ status: "removed", removedReason: "Copyright.", removedAt: Date.parse("2026-11-02T00:00:00Z") })
  })

  it("a flagged recording is still live", () => {
    expect(fromRemote({ ...remote, status: "flagged" }).status).toBe("published")
  })

  it("mergeRemoteMine shows a removal, adds an upload from another device and keeps unsent items", () => {
    const own = markPublished([buildSubmission(input, 1000)], "sub-baba-nam-kevalam-1000", remote)
    const pending = buildSubmission({ ...input, title: "Still going up" }, 2000)
    const list = [pending, ...own]
    const merged = mergeRemoteMine(list, [{ ...remote, status: "removed", removed_reason: "Copyright." }, { ...remote, id: "r2", title: "Other device" }])
    expect(merged.find((k) => k.serverId === "r1")).toMatchObject({ status: "removed", removedReason: "Copyright.", id: "sub-baba-nam-kevalam-1000" })
    expect(merged.find((k) => k.serverId === "r2")?.title).toBe("Other device")
    expect(merged.find((k) => k.id === pending.id)?.status).toBe("uploading")
    expect(newlyRemoved(list, merged).map((k) => k.serverId)).toEqual(["r1"])
    expect(newlyRemoved(merged, merged)).toEqual([])
  })
})
