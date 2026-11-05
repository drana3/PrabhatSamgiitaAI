import { describe, expect, it } from "vitest"

import {
  chartIsUsable,
  columnsInScript,
  layoutChart,
  chordSummary,
  chordsUsed,
  displayChord,
  splitWords,
  wordColumns,
  type ChordChart,
} from "@/lib/songPage/chordChart"
import {
  alignWords,
  demoExtras,
  explanationIsUsable,
  extrasForSong,
  glossFor,
  glossesAreUsable,
} from "@/lib/songPage/songContent"
import {
  availableScripts,
  buildLyricSources,
  detectScript,
  resolveScript,
  scriptLines,
  toSentenceCase,
} from "@/lib/songPage/scripts"
import {
  alignTranslationLines,
  coverageOf,
  groupLanguages,
  setPrimaryTranslation,
  toggleTranslation,
  translationPill,
} from "@/lib/songPage/translations"
import { normalizeSettings, DEFAULT_SONG_PAGE_SETTINGS } from "@/lib/songPage/settings"

const chart: ChordChart = {
  reviewed: true,
  baseKey: "C",
  lines: [
    {
      placements: [
        { word: 0, chord: "C" },
        { word: 2, chord: "Am" },
      ],
    },
    {
      placements: [
        { word: 0, chord: "Am" },
        { word: 1, chord: "F" },
      ],
    },
  ],
}

describe("chord chart", () => {
  it("is used only when reviewed and not empty", () => {
    expect(chartIsUsable(chart)).toBe(true)
    expect(chartIsUsable({ ...chart, reviewed: false })).toBe(false)
    expect(chartIsUsable({ reviewed: true, lines: [{ placements: [] }] })).toBe(false)
    expect(chartIsUsable(null)).toBe(false)
  })

  it("lists each chord once in song order", () => {
    expect(chordsUsed(chart)).toEqual(["C", "Am", "F"])
  })

  it("prints a chord only where it changes, across lines", () => {
    const first = wordColumns("Bandhu he niye calo", chart.lines[0].placements, null, (c) => c)
    expect(first.columns.map((c) => c.chord)).toEqual(["C", null, "Am", null])
    const second = wordColumns("Amára nishiithe", chart.lines[1].placements, first.lastChord, (c) => c)
    // line 2 starts on Am, the chord already sounding, so it is not repeated
    expect(second.columns.map((c) => c.chord)).toEqual([null, "F"])
  })

  it("lays out every line and maps chords onto another script only when word counts match", () => {
    const lines = ["Bandhu he niye calo", "Amára nishiithe"]
    const laid = layoutChart(lines, chart, (c) => c)
    expect(laid).toHaveLength(2)
    expect(laid[0].map((c) => c.chord)).toEqual(["C", null, "Am", null])
    expect(laid[1].map((c) => c.chord)).toEqual([null, "F"])
    const deva = columnsInScript(laid[0], "बन्धु हे निये चलो")
    expect(deva?.map((c) => c.chord)).toEqual(["C", null, "Am", null])
    expect(deva?.[0].word).toBe("बन्धु")
    expect(columnsInScript(laid[0], "बन्धु हे")).toBeNull()
  })

  it("ignores placements outside the line", () => {
    const out = wordColumns("one two", [{ word: 9, chord: "G" }], null, (c) => c)
    expect(out.columns.every((c) => c.chord === null)).toBe(true)
  })

  it("shows shapes or sounding names, and harmonium follows Sa", () => {
    const base = { instrument: "guitar" as const, capo: 5, mode: "shapes" as const, key: "D" }
    expect(displayChord("C", base, "C")).toBe("G")
    expect(displayChord("C", { ...base, mode: "sounding" }, "C")).toBe("C")
    expect(displayChord("C", { ...base, instrument: "harmonium" }, "C")).toBe("D")
  })

  it("summarises the setting", () => {
    expect(chordSummary({ instrument: "guitar", capo: 5, mode: "shapes", key: "D" })).toBe("Guitar, capo 5")
    expect(chordSummary({ instrument: "guitar", capo: 0, mode: "shapes", key: "D" })).toBe("Guitar, no capo")
    expect(chordSummary({ instrument: "harmonium", capo: 0, mode: "shapes", key: "D" })).toBe("Harmonium, Sa = D")
    expect(splitWords("  a  b ")).toEqual(["a", "b"])
  })
})

