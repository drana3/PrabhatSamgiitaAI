import { describe, expect, it } from "vitest"

import { alignTranslation, buildLyricLines, sentenceCaseLine, splitLines } from "@/lib/playerV2/lyricsSync"

describe("player lyrics", () => {
  const lines = splitLines("Bandhu he niye calo\n\n  Alo ' r pathe  \nPrabhu\n")

  it("splits lines and trims blanks", () => {
    expect(lines).toEqual(["Bandhu he niye calo", "Alo ' r pathe", "Prabhu"])
    expect(splitLines(null)).toEqual([])
  })

  it("aligns a translation only when the line counts match", () => {
    expect(alignTranslation(lines, "a\nb\nc")).toEqual(["a", "b", "c"])
    expect(alignTranslation(lines, "one paragraph")).toBeNull()
    expect(alignTranslation([], "")).toBeNull()
  })

  it("keeps a translation on each line, and none when there is no translation", () => {
    expect(buildLyricLines(["a b", "c"], ["x", "y"])).toEqual([
      { text: "a b", translation: "x" },
      { text: "c", translation: "y" },
    ])
    expect(buildLyricLines(["a"], null)).toEqual([{ text: "a", translation: undefined }])
  })
})

describe("sentenceCaseLine", () => {
  it("lowers a line that is all capitals and keeps its first letter", () => {
    expect(sentenceCaseLine("BANDHU HE NIYE CALO")).toBe("Bandhu he niye calo")
    expect(sentenceCaseLine("ÁLOR OI JHARAŃÁ")).toBe("Álor oi jharańá")
  })
  it("leaves mixed case, short lines and uncased scripts alone", () => {
    expect(sentenceCaseLine("Bandhu he Niye calo")).toBe("Bandhu he Niye calo")
    expect(sentenceCaseLine("OM")).toBe("OM")
    expect(sentenceCaseLine("बन्धु हे")).toBe("बन्धु हे")
  })
})
