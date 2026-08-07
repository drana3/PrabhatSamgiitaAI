import { describe, expect, it } from "vitest"

import { parseQuizEventSlug } from "@/lib/quizEvent"

describe("parseQuizEventSlug", () => {
  it("accepts bare quiz codes", () => {
    expect(parseQuizEventSlug("abc123")).toBe("abc123")
  })

  it("parses prabhatai deep links", () => {
    expect(parseQuizEventSlug("prabhatai://quiz/event/live-quiz-1")).toBe("live-quiz-1")
  })
})
