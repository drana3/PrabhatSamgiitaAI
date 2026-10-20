import { describe, expect, it } from "vitest"

import { localeLabel, localeOptions } from "@/lib/languages"

describe("global reading languages", () => {
  it("offers full Google Translate coverage with unique codes", () => {
    expect(localeOptions.length).toBeGreaterThanOrEqual(190)
    expect(new Set(localeOptions.map((option) => option.code)).size).toBe(localeOptions.length)
    expect(new Set(localeOptions.map((option) => option.group))).toEqual(
      new Set(["Indian languages", "World languages"]),
    )
    expect(localeOptions.some((option) => option.code === "zh-CN")).toBe(true)
    expect(localeOptions.some((option) => option.code === "mai")).toBe(true)
    expect(localeOptions.some((option) => option.code === "mag")).toBe(true)
  })

  it("resolves language codes to model-ready names", () => {
    expect(localeLabel("es")).toBe("Spanish")
    expect(localeLabel("ar")).toBe("Arabic")
    expect(localeLabel("te")).toBe("Telugu")
    expect(localeLabel("zh-CN")).toBe("Chinese (Simplified)")
  })
})
