import { describe, expect, it } from "vitest"

import { harmoniumPracticeActive } from "./harmonium-practice-pref"

describe("harmonium-practice-pref", () => {
  it("requires sign-in and an explicit profile toggle", () => {
    expect(harmoniumPracticeActive(false, false)).toBe(false)
    expect(harmoniumPracticeActive(false, true)).toBe(false)
    expect(harmoniumPracticeActive(true, false)).toBe(false)
    expect(harmoniumPracticeActive(true, true)).toBe(true)
  })
})
