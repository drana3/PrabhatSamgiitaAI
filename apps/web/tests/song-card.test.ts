import { describe, expect, it } from "vitest"

import { scriptMeta } from "@/components/song-card"

describe("scriptMeta", () => {
  it("does not advertise Devanagari for English songs", () => {
    expect(scriptMeta({ language: "English" })).toBe("English")
    expect(scriptMeta({ language: "en" })).toBe("English")
  })

  it("keeps Roman · Devanagari for Roman catalog songs", () => {
    expect(scriptMeta({ language: "Roman" })).toBe("Roman · Devanagari")
    expect(scriptMeta({ language: null })).toBe("Roman · Devanagari")
  })

  it("keeps language plus scripts for other tagged languages", () => {
    expect(scriptMeta({ language: "Bengali dialect" })).toBe("Bengali dialect · Roman · Devanagari")
  })
})
