import { describe, expect, it } from "vitest"

import { KIRTAN_FIXTURES, MIX_FIXTURES } from "@/lib/fixtures/kirtan"
import { sampleArtists, sampleKirtans, sampleMixes, sampleResume, sampleSubmissionKeys } from "@/lib/fixtures/kirtanGate"
import { submissionKey } from "@/lib/kirtan/submissions"

describe("invented Kiirtan content is demo-only", () => {
  it("is empty in a real build", () => {
    expect(sampleKirtans(false)).toEqual([])
    expect(sampleArtists(false)).toEqual([])
    expect(sampleMixes(false)).toEqual([])
    expect(sampleResume(false)).toEqual([])
    expect(sampleSubmissionKeys(submissionKey, false)).toEqual([])
  })

  it("is the full sample in the demo preview", () => {
    expect(sampleKirtans(true)).toBe(KIRTAN_FIXTURES)
    expect(sampleMixes(true)).toBe(MIX_FIXTURES)
    expect(sampleArtists(true).length).toBeGreaterThan(0)
    expect(sampleResume(true).length).toBeGreaterThan(0)
    expect(sampleSubmissionKeys(submissionKey, true)).toHaveLength(KIRTAN_FIXTURES.length)
  })

  it("is off by default when the build flag is not set", () => {
    // tests run without EXPO_PUBLIC_MOCKUP_DATA, like a release build
    expect(sampleKirtans()).toEqual([])
    expect(sampleMixes()).toEqual([])
  })
})

describe("empty Kiirtan catalog (real build)", () => {
  it("says so honestly and points at Add", async () => {
    const { emptyCatalogText, isEmptyCatalog } = await import("@/lib/kirtan/tab")
    expect(emptyCatalogText()).toBe("No Kiirtans yet. Be the first to add one.")
    expect(emptyCatalogText("bhajan")).toBe("No Bhajans yet. Be the first to add one.")
    expect(emptyCatalogText("all")).toBe("No Kiirtans or Bhajans yet. Be the first to add one.")
    expect(isEmptyCatalog(null, null, 0)).toBe(true)
    expect(isEmptyCatalog("lila", null, 0)).toBe(false)
    expect(isEmptyCatalog(null, "long", 0)).toBe(false)
    expect(isEmptyCatalog(null, null, 3)).toBe(false)
  })
})