describe("script selection", () => {
  it("detects scripts", () => {
    expect(detectScript("Bandhu he")).toBe("roman")
    expect(detectScript("बन्धु हे")).toBe("devanagari")
    expect(detectScript("বন্ধু হে")).toBe("bengali")
    expect(detectScript(null)).toBe("roman")
  })

  it("puts Roman in sentence case with diacritics intact (BUG-13)", () => {
    expect(toSentenceCase("BANDHU HE NIYE CALO")).toBe("Bandhu he niye calo")
    expect(toSentenceCase("ÁMÁR PRABHU")).toBe("Ámár prabhu")
    expect(toSentenceCase("Bandhu He")).toBe("Bandhu He")
    expect(toSentenceCase("123")).toBe("123")
  })

  it("sorts catalog texts by script", () => {
    const s = buildLyricSources({
      lyrics: "বন্ধু হে\nনিয়ে চলো",
      transliteration: "BANDHU HE\nNIYE CALO",
      lyricsDevanagari: "बन्धु हे\nनिये चलो",
    })
    expect(s.bengali).toHaveLength(2)
    expect(s.roman).toEqual(["Bandhu he", "Niye calo"])
    expect(s.devanagari).toHaveLength(2)
    expect(availableScripts(s)).toEqual(["roman", "devanagari", "bengali"])
  })

  it("falls back to a script the song has", () => {
    expect(resolveScript("devanagari", ["roman"])).toBe("roman")
    expect(resolveScript("both", ["roman"])).toBe("roman")
    expect(resolveScript("both", ["roman", "devanagari"])).toBe("both")
    expect(resolveScript("bengali", ["devanagari"])).toBe("devanagari")
    expect(resolveScript("roman", [])).toBe("roman")
  })

  it("returns primary and secondary lines for Both", () => {
    const s = buildLyricSources({ lyrics: "Bandhu he\nNiye calo", lyricsDevanagari: "बन्धु हे\nनिये चलो" })
    const both = scriptLines(s, "both")
    expect(both.primaryScript).toBe("roman")
    expect(both.secondary).toEqual(s.devanagari)
    const deva = scriptLines(s, "devanagari")
    expect(deva.primary).toEqual(s.devanagari)
    expect(deva.secondary).toBeNull()
  })
})

describe("translations", () => {
  it("keeps at most two and drops the oldest on a third pick", () => {
    expect(toggleTranslation(["en"], "ru")).toEqual(["en", "ru"])
    expect(toggleTranslation(["en", "ru"], "fr")).toEqual(["ru", "fr"])
    expect(toggleTranslation(["en", "ru"], "ru")).toEqual(["en"])
    expect(toggleTranslation(["en"], "en")).toEqual(["en"])
  })

  it("moves a Meaning chip pick to the front", () => {
    expect(setPrimaryTranslation(["en", "ru"], "ru")).toEqual(["ru", "en"])
    expect(setPrimaryTranslation(["en", "ru"], "hi")).toEqual(["hi", "en"])
  })

  it("writes the pill", () => {
    expect(translationPill(["en"])).toBe("EN")
    expect(translationPill(["en", "ru"])).toBe("EN + RU")
    expect(translationPill(["mni-Mtei"])).toBe("MNI")
  })

  it("computes coverage", () => {
    expect(coverageOf(null, 10)).toBe("none")
    expect(coverageOf({ meaning: "text" }, 10)).toBe("meaning")
    expect(coverageOf({ lines: ["a", "b"] }, 10)).toBe("lines")
    const glosses = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [String(i), { text: "x", reviewed: true }]))
    expect(coverageOf({ lines: ["a", "b"], glosses }, 10)).toBe("full")
    expect(coverageOf({ lines: ["a", null], glosses }, 10)).toBe("none")
    const nine = Object.fromEntries(Array.from({ length: 9 }, (_, i) => [String(i), { text: "x", reviewed: true }]))
    expect(coverageOf({ lines: ["a"], glosses: nine }, 10)).toBe("lines")
  })

  it("groups and searches languages", () => {
    const groups = groupLanguages({ en: "full", hi: "lines" }, "")
    expect(groups[0].coverage).toBe("full")
    expect(groups[0].rows.map((r) => r.option.code)).toEqual(["en"])
    expect(groups[1].rows.map((r) => r.option.code)).toEqual(["hi"])
    expect(groups[groups.length - 1].coverage).toBe("none")
    const search = groupLanguages({}, "russ")
    expect(search).toHaveLength(1)
    expect(search[0].rows[0].option.code).toBe("ru")
    expect(groupLanguages({}, "zzzzzz")).toEqual([])
  })

  it("aligns translated lines only when counts match", () => {
    expect(alignTranslationLines(["a", "b"], "x\ny")).toEqual(["x", "y"])
    expect(alignTranslationLines(["a", "b"], "x\ny\nz")).toBeNull()
    expect(alignTranslationLines(["a"], "")).toBeNull()
  })
})

