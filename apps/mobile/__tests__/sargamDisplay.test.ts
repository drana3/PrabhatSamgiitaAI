import { describe, expect, it } from "vitest"

import {
  buildDisplayNotes,
  distributeNotesToWords,
  formatPracticeSequence,
  harmoniumKeyLabel,
  toDevanagariSwara,
  toLatinSwara,
  type NotationLine,
} from "@/lib/sargamDisplay"

const sampleLine: NotationLine = {
  line_number: 1,
  lyrics: "BANDHU HE NIYE CALO",
  measures: [
    {
      beats: [
        { beat: 1, notes: [{ sargam: "P", western: "G4", duration: 1, octave: "middle" }] },
        { beat: 2, notes: [{ sargam: "m", western: "F4", duration: 1, octave: "middle" }] },
        { beat: 3, notes: [{ sargam: "G", western: "D4", duration: 1, octave: "middle" }] },
      ],
    },
  ],
}

describe("sargamDisplay (mobile)", () => {
  it("maps tokens to Sa Re Ga Ma like the website", () => {
    const notes = buildDisplayNotes(sampleLine)
    expect(toLatinSwara("m")).toBe("ma")
    expect(toDevanagariSwara("P")).toBe("प")
    expect(formatPracticeSequence(notes, "devanagari")).toBe("प · म · ग")
    expect(formatPracticeSequence(notes, "latin")).toBe("Pa · ma · Ga")
    expect(formatPracticeSequence(notes, "key")).toBe("G · F · D")
  })

  it("strips octave from western keys", () => {
    expect(harmoniumKeyLabel("C#4")).toBe("C#")
    expect(harmoniumKeyLabel(null, "S")).toBe("Sa")
  })

  it("distributes notes across lyric words", () => {
    const groups = distributeNotesToWords(
      ["BANDHU", "HE", "NIYE", "CALO"],
      buildDisplayNotes(sampleLine),
    )
    expect(groups).toHaveLength(4)
    expect(groups[0]?.notes[0]?.latin).toBe("Pa")
  })
})
