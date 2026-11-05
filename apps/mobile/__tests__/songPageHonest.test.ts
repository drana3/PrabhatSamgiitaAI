import { describe, expect, it } from "vitest"

import type { SongVideo } from "@/data/mock"
import { withFixtureStats } from "@/lib/fixtures/songs"
import { sampleGloss, sampleRussianLines, sampleTranslationLines } from "@/lib/fixtures/player"
import { splitWords } from "@/lib/playerV2/lyricsSync"
import { creditRows } from "@/lib/songPage/nowPlaying"
import {
  DEMO_FIXTURE_SONGS,
  EMPTY_TEXT,
  demoCentralIdea,
  gapText,
  knownSeconds,
  notationPdfUrl,
  pageExtras,
  playerGloss,
  playerGlossRows,
  playerRussianLines,
  playerSampleKey,
  requestKey,
  shownPerformer,
  watchVideos,
} from "@/lib/songPage/honest"
import { NO_EXTRAS } from "@/lib/songPage/songContent"

const LINES = ["Bandhu he niye calo", "Álor jharańá dháráy"]

describe("page extras: sample content only in the demo and only for PS 1 and 3", () => {
  it("gives a real song nothing: no chart, no word meanings, no explanation", () => {
    const extras = pageExtras({ real: NO_EXTRAS, demoKey: null, romanLines: LINES })
    expect(extras).toEqual(NO_EXTRAS)
  })

  it("gives the demo song its sample chart, word meanings and explanation", () => {
    const one = pageExtras({ real: NO_EXTRAS, demoKey: 1, romanLines: LINES })
    expect(one.chart?.lines).toHaveLength(2)
    expect(one.glosses?.byLanguage.en["0:0"]).toBe("friend")
    expect(one.explanation?.summary).toBeTruthy()
    const three = pageExtras({ real: NO_EXTRAS, demoKey: 3, romanLines: LINES })
    expect(three.explanation).not.toBeNull()
  })

  it("refuses any other song even with a demo key", () => {
    expect(DEMO_FIXTURE_SONGS).toEqual([1, 3])
    for (const key of [2, 4, 5018, 0]) {
      expect(pageExtras({ real: NO_EXTRAS, demoKey: key, romanLines: LINES })).toEqual(NO_EXTRAS)
    }
  })

  it("lets real content win over the sample", () => {
    const real = { ...NO_EXTRAS, chart: { reviewed: true, baseKey: "D", strum: "", lines: [] } }
    expect(pageExtras({ real, demoKey: 1, romanLines: LINES }).chart?.baseKey).toBe("D")
  })

  it("shows the sample central idea of PS 1 in the demo only", () => {
    expect(demoCentralIdea(1)).toMatch(/Paramapurus/)
    expect(demoCentralIdea(null)).toBeNull()
    expect(demoCentralIdea(2)).toBeNull()
  })
})

describe("videos", () => {
  const video = (id: string, embedUrl: string | null): SongVideo => ({ id, title: id, url: `https://y/${id}`, embedUrl, thumbnailUrl: "" })

  it("keeps rows with an embed, each embed once, in the catalog order", () => {
    const list = watchVideos([video("a", "https://e/1"), video("b", null), video("c", "https://e/1"), video("d", "https://e/2"), video("e", " ")])
    expect(list.map((v) => v.id)).toEqual(["a", "d"])
  })

  it("is empty for a song with no video, so the page says so", () => {
    expect(watchVideos([])).toEqual([])
    expect(watchVideos(undefined)).toEqual([])
    expect(EMPTY_TEXT.video).toBe("No video yet.")
  })
})

describe("credits, length and performer", () => {
  it("states the author once and invents no performer", () => {
    expect(creditRows()).toEqual([{ role: "Words and music", name: "Shrii P. R. Sarkar (Prabhat Samgiita)" }])
    expect(creditRows("  ")).toHaveLength(1)
    expect(creditRows(null)).toHaveLength(1)
  })

  it("adds a performer row only when one is given", () => {
    expect(creditRows("Performer A")).toEqual([
      { role: "Words and music", name: "Shrii P. R. Sarkar (Prabhat Samgiita)" },
      { role: "Performer", name: "Performer A" },
    ])
  })

  it("uses a length only when the recording's is known; the stored 300 s counts in the demo only", () => {
    expect(knownSeconds({ versionLength: 238, songSeconds: 300, demo: false })).toBe(238)
    expect(knownSeconds({ versionLength: null, songSeconds: 300, demo: false })).toBeNull()
    expect(knownSeconds({ versionLength: null, songSeconds: 300, demo: true })).toBe(300)
    expect(knownSeconds({ versionLength: 0, songSeconds: 0, demo: true })).toBeNull()
  })

  it("shows a performer in the demo only (a real version's name is its audio title)", () => {
    expect(shownPerformer({ demo: false, versionPerformer: "E GAN AMAR.mp3", songPerformer: "Prabhat Samgiita Collection" })).toBe("")
    expect(shownPerformer({ demo: true, versionPerformer: "Performer A", songPerformer: "x" })).toBe("Performer A")
    expect(shownPerformer({ demo: true, versionPerformer: undefined, songPerformer: " Performer B " })).toBe("Performer B")
  })
})

