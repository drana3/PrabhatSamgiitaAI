import { describe, expect, it } from "vitest"

import {
  COMPANION_FEATURE_NAME,
  COMPOSER_NAME,
  PRODUCT_NAME,
  songShareCredit,
} from "./brand"

describe("brand", () => {
  it("keeps AI off the product name", () => {
    expect(PRODUCT_NAME).toBe("Prabhat Samgiita")
    expect(PRODUCT_NAME.includes("AI")).toBe(false)
  })

  it("names the composer with diacritics", () => {
    expect(COMPOSER_NAME).toBe("Shrii Prabhat Ranjan Sarkar")
  })

  it("treats companion as a separate feature", () => {
    expect(COMPANION_FEATURE_NAME).toContain("Companion")
    expect(COMPANION_FEATURE_NAME).not.toContain(PRODUCT_NAME)
  })

  it("uses product name in share credit", () => {
    expect(songShareCredit()).toBe(PRODUCT_NAME)
  })
})