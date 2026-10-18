import { describe, expect, it } from "vitest"

import { emptyQuestion, qrCodeUrl } from "@/lib/quiz-events"

describe("quiz-events helpers", () => {
  it("builds four default options for each question", () => {
    const question = emptyQuestion(0)
    expect(question.options).toHaveLength(4)
    expect(question.correct_option_id).toBe("a")
  })

  it("builds a QR image URL for deep links", () => {
    const url = qrCodeUrl("prabhatai://quiz/event/abc123")
    expect(url).toContain("api.qrserver.com")
    expect(url).toContain(encodeURIComponent("prabhatai://quiz/event/abc123"))
  })
})
