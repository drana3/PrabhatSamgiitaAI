import { describe, expect, it } from "vitest"

import { quizOptionText } from "@/lib/quizReview"

describe("quizReview", () => {
  const options = [
    { id: "a", text: "5,018 songs" },
    { id: "b", text: "501 songs" },
  ]

  it("resolves option labels for review UI", () => {
    expect(quizOptionText(options, "b")).toBe("501 songs")
    expect(quizOptionText(options, "z")).toBe("Not answered")
    expect(quizOptionText(options, null)).toBe("Not answered")
  })
})