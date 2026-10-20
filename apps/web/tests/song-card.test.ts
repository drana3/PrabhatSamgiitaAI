import { describe, expect, it } from "vitest"

import { scriptMeta } from "@/components/song-card"

describe("scriptMeta", () => {
  it("does not advertise Devanagari for English songs", () => {
    expect(scriptMeta({ number: 68, language: "English" })).toBe("English")
    expect(scriptMeta({ number: 5008, language: null })).toBe("English")
    expect(scriptMeta({ number: 5009, language: "en" })).toBe("English")
  })

  it("keeps Roman · Devanagari for Roman catalog songs", () => {
    expect(scriptMeta({ number: 1, language: "Roman" })).toBe("Roman · Devanagari")
    expect(scriptMeta({ number: 1, language: null })).toBe("Roman · Devanagari")
  })

  it("keeps language plus scripts for other tagged languages", () => {
    expect(scriptMeta({ number: 42, language: "Bengali dialect" })).toBe(
      "Bengali dialect · Roman · Devanagari",
    )
  })
})
