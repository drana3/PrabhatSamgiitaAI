import { describe, expect, it } from "vitest"

import {
  buildNotationSheetLine,
  formatTalaHeader,
  sheetPlayEvents,
} from "@prabhat/core"

describe("web notation sheet integration smoke", () => {
  it("positive: Kaharwa header and matra row for PS-style practice", () => {
    const sheet = buildNotationSheetLine(
      {
        line_number: 1,
        lyrics: "प्रि य प्रा णा",
        measures: [
          {
            beats: [
              { beat: 1, notes: [{ sargam: "D", western: "A4", duration: 1, syllable: "प्रि" }] },
              { beat: 2, notes: [{ sargam: "S", duration: 1, syllable: "S" }] },
              { beat: 3, notes: [{ sargam: "P", western: "G4", duration: 1, syllable: "य" }] },
              { beat: 4, notes: [{ sargam: "m", western: "F4", duration: 1, syllable: "प्रा" }] },
            ],
          },
        ],
      },
      { name: "कहरवा", beats: 8, groups: [4, 4] },
    )
    expect(formatTalaHeader({ name: "कहरवा", beats: 8, groups: [4, 4] }, 4961)).toContain("PS 4961")
    expect(sheet.cells.map((c) => c.matra).slice(0, 4)).toEqual(["X", "2", "3", "4"])
    expect(sheetPlayEvents(sheet.cells).length).toBeGreaterThan(0)
    const atTempo = sheetPlayEvents(sheet.cells, 0.55, 72)
    expect(atTempo[0]?.startSec).toBe(0)
    expect(atTempo[1]?.startSec).toBeGreaterThan(0.5)
  })

  it("negative: no play events when only holds", () => {
    const sheet = buildNotationSheetLine(
      {
        line_number: 1,
        lyrics: "",
        measures: [
          {
            beats: [
              { beat: 1, notes: [{ sargam: "S", duration: 1 }] },
              { beat: 2, notes: [{ sargam: "S", duration: 1 }] },
            ],
          },
        ],
      },
      { name: "Kaharva", beats: 8, groups: [4, 4] },
    )
    expect(sheetPlayEvents(sheet.cells)).toEqual([])
  })
})
