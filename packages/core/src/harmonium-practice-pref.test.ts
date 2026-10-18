import { describe, expect, it } from "vitest"

import { harmoniumPracticeActive } from "./harmonium-practice-pref"

describe("harmonium-practice-pref", () => {
  it("is always available to learners", () => {
    expect(harmoniumPracticeActive(false, false)).toBe(true)
    expect(harmoniumPracticeActive(false, true)).toBe(true)
    expect(harmoniumPracticeActive(true, false)).toBe(true)
    expect(harmoniumPracticeActive(true, true)).toBe(true)
  })
})
