import { describe, expect, it } from "vitest"

import { isSafeAssistantLink } from "@/lib/assistantLinks"

describe("assistant answer links", () => {
  it("opens only https links to the project's own site", () => {
    expect(isSafeAssistantLink("https://www.prabhatasamgiita.org/songs/1")).toBe(true)
    expect(isSafeAssistantLink("https://prabhatasamgiita.org")).toBe(true)
  })

  it("refuses everything else", () => {
    for (const bad of [
      "http://www.prabhatasamgiita.org/songs/1",
      "https://evil.example/prabhatasamgiita.org",
      "https://prabhatasamgiita.org.evil.example",
      "tel:+10000000",
      "sms:+10000000",
      "mailto:a@b.c",
      "prabhatai:///song/ps-1",
      "javascript:alert(1)",
      "not a url",
      "",
    ]) {
      expect(isSafeAssistantLink(bad), bad).toBe(false)
    }
  })
})
