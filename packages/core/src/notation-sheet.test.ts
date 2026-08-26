import { describe, expect, it } from "vitest"

import {
  buildNotationSheetLine,
  formatTalaHeader,
  harmoniumSampleUrl,
  matraLabel,
  secondsPerMatraFromTempo,
  sheetPlayEvents,
  westernToHz,
  westernToSampleStem,
} from "./notation-sheet"

const kaharwaLine = {
  line_number: 1,
  lyrics: "ई ट म न त्र मो र",
  measures: [
    {
      beats: [
        { beat: 1, notes: [{ sargam: "P", western: "G4", duration: 1, syllable: "ई" }] },
        { beat: 2, notes: [{ sargam: "S", western: null, duration: 1, syllable: "S" }] },
        { beat: 3, notes: [{ sargam: "P", western: "G4", duration: 1, syllable: "ट" }] },
        { beat: 4, notes: [{ sargam: "S", western: null, duration: 1, syllable: "S" }] },
      ],
    },
    {
      beats: [
        { beat: 5, notes: [{ sargam: "P", western: "G4", duration: 1, syllable: "म" }] },
        { beat: 6, notes: [{ sargam: "S", western: null, duration: 1, syllable: "S" }] },
        { beat: 7, notes: [{ sargam: "P", western: "G4", duration: 1, syllable: "न" }] },
        { beat: 8, notes: [{ sargam: "S", western: null, duration: 1, syllable: "S" }] },
      ],
    },
  ],
}

describe("notation sheet (expert matra layout)", () => {
  it("positive: builds lyric · sargam · X2345678 for Kaharwa", () => {
    const sheet = buildNotationSheetLine(kaharwaLine, { name: "Kaharva", beats: 8, groups: [4, 4] })
    expect(formatTalaHeader({ name: "Kaharva", beats: 8, groups: [4, 4] }, 4961)).toBe(
      "PS 4961 · ताल - Kaharva 8 मात्रा",
    )
    expect(sheet.cells).toHaveLength(8)
    expect(sheet.cells.map((cell) => cell.matra)).toEqual(["X", "2", "3", "4", "5", "6", "7", "8"])
    expect(sheet.cells[0]?.sargam).toBe("प")
    expect(sheet.cells[1]?.sargam).toBe("S")
    expect(sheet.cells[0]?.lyric).toBe("ई")
    expect(sheet.cells[1]?.lyric).toBe("S")
    expect(sheet.cells[0]?.barStart).toBe(true)
    expect(sheet.cells[4]?.barStart).toBe(true)
  })

  it("positive: play events skip holds and keep western pitches", () => {
    const sheet = buildNotationSheetLine(kaharwaLine, { name: "Kaharva", beats: 8, groups: [4, 4] })
    const events = sheetPlayEvents(sheet.cells, 0.5)
    expect(events.length).toBe(4)
    expect(events[0]?.western).toBe("G4")
    expect(events[0]?.frequencyHz).toBeCloseTo(westernToHz("G4")!, 1)
    expect(events[0]?.startSec).toBe(0)
  })

  it("negative: empty measures still yield a safe sheet", () => {
    const sheet = buildNotationSheetLine(
      { line_number: 2, lyrics: "", measures: [{ beats: [] }] },
      { name: "Dadra", beats: 6, groups: [3, 3] },
    )
    expect(sheet.cells).toEqual([])
  })

  it("negative: invalid western pitch is ignored in play list", () => {
    expect(westernToHz("not-a-note")).toBeNull()
    const sheet = buildNotationSheetLine(
      {
        line_number: 1,
        lyrics: "a",
        measures: [{ beats: [{ beat: 1, notes: [{ sargam: "S", western: "??", duration: 1 }] }] }],
      },
      null,
    )
    expect(sheetPlayEvents(sheet.cells)).toEqual([])
  })

  it("matraLabel marks sam as X", () => {
    expect(matraLabel(1)).toBe("X")
    expect(matraLabel(5)).toBe("5")
  })

  it("positive: Sa with western shows सा; hold without pitch shows S", () => {
    const sheet = buildNotationSheetLine(
      {
        line_number: 1,
        lyrics: "का S",
        measures: [
          {
            beats: [
              { beat: 1, notes: [{ sargam: "S", western: "C4", duration: 1, syllable: "का" }] },
              { beat: 2, notes: [{ sargam: "-", western: null, duration: 1, syllable: "S" }] },
            ],
          },
        ],
      },
      { name: "Kaharva", beats: 8, groups: [4, 4] },
    )
    expect(sheet.cells[0]?.sargam).toBe("सा")
    expect(sheet.cells[1]?.sargam).toBe("S")
    expect(sheetPlayEvents(sheet.cells).map((e) => e.western)).toEqual(["C4"])
  })

  it("positive: sample bank stems map sharps and flats", () => {
    expect(westernToSampleStem("G4")).toBe("G4")
    expect(westernToSampleStem("C#4")).toBe("Cs4")
    expect(westernToSampleStem("Bb3")).toBe("As3")
    expect(harmoniumSampleUrl("C4")).toBe("/audio/harmonium/C4.wav")
    expect(westernToSampleStem("not-a-note")).toBeNull()
  })

  it("positive: tempo drives matra spacing for playback", () => {
    expect(secondsPerMatraFromTempo(72)).toBeCloseTo(60 / 72, 5)
    const sheet = buildNotationSheetLine(kaharwaLine, { name: "Kaharva", beats: 8, groups: [4, 4] })
    const events = sheetPlayEvents(sheet.cells, 0.55, 72)
    expect(events.length).toBe(4)
    expect(events[1]?.startSec).toBeCloseTo(secondsPerMatraFromTempo(72) * 2, 5)
  })

  it("positive: expert PS 4961 line 1 play events skip holds and keep order", () => {
    const expertLine = {
      line_number: 1,
      lyrics: "ईष्टमन्त्र मोर प्रिय प्राणाधिक",
      measures: [
        {
          beats: [
            { beat: 1, notes: [{ sargam: "P", western: "G4", duration: 1, syllable: "ई" }] },
            { beat: 2, notes: [{ sargam: "-", western: null, duration: 1, syllable: "S" }] },
            { beat: 3, notes: [{ sargam: "P", western: "G4", duration: 1, syllable: "ट" }] },
            { beat: 4, notes: [{ sargam: "-", western: null, duration: 1, syllable: "म" }] },
          ],
        },
        {
          beats: [
            { beat: 9, notes: [{ sargam: "D", western: "A4", duration: 1, syllable: "प्रि" }] },
            { beat: 10, notes: [{ sargam: "-", western: null, duration: 1, syllable: "य" }] },
            { beat: 11, notes: [{ sargam: "P", western: "G4", duration: 1, syllable: "प्रा" }] },
            { beat: 12, notes: [{ sargam: "m", western: "F4", duration: 1, syllable: "णा" }] },
          ],
        },
      ],
    }
    const sheet = buildNotationSheetLine(expertLine, { name: "Kaharva", beats: 8, groups: [4, 4] })
    const events = sheetPlayEvents(sheet.cells, 0.55, 72)
    expect(events.map((e) => e.western)).toEqual(["G4", "G4", "A4", "G4", "F4"])
    expect(events[0]?.startSec).toBe(0)
    expect(events[1]?.startSec).toBeCloseTo(secondsPerMatraFromTempo(72) * 2, 4)
  })
})