describe("extras and settings", () => {
  it("has no extras until the API delivers them", () => {
    const e = extrasForSong({ number: 1 })
    expect(e.chart).toBeNull()
    expect(glossesAreUsable(e.glosses)).toBe(false)
    expect(explanationIsUsable(e.explanation)).toBe(false)
  })

  it("falls back from the chosen gloss language to English", () => {
    const g = { byLanguage: { en: { "0:0": "friend" }, ru: { "0:1": "друг" } } }
    expect(glossFor(g, ["ru"], 0, 1)).toEqual({ text: "друг", language: "ru" })
    expect(glossFor(g, ["ru"], 0, 0)).toEqual({ text: "friend", language: "en" })
    expect(glossFor(g, ["ru"], 5, 5)).toBeNull()
  })

  it("aligns Devanagari words only when counts match", () => {
    expect(alignWords("a b", "x y")).toEqual(["x", "y"])
    expect(alignWords("a b", "x")).toBeNull()
    expect(alignWords("a b", undefined)).toBeNull()
  })

  it("builds usable demo content for review builds", () => {
    const d = demoExtras(["Bandhu he niye calo", "Amára"])
    expect(chartIsUsable(d.chart)).toBe(true)
    expect(glossesAreUsable(d.glosses)).toBe(true)
  })

  it("repairs damaged stored settings", () => {
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SONG_PAGE_SETTINGS)
    const s = normalizeSettings({
      capo: 40,
      translations: ["en", "ru", "es"],
      script: "klingon" as never,
      harmoniumKey: "Z",
    })
    expect(s.capo).toBe(7)
    expect(s.translations).toEqual(["ru", "es"])
    expect(s.script).toBe("roman")
    expect(s.harmoniumKey).toBe("D")
  })
})

import { coverageForSong, deriveMeaningView, needsMeaningFetch } from "@/lib/songPage/meaning"

describe("meaning view", () => {
  const song = {
    meaning: "My friend, take me along.",
    hindiMeaning: "मित्र, मुझे ले चलो।",
    localizedMeanings: {},
    localizedExplanations: {},
    centralIdea: "The devotee asks to be led.",
  }

  it("shows stored English and the official Central idea", () => {
    const view = deriveMeaningView(song, "en", null, false)
    expect(view.meaning).toEqual({ status: "ready", text: "My friend, take me along." })
    expect(view.centralIdea).toBe("The devotee asks to be led.")
  })

  it("never shows English under another language", () => {
    const view = deriveMeaningView(song, "fr", null, false)
    expect(view.meaning.status).toBe("unavailable")
    expect(view.centralIdea).toBeNull()
  })

  it("shows the loading state, then the translated text", () => {
    expect(deriveMeaningView(song, "fr", null, true).meaning.status).toBe("loading")
    const ready = deriveMeaningView(
      song,
      "fr",
      { meaning: "Mon ami, emmène-moi.", explanation: "Le dévot demande." },
      false,
    )
    expect(ready.meaning).toEqual({ status: "ready", text: "Mon ami, emmène-moi." })
    expect(ready.centralIdea).toBe("Le dévot demande.")
  })

  it("rejects a Central idea that echoes the official English one", () => {
    const view = deriveMeaningView(
      song,
      "fr",
      { meaning: "Mon ami.", explanation: "The devotee asks to be led." },
      false,
    )
    expect(view.centralIdea).toBeNull()
  })

  it("asks the service only when nothing is stored", () => {
    expect(needsMeaningFetch(song, "en")).toBe(false)
    expect(needsMeaningFetch(song, "hi")).toBe(false)
    expect(needsMeaningFetch(song, "ru")).toBe(true)
  })
})

describe("coverage for the sheet", () => {
  const song = {
    meaning: "One\nTwo",
    hindiMeaning: "एक पूरा अर्थ",
    localizedMeanings: {},
    localizedExplanations: {},
    centralIdea: null,
  }
  it("counts stored prose as meaning only (the catalog has no line-by-line text) and leaves the rest absent", () => {
    const out = coverageForSong(song, ["a b", "c d"], ["en", "hi", "ru"])
    expect(out.en).toBe("meaning")
    expect(out.hi).toBe("meaning")
    expect(out.ru).toBeUndefined()
  })
})
