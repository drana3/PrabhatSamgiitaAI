import { describe, expect, it } from "vitest"

import { localeLabel, localeOptions } from "@/lib/languages"

describe("global reading languages", () => {
  it("offers broad, uniquely coded Indian and world language coverage", () => {
    expect(localeOptions).toHaveLength(36)
    expect(new Set(localeOptions.map((option) => option.code)).size).toBe(localeOptions.length)
    expect(new Set(localeOptions.map((option) => option.group))).toEqual(
      new Set(["Indian languages", "World languages"]),
    )
  })

  it("resolves language codes to model-ready names", () => {
    expect(localeLabel("es")).toBe("Spanish")
    expect(localeLabel("ar")).toBe("Arabic")
    expect(localeLabel("te")).toBe("Telugu")
  })
})
