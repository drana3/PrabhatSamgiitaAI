import { describe, expect, it } from "vitest"

import {
  classifyDownloadError,
  contentLengthFrom,
  DownloadError,
  enoughSpace,
  failureMessageKey,
  isStalePart,
  keepsPartialFile,
  partUriFor,
  resumeDataFor,
  SPARE_BYTES,
  STALE_PART_MS,
  verifyFinished,
} from "@/lib/offline/downloadVerify"

describe("verifyFinished", () => {
  it("accepts a file of exactly the announced size", () => {
    expect(verifyFinished({ status: 200, size: 5000, expected: 5000 })).toBeNull()
  })
  it("rejects a file shorter or longer than announced", () => {
    expect(verifyFinished({ status: 200, size: 4999, expected: 5000 })).toBe("incomplete")
    expect(verifyFinished({ status: 200, size: 5001, expected: 5000 })).toBe("incomplete")
  })
  it("rejects an empty file", () => {
    expect(verifyFinished({ status: 200, size: 0, expected: null })).toBe("incomplete")
  })
  it("rejects a server refusal whatever the size", () => {
    expect(verifyFinished({ status: 404, size: 900, expected: 900 })).toBe("http")
    expect(verifyFinished({ status: 503, size: 10, expected: null })).toBe("http")
  })
  it("with no size announced, a non-empty 200 is accepted", () => {
    expect(verifyFinished({ status: 200, size: 10, expected: null })).toBeNull()
  })
})

describe("enoughSpace", () => {
  it("keeps spare room beyond the file", () => {
    expect(enoughSpace(10 * 1024 * 1024, 5 * 1024 * 1024)).toBe(false)
    expect(enoughSpace(SPARE_BYTES + 5, 5)).toBe(true)
  })
  it("never blocks when free space is unknown", () => {
    expect(enoughSpace(null, 1e9)).toBe(true)
    expect(enoughSpace(undefined, 1e9)).toBe(true)
    expect(enoughSpace(Number.NaN, 1e9)).toBe(true)
  })
})

describe("contentLengthFrom", () => {
  it("reads any header casing", () => {
    expect(contentLengthFrom({ "content-length": "42" })).toBe(42)
    expect(contentLengthFrom({ "Content-Length": "42" })).toBe(42)
    expect(contentLengthFrom({ "CONTENT-LENGTH": ["42"] })).toBe(42)
  })
  it("returns null for missing or junk values", () => {
    expect(contentLengthFrom(null)).toBeNull()
    expect(contentLengthFrom({})).toBeNull()
    expect(contentLengthFrom({ "content-length": "abc" })).toBeNull()
    expect(contentLengthFrom({ "content-length": "0" })).toBeNull()
  })
})

describe("classifyDownloadError", () => {
  it("knows a full phone", () => {
    expect(classifyDownloadError(new Error("ENOSPC: no space left on device"))).toBe("no-space")
    expect(classifyDownloadError(new Error("Not enough space"))).toBe("no-space")
  })
  it("knows a lost connection", () => {
    expect(classifyDownloadError(new Error("The Internet connection appears to be offline."))).toBe("offline")
    expect(classifyDownloadError(new Error("Network request failed"))).toBe("offline")
  })
  it("passes our own errors through and falls back to unknown", () => {
    expect(classifyDownloadError(new DownloadError("incomplete"))).toBe("incomplete")
    expect(classifyDownloadError(new Error("boom"))).toBe("unknown")
    expect(classifyDownloadError(undefined)).toBe("unknown")
  })
})

describe("partial files", () => {
  it("keeps the half file only when a later try can continue it", () => {
    expect(keepsPartialFile("offline")).toBe(true)
    expect(keepsPartialFile("stalled")).toBe(true)
    expect(keepsPartialFile("no-space")).toBe(false)
    expect(keepsPartialFile("incomplete")).toBe(false)
    expect(keepsPartialFile("http")).toBe(false)
  })
  it("resumes from a byte count on Android only", () => {
    expect(resumeDataFor("android", 1234.7)).toBe("1234")
    expect(resumeDataFor("android", 0)).toBeUndefined()
    expect(resumeDataFor("android", null)).toBeUndefined()
    expect(resumeDataFor("ios", 1234)).toBeUndefined()
  })
  it("names the half file next to the final one", () => {
    expect(partUriFor("file:///a/1.mp3")).toBe("file:///a/1.mp3.part")
  })
  it("drops leftovers older than three days, and ones with no date", () => {
    const now = Date.UTC(2026, 10, 6)
    expect(isStalePart((now - STALE_PART_MS - 1000) / 1000, now)).toBe(true)
    expect(isStalePart((now - 1000) / 1000, now)).toBe(false)
    expect(isStalePart(null, now)).toBe(true)
  })
})

describe("failureMessageKey", () => {
  it("words each reason", () => {
    expect(failureMessageKey("no-space")).toBe("dl.toast.noSpace")
    expect(failureMessageKey("limit")).toBe("dl.toast.limit")
    expect(failureMessageKey("offline")).toBe("dl.toast.offline")
    expect(failureMessageKey("stalled")).toBe("dl.toast.offline")
    expect(failureMessageKey("http")).toBe("dl.toast.error")
    expect(failureMessageKey("incomplete")).toBe("dl.toast.error")
  })
})
