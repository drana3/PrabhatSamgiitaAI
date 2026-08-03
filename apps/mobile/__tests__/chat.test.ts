import { describe, expect, it } from "vitest"

import {
  formatAssistantMessage,
  generalCompanionSuggestions,
  resolveExplainSongNumber,
  songCompanionSuggestions,
  validatePrompt,
} from "@/lib/chat"

describe("mobile AI chat helpers", () => {
  it("blocks garbage prompts before calling /ai/explain", () => {
    expect(validatePrompt("djcvjcvhjcvhjc")).toMatch(/Please ask something specific/)
    expect(validatePrompt("Explain song 111")).toBeNull()
  })

  it("prefers an explicit song number from the prompt", () => {
    expect(resolveExplainSongNumber("What is the meaning of song 2155?", 3)).toBe(2155)
    expect(resolveExplainSongNumber("morning devotion", 1427)).toBe(1427)
    expect(resolveExplainSongNumber("morning devotion")).toBe(1)
  })

  it("strips source footnotes from streamed answers", () => {
    expect(
      formatAssistantMessage("A calm dawn song.\nSources:\n[1] Archive"),
    ).toBe("A calm dawn song.")
  })

  it("builds song-specific companion suggestions", () => {
    const prompts = songCompanionSuggestions({ number: 1, title: "BANDHU HE NIYE CALO" })
    expect(prompts.some((item) => item.includes("PS 1"))).toBe(true)
    expect(prompts.some((item) => /morning devotion|peace of mind/i.test(item))).toBe(false)
  })

  it("keeps browse-mode suggestions generic", () => {
    const prompts = generalCompanionSuggestions()
    expect(prompts.some((item) => /meditation|morning|peace/i.test(item))).toBe(true)
    expect(prompts.some((item) => item.includes("PS "))).toBe(false)
  })
})
