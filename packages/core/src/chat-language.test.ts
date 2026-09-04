import { describe, expect, it } from "vitest"

import {
  conversationLanguage,
  detectResponseLanguage,
  languageCompanionHint,
  languageSwitchAcknowledgment,
  normalizePreferredLanguage,
} from "./chat-language"

describe("chat-language", () => {
  it("normalizes member preferred language values", () => {
    expect(normalizePreferredLanguage("Hindi")).toBe("hi")
    expect(normalizePreferredLanguage("english")).toBe("en")
    expect(normalizePreferredLanguage("magahi")).toBe("other")
    expect(normalizePreferredLanguage("")).toBeNull()
  })

  it("uses preferred language for starter prompts before the first turn", () => {
    expect(conversationLanguage([], "hi")).toBe("hi")
    expect(conversationLanguage([], "en")).toBe("en")
  })

  it("keeps Hindi after an English follow-up once the conversation moved there", () => {
    const history: Array<[string, string]> = [
      ["user", "What is this song about?"],
      ["user", "is gaane ka arth batao"],
    ]
    expect(detectResponseLanguage("Tell me more about the imagery", history)).toBe("hi")
  })

  it("inherits Hindi for numeric follow-ups in the same conversation", () => {
    const history: Array<[string, string]> = [["user", "explain this song in hindi"]]
    expect(detectResponseLanguage("222", history)).toBe("hi")
  })

  it("switches only on explicit language requests", () => {
    const history: Array<[string, string]> = [["user", "explain this song in hindi"]]
    expect(detectResponseLanguage("in english", history)).toBe("en")
  })

  it("describes the active language for the UI hint", () => {
    expect(languageCompanionHint("hi")).toMatch(/Hindi/)
    expect(languageCompanionHint("en")).toMatch(/English/)
  })

  it("acknowledges language switches without calling the model", () => {
    expect(languageSwitchAcknowledgment("en", "hi")).toMatch(/हिंदी/)
    expect(languageSwitchAcknowledgment("hi", "en")).toMatch(/English/)
    expect(languageSwitchAcknowledgment("hi", "hi")).toMatch(/पहले से/)
  })
})
