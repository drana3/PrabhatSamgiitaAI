import { describe, expect, it } from "vitest"

import {
  formatAssistantMessage,
  generalCompanionSuggestions,
  remainingCompanionSuggestions,
  companionLeaveAction,
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

  it("turns bullets and numbered lines into markdown lists", () => {
    expect(formatAssistantMessage("• Peace\n2) Courage")).toBe("- Peace\n2. Courage")
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

  it("keeps unused suggested questions after one is asked", () => {
    const starters = generalCompanionSuggestions()
    const remaining = remainingCompanionSuggestions(starters, [starters[0]!])
    expect(remaining).not.toContain(starters[0])
    expect(remaining.length).toBeGreaterThan(0)
    expect(starters.slice(1).every((item) => remaining.includes(item))).toBe(true)
  })

  it("sends song-grounded chat back to the song, and the AI tab home", () => {
    expect(companionLeaveAction(2256, true)).toEqual({ type: "back" })
    expect(companionLeaveAction(2256, false)).toEqual({ type: "song", number: 2256 })
    expect(companionLeaveAction(null, true)).toEqual({ type: "home" })
  })
})
