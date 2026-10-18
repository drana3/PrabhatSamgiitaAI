import { describe, expect, it } from "vitest"

import {
  conversationLanguage,
  detectResponseLanguage,
  explicitResponseLanguage,
  isOneShotLanguageRequest,
  languageSwitchAcknowledgment,
  normalizePreferredLanguage,
  sessionLanguage,
} from "./chat-language"

describe("chat-language", () => {
  it("normalizes member preferred language values", () => {
    expect(normalizePreferredLanguage("Hindi")).toBe("hi")
    expect(normalizePreferredLanguage("english")).toBe("en")
    expect(normalizePreferredLanguage("magahi")).toBe("other")
    expect(normalizePreferredLanguage("")).toBeNull()
  })

  it("detects one-shot explain-in-language requests", () => {
    expect(isOneShotLanguageRequest("explain this song in hindi")).toBe(true)
    expect(isOneShotLanguageRequest("explain its meaning in punjabi")).toBe(true)
    expect(isOneShotLanguageRequest("in hindi")).toBe(false)
    expect(explicitResponseLanguage("explain in punjabi")).toBe("other")
  })

  it("answers one-shot requests in the requested language", () => {
    expect(detectResponseLanguage("explain in punjabi", [])).toBe("other")
    expect(detectResponseLanguage("explain this song in hindi", [])).toBe("hi")
  })

  it("resumes preferred language after a one-shot regional request", () => {
    const history: Array<[string, string]> = [["user", "explain its meaning in punjabi"]]
    expect(detectResponseLanguage("tell me more about the imagery", history, "english")).toBe("en")
    expect(sessionLanguage(history, "english")).toBe("en")
  })

  it("keeps session language after an explicit in-hindi switch", () => {
    const history: Array<[string, string]> = [["user", "in hindi"]]
    expect(detectResponseLanguage("tell me more", history)).toBe("hi")
  })

  it("uses preferred language for starter prompts before the first turn", () => {
    expect(conversationLanguage([], "hi")).toBe("hi")
    expect(conversationLanguage([], "en")).toBe("en")
  })

  it("shows session language in the UI while a one-shot request is pending", () => {
    expect(conversationLanguage(["explain in punjabi"], "english")).toBe("en")
  })

  it("acknowledges language switches without calling the model", () => {
    expect(languageSwitchAcknowledgment("en", "hi")).toMatch(/हिंदी/)
    expect(languageSwitchAcknowledgment("hi", "en")).toMatch(/English/)
    expect(languageSwitchAcknowledgment("hi", "hi")).toMatch(/पहले से/)
  })
})
