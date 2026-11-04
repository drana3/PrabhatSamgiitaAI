import { describe, expect, it } from "vitest"

import { KIRTAN_FIXTURES } from "@/lib/fixtures/kirtan"
import {
  addSubmission,
  buildSubmission,
  canTransition,
  decideSubmission,
  submissionCounts,
  validateSubmission,
  withdrawSubmission,
  type SubmissionInput,
} from "@/lib/kirtan/submissions"

const input: SubmissionInput = { videoId: "abcDEF12345", title: "  Baba   Nam Kevalam ", author: "Group", type: "bnk", confirmed: true, addedBy: "Dada" }

describe("validateSubmission", () => {
  it("names the first missing thing, top of the form first", () => {
    expect(validateSubmission(input)).toBeNull()
    expect(validateSubmission({ ...input, videoId: "nope" })).toBe("video")
    expect(validateSubmission({ ...input, title: "  " })).toBe("title")
    expect(validateSubmission({ ...input, type: null })).toBe("type")
    expect(validateSubmission({ ...input, confirmed: false })).toBe("confirm")
  })
})

describe("submission transitions", () => {
  it("starts pending with a tidy title", () => {
    const sub = buildSubmission(input, 1000)
    expect(sub).toMatchObject({ status: "pending", title: "Baba Nam Kevalam", addedBy: "Dada", durationSec: null, addedAt: 1000 })
    expect(sub.id).toBe("sub-abcDEF12345-1000")
  })

  it("refuses the same video twice while it is pending or approved, but allows a retry after a rejection", () => {
    const first = addSubmission([], buildSubmission(input, 1))
    expect(first.added).not.toBeNull()
    const again = addSubmission(first.list, buildSubmission(input, 2))
    expect(again.added).toBeNull()
    expect(again.duplicate?.status).toBe("pending")
    expect(again.list).toHaveLength(1)
    const rejected = decideSubmission(first.list, first.added!.id, "rejected")
    expect(addSubmission(rejected, buildSubmission(input, 3)).added).not.toBeNull()
  })

  it("refuses a video that is already in the catalog", () => {
    const known = KIRTAN_FIXTURES[0].videoId
    const result = addSubmission([], buildSubmission({ ...input, videoId: known }, 1), [known])
    expect(result.added).toBeNull()
    expect(result.list).toEqual([])
  })

  it("lets an admin decide only a pending submission", () => {
    const { list, added } = addSubmission([], buildSubmission(input, 1))
    const approved = decideSubmission(list, added!.id, "approved")
    expect(approved[0].status).toBe("approved")
    expect(decideSubmission(approved, added!.id, "rejected")[0].status).toBe("approved")
    expect(canTransition("pending", "rejected")).toBe(true)
    expect(canTransition("approved", "pending")).toBe(false)
    expect(decideSubmission(list, "unknown", "approved")).toEqual(list)
  })

  it("lets a person take back a waiting or rejected one, never an approved one", () => {
    const { list, added } = addSubmission([], buildSubmission(input, 1))
    expect(withdrawSubmission(list, added!.id)).toEqual([])
    const approved = decideSubmission(list, added!.id, "approved")
    expect(withdrawSubmission(approved, added!.id)).toHaveLength(1)
  })

  it("counts by status", () => {
    const a = buildSubmission(input, 1)
    const b = buildSubmission({ ...input, videoId: "zzzzzzzzzzz" }, 2)
    expect(submissionCounts(decideSubmission([a, b], b.id, "approved"))).toEqual({ pending: 1, approved: 1, rejected: 0 })
  })
})