describe("empty states and notation", () => {
  it("has the three honest lines", () => {
    expect(EMPTY_TEXT.words).toBe("No word meanings yet.")
    expect(EMPTY_TEXT.chords).toBe("No chords for this song yet.")
  })

  it("keys a request per song and kind", () => {
    expect(requestKey("words", 12)).toBe("words:12")
    expect(requestKey("chords", 12)).not.toBe(requestKey("words", 12))
  })

  it("links the notation PDF only when its address is real", () => {
    expect(notationPdfUrl("https://prabhatasamgiita.net/notations/2.pdf")).toBe("https://prabhatasamgiita.net/notations/2.pdf")
    expect(notationPdfUrl(null)).toBeNull()
    expect(notationPdfUrl("  ")).toBeNull()
    expect(notationPdfUrl("javascript:alert(1)")).toBeNull()
  })
})

describe("player: sample word meanings and Russian lines only in the demo, only for PS 1 and 3", () => {
  const LANGS = ["en", "ru"]
  const rows = (sampleKey: number | null, lines: string[]) =>
    playerGlossRows({ sampleKey, languages: LANGS, scriptLines: lines, romanLines: lines, useDevanagari: false, splitWords, englishGloss: sampleGloss })

  it("gives no sample key outside the demo or for any other song", () => {
    expect(playerSampleKey({ demo: false, songNumber: 1 })).toBeNull()
    expect(playerSampleKey({ demo: false, songNumber: 3 })).toBeNull()
    expect(playerSampleKey({ demo: true, songNumber: 2 })).toBeNull()
    expect(playerSampleKey({ demo: true, songNumber: 5018 })).toBeNull()
    expect(playerSampleKey({ demo: true, songNumber: undefined })).toBeNull()
    expect(playerSampleKey({ demo: true, songNumber: 1 })).toBe(1)
    expect(playerSampleKey({ demo: true, songNumber: 3 })).toBe(3)
  })

  it("a real song with the sample words (Tumi, álo, calo, kole) gets no meanings", () => {
    const lines = ["Tumi eso álo jválo", "Bandhu he niye calo", "Tomár kole ámáy tule náo"]
    const real = rows(playerSampleKey({ demo: false, songNumber: 1234 }), lines)
    expect(real).toEqual({ en: null, ru: null })
    // the same lines in the demo's own song do get the sample meanings
    const demo = rows(playerSampleKey({ demo: true, songNumber: 1 }), lines)
    expect(demo.en?.[0]?.[0]).toBe("You")
    expect(demo.ru).not.toBeNull()
    // and the real PS 1 outside the demo still gets nothing
    expect(rows(playerSampleKey({ demo: false, songNumber: 1 }), lines)).toEqual({ en: null, ru: null })
  })

  it("playerGloss needs a sample key", () => {
    expect(playerGloss({ sampleKey: null, word: "Tumi", code: "en", englishGloss: sampleGloss })).toBeUndefined()
    expect(playerGloss({ sampleKey: 3, word: "Tumi", code: "en", englishGloss: sampleGloss })).toBe("You")
  })

  it("Russian sample lines only for a sample key and a matching line count", () => {
    expect(playerRussianLines({ sampleKey: null, lineCount: 4 })).toBeNull()
    expect(playerRussianLines({ sampleKey: 1, lineCount: 4 })).toHaveLength(4)
    expect(playerRussianLines({ sampleKey: 1, lineCount: 3 })).toBeNull()
    expect(playerRussianLines({ sampleKey: 3, lineCount: 3 })).toHaveLength(3)
  })

  it("the fixture functions give nothing outside the demo preview (the test run is not the demo)", () => {
    expect(sampleRussianLines(1, 4)).toBeNull()
    expect(sampleRussianLines(2, 4)).toBeNull()
    expect(sampleTranslationLines(1, "ru", 4)).toBeNull()
    expect(sampleTranslationLines(2, "es", 4)).toBeNull()
  })

  it("a song with no word meanings at all says so; other gaps keep their line", () => {
    expect(gapText({ kind: "words", shown: null, text: "Not available in English yet." })).toBe("No word meanings yet.")
    expect(gapText({ kind: "words", shown: "en", text: "Not available in Russian yet. Showing English." })).toBe(
      "Not available in Russian yet. Showing English.",
    )
    expect(gapText({ kind: "translation", shown: null, text: "Not available in Russian yet." })).toBe("Not available in Russian yet.")
  })
})

describe("Songs list: sample lengths, play counts and added dates stay in the demo", () => {
  const entry = {
    number: 42,
    title: "x",
    firstLine: null,
    category: "Other",
    language: null,
    durationSeconds: null,
    hasAudio: null,
    hasDevanagari: null,
    addedRank: null,
    plays: null,
  }

  it("leaves a real song's unknown numbers unknown", () => {
    expect(withFixtureStats(entry)).toEqual(entry)
    expect(withFixtureStats(entry, false)).toEqual(entry)
  })

  it("fills them only when the demo asks, and never over real values", () => {
    const sample = withFixtureStats(entry, true)
    expect(sample.durationSeconds).toBeGreaterThan(0)
    expect(sample.plays).not.toBeNull()
    expect(withFixtureStats({ ...entry, durationSeconds: 99 }, true).durationSeconds).toBe(99)
  })
})
