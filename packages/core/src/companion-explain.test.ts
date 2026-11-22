import { describe, expect, it } from "vitest"

import { prefersCatalogCompanion, resolveExplainSongNumber } from "./companion-explain"

describe("resolveExplainSongNumber", () => {
  it("returns null for browse-mode questions without a current song", () => {
    expect(resolveExplainSongNumber("Suggest a morning devotion song", null)).toBeNull()
  })

  it("uses catalog mode for browse prompts even when a song is active", () => {
    expect(resolveExplainSongNumber("morning devotion", 1427)).toBeNull()
    expect(resolveExplainSongNumber("Which song helps with peace of mind?", 88)).toBeNull()
  })

  it("uses the active song when the prompt does not name a number", () => {
    expect(resolveExplainSongNumber("How can I meditate on this?", 88)).toBe(88)
  })

  it("keeps related-song questions on the active song", () => {
    expect(resolveExplainSongNumber("Recommend related songs", 88)).toBe(88)
  })

  it("prefers an explicit number in the prompt", () => {
    expect(resolveExplainSongNumber("What is PS 2155 about?", 3)).toBe(2155)
  })
})

describe("prefersCatalogCompanion", () => {
  it("detects whole-catalog companion prompts", () => {
    expect(prefersCatalogCompanion("Tell me about Prabhat Samgiita")).toBe(true)
    expect(prefersCatalogCompanion("What is this song about?")).toBe(false)
    expect(prefersCatalogCompanion("")).toBe(false)
  })
})