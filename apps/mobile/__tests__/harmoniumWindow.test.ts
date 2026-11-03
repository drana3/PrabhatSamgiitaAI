import { describe, expect, it } from "vitest"
import { harmoniumKeyboardLayout, westernToMidi } from "@prabhat/core"

import { sliceKeyboard, windowIndexOf } from "@/lib/harmonium-v2/keyboardWindow"
import { buildHarmoniumLine, chordChips, chordsInLine, rootSwara, swaraDisplay, wordsFromNotation } from "@/lib/harmonium-v2/lines"
import { SAMPLE_HARMONIUM_SONG } from "@/data/harmoniumSample"
import type { DisplayNote } from "@/lib/sargamDisplay"

describe("keyboard window", () => {
  const keys = harmoniumKeyboardLayout("D")

  it("the layout has 25 keys from mandra Sa to taar Sa, Sa marked", () => {
    expect(keys).toHaveLength(25)
    expect(keys.filter((key) => key.isSa).map((key) => keys.indexOf(key))).toEqual([0, 12, 24])
  })

  it("a window from the middle Sa has 13 keys, Sa first and last", () => {
    const { keys: window, firstIndex } = sliceKeyboard(keys, 12, 13)
    expect(firstIndex).toBe(12)
    expect(window).toHaveLength(13)
    expect(window[0]!.isSa).toBe(true)
    expect(window[12]!.isSa).toBe(true)
    expect(window[0]!.latin).toBe("Sa")
  })

  it("re-bases geometry: white keys count 0.., black keys sit between whites", () => {
    const { keys: window } = sliceKeyboard(keys, 12, 13)
    const whites = window.filter((key) => !key.isBlack)
    expect(whites.map((key) => key.whiteIndex)).toEqual(whites.map((_, i) => i))
    for (const black of window.filter((key) => key.isBlack)) {
      expect(black.whiteIndex).toBeGreaterThanOrEqual(0)
      expect(black.blackLeftPercent).toBeGreaterThan(0)
      expect(black.blackLeftPercent).toBeLessThan(100)
    }
  })

  it("a window never starts or ends on a black key", () => {
    for (let start = 0; start <= 12; start += 1) {
      const { keys: window } = sliceKeyboard(keys, start, 13)
      expect(window[0]!.isBlack).toBe(false)
      expect(window[window.length - 1]!.isBlack).toBe(false)
      // the window still holds the notes that were asked for
      expect(window.length).toBeGreaterThanOrEqual(13)
    }
  })

  it("keeps the western note of each key", () => {
    const { keys: window, firstIndex } = sliceKeyboard(keys, 12, 13)
    expect(window[0]!.western).toBe(keys[firstIndex]!.western)
    expect(westernToMidi(window[12]!.western)! - westernToMidi(window[0]!.western)!).toBe(12)
  })

  it("maps a full-layout index into the window", () => {
    expect(windowIndexOf(10, 12, 13)).toBe(2)
    expect(windowIndexOf(10, 9, 13)).toBe(-1)
    expect(windowIndexOf(10, 23, 13)).toBe(-1)
  })
})

describe("harmonium lyric line", () => {
  it("names swaras from tokens and names", () => {
    expect(swaraDisplay("S")).toBe("Sa")
    expect(swaraDisplay("g")).toBe("ga")
    expect(swaraDisplay("Ga")).toBe("Ga")
    expect(swaraDisplay("ga")).toBe("ga")
    expect(swaraDisplay("pa")).toBe("Pa")
    expect(swaraDisplay("-")).toBe("–")
    expect(swaraDisplay("")).toBeNull()
    expect(swaraDisplay("hello")).toBeNull()
  })

  it("puts the chord above the word where it changes and the swara under every word", () => {
    const line = buildHarmoniumLine(SAMPLE_HARMONIUM_SONG.lines[0]!)
    expect(line.map((w) => w.chord)).toEqual(["C", null, "Am", "F"])
    expect(line.map((w) => w.swara)).toEqual(["Sa", "Re", "Ga", "Ma"])
    expect(line.map((w) => w.word)).toEqual(["Bandhu", "he", "niye", "calo"])
  })

  it("lists the distinct chords of a line in order", () => {
    expect(chordsInLine(SAMPLE_HARMONIUM_SONG.lines[0]!)).toEqual(["C", "Am", "F"])
    expect(chordsInLine([{ word: "a", chord: "G" }, { word: "b", chord: "G" }, { word: "c", chord: "bogus" }])).toEqual(["G"])
  })

  it("builds chord chips for a key and drops unknown names", () => {
    const chips = chordChips(["C", "Am", "nope"], "C")
    expect(chips.map((chip) => chip.chord.name)).toEqual(["C", "Am"])
    expect(chordChips(["C"], "H")).toEqual([])
  })

  it("says which swara a chord root is", () => {
    expect(rootSwara("G", "D")).toBe("Ma")
    expect(rootSwara("D", "D")).toBe("Sa")
    expect(rootSwara("Am", "C")).toBe("Dha")
    expect(rootSwara("??", "C")).toBeNull()
  })

  it("spreads notation notes over words and keeps chord letters", () => {
    const note = (latin: string): DisplayNote => ({ sargam: latin, latin, devanagari: "", key: "", octave: "middle" })
    const words = wordsFromNotation(["Bandhu", "he", "niye"], [note("Sa"), note("Re"), note("Ga")], { 0: "C", 2: "Am" })
    expect(words).toEqual([
      { word: "Bandhu", chord: "C", swara: "Sa" },
      { word: "he", chord: null, swara: "Re" },
      { word: "niye", chord: "Am", swara: "Ga" },
    ])
    const fewer = wordsFromNotation(["a", "b"], [note("Sa"), note("Re"), note("Ga"), note("Ma")])
    expect(fewer.map((w) => w.swara)).toEqual(["Sa Re", "Ga Ma"])
    expect(wordsFromNotation(["a"], [])[0]!.swara).toBeNull()
  })
})
