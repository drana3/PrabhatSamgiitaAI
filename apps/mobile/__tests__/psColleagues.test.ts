import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

import { colleagueAudioSongs, colleagueRecordingsOf, COLLEAGUE_AUDIO_BUCKET } from "@/lib/psColleagues/audio"
import { capoOf, chartsDiffer, colleagueChartsOf, hasColleagueChords } from "@/lib/psColleagues/chords"
import { translateColleague } from "@/lib/psColleagues/copy"
import { loadColleagueAudio, loadColleagueChords, loadColleagueTranslations } from "@/lib/psColleagues/load"
import { colleagueTextsOf, langOfVariant, pickVariant, variantOf } from "@/lib/psColleagues/translations"
import { colleaguesEn, colleaguesEs, colleaguesRu } from "@/locales/colleagues"

const report = JSON.parse(readFileSync(path.resolve(__dirname, "../../../data/curated/ps_colleagues/report.json"), "utf8")) as {
  counts: Record<string, number>
}

describe("colleague data (built by scripts/buildPsColleagueData.mjs)", () => {
  it("keeps every language the importer counted", async () => {
    const wire = await loadColleagueTranslations()
    const count = (lang: string) => Object.values(wire).filter((entry) => (entry as Record<string, unknown>)[lang]).length
    expect(count("en")).toBe(report.counts.translation_en)
    expect(count("ru")).toBe(report.counts.translation_ru)
    expect(count("uk")).toBe(report.counts.translation_uk)
    expect(count("fr")).toBe(report.counts.translation_fr)
  })

  it("ships chord pages only for the 73 songs that hold chord symbols, and the 14 PDF pages", async () => {
    const wire = await loadColleagueChords()
    expect(Object.keys(wire.docx)).toHaveLength(73)
    expect(Object.keys(wire.pdf)).toHaveLength(14)
    expect(report.counts.with_chords).toBe(146)
  })

  it("lists 69 recordings for 69 songs", async () => {
    const wire = await loadColleagueAudio()
    expect(colleagueAudioSongs(wire)).toHaveLength(69)
  })
})

describe("colleague translations", () => {
  it("gives the languages a song has, in the page's order, with the document's own words", async () => {
    const wire = await loadColleagueTranslations()
    const texts = colleagueTextsOf(wire, 1)
    expect(texts.map((t) => t.lang)).toEqual(["en", "ru", "uk", "fr"])
    expect(texts[0].versions[0].text.startsWith("O dearest Friend, lead me on.")).toBe(true)
    expect(texts[0].versions[0].note).toBe("Translated from Bengali")
  })

  it("has no English for song 68 and says nothing for a song the archives do not hold", async () => {
    const wire = await loadColleagueTranslations()
    expect(colleagueTextsOf(wire, 68).some((t) => t.lang === "en")).toBe(false)
    expect(colleagueTextsOf(wire, 99999)).toEqual([])
    expect(colleagueTextsOf(null, 1)).toEqual([])
    expect(colleagueTextsOf(wire, undefined)).toEqual([])
  })

  it("keeps a second text of the same language as another version, but not a romanised lyric", async () => {
    const wire = await loadColleagueTranslations()
    const ru759 = colleagueTextsOf(wire, 759).find((t) => t.lang === "ru")
    expect(ru759?.versions.length).toBe(2)
    expect(colleagueTextsOf(wire, 3261).find((t) => t.lang === "uk")?.versions).toHaveLength(1)
  })

  it("picks the variant: the reader's choice, else Official, else the language of the app", () => {
    const texts = [
      { lang: "en" as const, versions: [] },
      { lang: "ru" as const, versions: [] },
    ]
    expect(pickVariant({ chosen: variantOf("ru"), hasOfficial: true, texts, appLanguage: "en" })).toBe("colleagues:ru")
    expect(pickVariant({ chosen: variantOf("fr"), hasOfficial: true, texts, appLanguage: "en" })).toBe("official")
    expect(pickVariant({ chosen: null, hasOfficial: false, texts, appLanguage: "ru" })).toBe("colleagues:ru")
    expect(pickVariant({ chosen: null, hasOfficial: false, texts, appLanguage: "es" })).toBe("colleagues:en")
    expect(pickVariant({ chosen: null, hasOfficial: false, texts: [], appLanguage: "en" })).toBe("official")
    expect(langOfVariant("official")).toBeNull()
    expect(langOfVariant("colleagues:uk")).toBe("uk")
  })
})

