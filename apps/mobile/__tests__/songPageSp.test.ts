import { describe, expect, it } from "vitest"

import {
  capoHint,
  diagramPaths,
  guitarKeyNote,
  harmoniumChord,
  keyLabel,
  shapeCards,
  spBestCapo,
  spShape,
  spTranspose,
  swaraRow,
} from "@/lib/songPage/spChords"
import { buildSpLines, glossCard } from "@/lib/songPage/spLines"
import { fixtureChart, fixtureExtras, fixtureGlosses, glossaryGloss } from "@/lib/fixtures/songPage"
import { glossFor } from "@/lib/songPage/songContent"

describe("prototype chord arithmetic", () => {
  it("lowers the shapes by the capo with the prototype spelling", () => {
    expect(spShape("C", 5)).toBe("G")
    expect(spShape("Am", 5)).toBe("Em")
    expect(spShape("F", 5)).toBe("C")
    expect(spShape("G", 5)).toBe("D")
    expect(spShape("Am", 1)).toBe("Abm")
    expect(spShape("C", 2)).toBe("Bb")
  })

  it("moves the chart up for the harmonium key", () => {
    expect(harmoniumChord("C", "C", "D")).toBe("D")
    expect(harmoniumChord("Am", "C", "D#")).toBe("Cm")
    expect(harmoniumChord("C", "C", "D#")).toBe("Eb")
    expect(spTranspose("G7", 2)).toBe("A7")
  })

  it("shows Eb where the store keeps D#", () => {
    expect(keyLabel("D#")).toBe("Eb")
    expect(keyLabel("D")).toBe("D")
  })

  it("lists the swaras on the chosen Sa", () => {
    expect(swaraRow("D").map((r) => r.n)).toEqual(["D", "E", "F#", "G", "A", "B", "C#"])
    expect(swaraRow("C").map((r) => r.s)).toEqual(["Sa", "Re", "Ga", "Ma", "Pa", "Dha", "Ni"])
  })

  it("finds the capo with the fewest barre chords for C Am F G", () => {
    // capo 5: G Em C D, all open
    expect(spBestCapo(["C", "Am", "F", "G"])).toBe(5)
    expect(capoHint(["C", "Am", "F", "G"], 5)).toEqual({
      text: "All open shapes: the easiest capo for this song.",
      action: "",
    })
    expect(capoHint(["C", "Am", "F", "G"], 0).action).toBe("Use it")
    expect(capoHint(["C", "Am", "F", "G"], 0).text).toBe("Easiest shapes: capo 5, all open chords.")
  })

  it("words the capo line like the prototype", () => {
    expect(guitarKeyNote(["C", "Am", "F", "G"], 0)).toBe("No capo. Chords sound as written.")
    expect(guitarKeyNote(["C", "Am", "F", "G"], 5)).toBe("Capo 5. You play G Em C D. It sounds C Am F G.")
  })

  it("builds a card per distinct chord", () => {
    const cards = shapeCards(["C", "Am", "C", "F"], 0)
    expect(cards.map((c) => c.name)).toEqual(["C", "Am", "F"])
    expect(cards.map((c) => c.sub)).toEqual(["open", "open", "barre"])
    expect(shapeCards(["F"], 5)[0].sub).toBe("sounds F")
    expect(shapeCards(["C"], 2)[0]).toMatchObject({ name: "Bb", sub: "sounds C · barre" })
  })

  it("draws a chord box", () => {
    const g = diagramPaths("x32010")
    expect(g.nut).toBe("M17 16H64")
    expect(g.mute).toContain("M15.2 5.5")
    expect(g.open).not.toBe("")
    expect(g.fl).toBe("")
    expect(diagramPaths("x13331").fl).toBe("")
    expect(diagramPaths("466544").fl).toBe("4fr")
    expect(diagramPaths("133211").bar).toBe("M18 22.5H63")
  })
})

describe("fixtures", () => {
  it("glosses a word by its Roman spelling in any language", () => {
    expect(glossaryGloss("Bandhu", "en")).toBe("friend")
    expect(glossaryGloss("bandhu,", "ru")).toBe("друг")
    expect(glossaryGloss("Bandhu", "fr")).toBe("ami")
    expect(glossaryGloss("unknownword", "en")).toBeNull()
  })

  it("places chords on the first and middle word of each line", () => {
    const chart = fixtureChart(["Bandhu he niye calo", "Álor jharańá dháráy dhuiye dáo"], 1)
    expect(chart.lines[0].placements).toEqual([
      { word: 0, chord: "C" },
      { word: 2, chord: "Am" },
    ])
    expect(chart.lines[1].placements).toEqual([
      { word: 0, chord: "Am" },
      { word: 3, chord: "F" },
    ])
  })

  it("keeps the explanation to the two prototype songs", () => {
    expect(fixtureExtras(["Bandhu he"], 1).explanation?.keyTerms[0].term).toBe("Bandhu")
    expect(fixtureExtras(["Bandhu he"], 9).explanation).toBeNull()
    const glosses = fixtureGlosses(["Bandhu he niye calo"])
    expect(glosses && glossFor(glosses, ["ru"], 0, 0)?.text).toBe("друг")
  })
})

describe("lyric rows", () => {
  const columns = [[{ word: "Bandhu", chord: "C" }, { word: "he", chord: null }]]
  it("carries chord and swara per word", () => {
    const rows = buildSpLines({
      primary: ["Bandhu he"],
      columnsByLine: columns,
      secondary: null,
      translations: [{ code: "en", lines: ["Friend."] }],
      chordsOn: true,
      instrument: "harmonium",
    })
    expect(rows[0].tokens.map((t) => [t.text, t.chord, t.swara])).toEqual([
      ["Bandhu", "C", "Sa"],
      ["he", "", "Re"],
    ])
    expect(rows[0].translations).toEqual(["Friend."])
  })

  it("draws no chord or swara with chords off", () => {
    const rows = buildSpLines({
      primary: ["Bandhu he"],
      columnsByLine: columns,
      secondary: ["बन्धु हे"],
      translations: [],
      chordsOn: false,
      instrument: "harmonium",
    })
    expect(rows[0].tokens.every((t) => !t.chord && !t.swara)).toBe(true)
    expect(rows[0].second).toBe("बन्धु हे")
  })

  it("writes the gloss card", () => {
    const rows = buildSpLines({
      primary: ["Bandhu he"],
      columnsByLine: null,
      secondary: null,
      translations: [],
      chordsOn: false,
      instrument: "guitar",
    })
    const glosses = fixtureGlosses(["Bandhu he"])
    expect(glossCard(null, rows, glosses, ["en"], [true])).toEqual({
      title: "Tap or hover a word",
      detail: "Its meaning shows here",
    })
    expect(glossCard("0-0", rows, glosses, ["en", "ru"], [true])).toEqual({ title: "friend", detail: "Bandhu · друг" })
    expect(glossCard("0-0", rows, glosses, ["en"], [false]).detail).toBe("No word meaning added yet")
  })
})
