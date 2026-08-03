import { describe, expect, it } from "vitest"

import { localeLabel, localeOptions } from "@/constants/languages"

describe("localized language helpers", () => {
  it("maps codes to API language labels used by /localized", () => {
    expect(localeLabel("hi")).toBe("Hindi")
    expect(localeLabel("bn")).toBe("Bengali")
    expect(localeLabel("en")).toBe("English")
  })

  it("keeps locale option codes unique", () => {
    expect(new Set(localeOptions.map((option) => option.code)).size).toBe(localeOptions.length)
  })
})
