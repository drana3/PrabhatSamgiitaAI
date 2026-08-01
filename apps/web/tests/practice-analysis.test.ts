import { comparePitchSequence, midiFromWestern } from "@/lib/practice-analysis"

describe("practice analysis", () => {
  it("recognizes a transposed but matching melody", () => {
    const result = comparePitchSequence([65, 67, 69, 70, 72], [60, 62, 64, 65, 67])
    expect(result.score).toBeGreaterThan(95)
    expect(result.matchedNotes).toBe(5)
  })

  it("asks for a longer recording when pitch evidence is absent", () => {
    expect(comparePitchSequence([], [60, 62, 64]).score).toBe(0)
  })

  it("parses western notes for harmonium comparison", () => {
    expect(midiFromWestern("C4")).toBe(60)
    expect(midiFromWestern("F#4")).toBe(66)
  })

  it("rejects a melody with a different contour", () => {
    const result = comparePitchSequence([60, 71, 59, 72, 58, 73], [60, 62, 64, 65, 67, 69])
    expect(result.isLikelyMatch).toBe(false)
    expect(result.suggestions.join(" ")).toContain("does not appear to match")
  })

  it("accepts octave-transposed singing because the contour is the identity", () => {
    const result = comparePitchSequence([72, 74, 76, 77, 79], [60, 62, 64, 65, 67])
    expect(result.isLikelyMatch).toBe(true)
    expect(result.score).toBe(100)
  })

  it("does not parse unsupported accidental or malformed notes", () => {
    expect(midiFromWestern("Hb4")).toBeNull()
    expect(midiFromWestern("C##4")).toBeNull()
    expect(midiFromWestern("C")).toBeNull()
  })
})
