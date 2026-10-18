import { compareLyricsTranscript, lyricTokens, normalizeLyricText } from "@/lib/lyrics-practice"

describe("lyrics practice", () => {
  it("scores a close romanized rendition of the lyric line", () => {
    const result = compareLyricsTranscript(
      "bandhu he niye calo alor oi jharana",
      ["BANDHU HE NIYE CALO", "ALOR OI JHARANA DHARARA PANE"],
    )
    expect(result.score).toBeGreaterThanOrEqual(50)
    expect(result.matchedWords).toBeGreaterThan(2)
    expect(result.bestLine).toBe("BANDHU HE NIYE CALO")
  })

  it("flags a lyric line that does not match", () => {
    const result = compareLyricsTranscript("completely different words here", ["BANDHU HE NIYE CALO"])
    expect(result.score).not.toBeNull()
    expect(result.score!).toBeLessThan(40)
    expect(result.suggestions.join(" ")).toMatch(/do not yet match/i)
  })

  it("normalizes lyric text for forgiving comparison", () => {
    expect(normalizeLyricText("Bandhu  He!!!")).toBe("bandhu he")
    expect(lyricTokens("bandhu he niye")).toEqual(["bandhu", "he", "niye"])
  })
})