describe("colleague chords", () => {
  it("reads a capo as the source writes it", () => {
    expect(capoOf("2")).toEqual({ kind: "fret", fret: 2 })
    expect(capoOf("0")).toEqual({ kind: "none" })
    expect(capoOf("none")).toEqual({ kind: "none" })
    expect(capoOf(null)).toEqual({ kind: "unstated" })
  })

  it("shows both the document page and the PDF page, never merged, and says they differ", async () => {
    const wire = await loadColleagueChords()
    const charts = colleagueChartsOf(wire, 135)
    expect(charts.map((c) => c.source.kind)).toEqual(["docx", "pdf"])
    expect(charts[0].capo).toEqual({ kind: "fret", fret: 6 })
    expect(charts[1].capo).toEqual({ kind: "fret", fret: 2 })
    expect(charts[1].hasWords).toBe(false)
    expect(chartsDiffer(charts)).toBe(true)
  })

  it("keeps the monospace page character for character", async () => {
    const wire = await loadColleagueChords()
    const [chart] = colleagueChartsOf(wire, 58)
    expect(chart.lines[0]).toBe("   C                            F                                 G                                      C")
    expect(chart.chordLines).toContain(0)
    expect(chart.chordLines).not.toContain(1)
  })

  it("does not draw a page of words alone", async () => {
    const wire = await loadColleagueChords()
    expect(hasColleagueChords(wire, 9)).toBe(false)
    expect(colleagueChartsOf(wire, 9)).toEqual([])
    expect(hasColleagueChords(wire, 58)).toBe(true)
  })

  it("reads a PDF with no capo as no capo (song 209)", async () => {
    const wire = await loadColleagueChords()
    const pdf = colleagueChartsOf(wire, 209).find((c) => c.source.kind === "pdf")
    expect(pdf?.capo).toEqual({ kind: "none" })
  })
})

describe("colleague audio bridge", () => {
  it("gives the recordings of a song with the key in the private bucket", async () => {
    const wire = await loadColleagueAudio()
    const [first] = colleagueRecordingsOf(wire, 1)
    expect(first.r2Key).toBe("audio-extractor/ps-audio/1 Bandhu He Niye Calo.m4a")
    expect(first.container).toBe("m4a")
    expect(first.isCurrent).toBe(true)
    expect(COLLEAGUE_AUDIO_BUCKET).toBe("am-site-books-private")
  })

  it("leaves out the ten files of the Google Drive folder Dada removed (matched by song and size)", async () => {
    const raw = JSON.parse(readFileSync(path.resolve(__dirname, "../../../data/curated/ps_colleagues/audio.json"), "utf8")) as {
      _meta: { excluded: Array<{ ps: number; bytes: number }> }
    }
    expect(raw._meta.excluded).toHaveLength(10)
    const wire = await loadColleagueAudio()
    for (const { ps, bytes } of raw._meta.excluded) {
      expect(colleagueRecordingsOf(wire, ps).some((r) => r.bytes === bytes)).toBe(false)
    }
    expect(colleagueRecordingsOf(wire, 99999)).toEqual([])
  })
})

describe("colleague copy", () => {
  it("has the same keys in English, Russian and Spanish", () => {
    const keys = Object.keys(colleaguesEn).sort()
    expect(Object.keys(colleaguesRu).sort()).toEqual(keys)
    expect(Object.keys(colleaguesEs).sort()).toEqual(keys)
  })

  it("fills the placeholders and falls back to English", () => {
    expect(translateColleague("ru", "colleagues.chords.capo", { capo: 2 })).toBe("Каподастр 2")
    expect(translateColleague("en", "colleagues.chords.from.pdf", { file: "450 PS CHORDS" })).toBe("From the PDF “450 PS CHORDS”")
    expect(translateColleague("en", "colleagues.source")).toBe("From colleagues' collection")
  })
})
