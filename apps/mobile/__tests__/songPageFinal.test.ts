import fs from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import { aboutRows, parseCompositionDate, WORDS_AND_MUSIC } from "@/lib/songPage/aboutFacts"
import { alignLines, meaningLines, standsAlone } from "@/lib/songPage/alignLines"
import { foldLine, indentOf, markerTimes, parseLyricStructure, repeatsOf, splitStanzas } from "@/lib/songPage/lyricStructure"
import { meaningSourceFor, officialEnglishMeaning, storedMeaningRaw } from "@/lib/songPage/meaningInfo"
import { STRIP_HEIGHT, activeSectionAt, jumpOffset, menuSections, sectionTops, visibleTabs, type SongFacts } from "@/lib/songPage/pageSections"
import { translatePage } from "@/lib/songPage/pageCopy"
import { buildLyricSources, toSentenceCase } from "@/lib/songPage/scripts"
import { songPageEn, songPageEs, songPageRu } from "@/locales/songPage"

type CatalogueSong = { number: number; title: string; lyrics_original: string | null; transliteration: string | null; lyrics_devanagari: string | null }
const catalogue: CatalogueSong[] = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../../data/generated/songs.json"), "utf8"))
const song = (n: number): CatalogueSong => catalogue.find((row) => row.number === n) as CatalogueSong

// PS 2, the real lyrics of the catalogue
const PS2 = [
  "E gán ámár, álor jharańá dhárá",
  "Upala pathe dine ráte",
  "Bahe jái",
  "Bahe jái bándhana hárá",
  "Álor jharańá dhárá",
  "E gán ámár álor jharańá dhárá",
  "E path ámár bandhura kanťaka bhará",
  "Utsa hote práńera shrote",
  "Bheunge jái",
  "Bhenge jái páśáńa kárá",
  "Álor jharańá dhárá",
  "E gán ámár álor jharańá dhárá",
]

describe("alignLines", () => {
  it("pairs the lines when the counts are equal", () => {
    const result = alignLines(["Bandhu he", "Niye calo"], "Friend.\nLead me on.")
    expect(result).toEqual({
      kind: "pairs",
      pairs: [
        { line: "Bandhu he", meaning: "Friend." },
        { line: "Niye calo", meaning: "Lead me on." },
      ],
    })
  })

  it("ignores blank lines and spaces around lines", () => {
    const result = alignLines(["a", "b"], "  One. \n\n Two.  \n")
    expect(result.kind).toBe("pairs")
  })

  it("never pairs lines that run on, even when the counts match: PS 33 (real catalogue text)", () => {
    const lyrics = ["Tomár náme tomár gáne", "Hoyechi ápan hárá", "Ándhár páne calá pathik", "Peyeche álok dhárá"]
    const meaning = "In Your name,\nin Your song\nI have lost myself.\nThe traveler who was lost in the darkness"
    expect(alignLines(lyrics, meaning)).toEqual({ kind: "stacked", reason: "runs-on", lyricCount: 4, meaningCount: 4 })
  })

  it("standsAlone reads the first and the last character of a line", () => {
    expect(standsAlone("I have lost myself.")).toBe(true)
    expect(standsAlone('"I have smashed the walls."')).toBe(true)
    expect(standsAlone("In Your name,")).toBe(false)
    expect(standsAlone("in Your song.")).toBe(false)
    expect(standsAlone("has now found the stream of light")).toBe(false)
  })

  it("never pairs when the counts differ: PS 2 has 12 lyric lines and 18 meaning lines", () => {
    const meaning = Array.from({ length: 18 }, (_, i) => `line ${i}`).join("\n")
    expect(alignLines(PS2, meaning)).toEqual({ kind: "stacked", reason: "count-differs", lyricCount: 12, meaningCount: 18 })
  })

  it("does not pair a one-paragraph translation", () => {
    expect(alignLines(["a", "b", "c"], "One paragraph of text.").kind).toBe("stacked")
  })

  it("says why there is nothing to pair", () => {
    expect(alignLines(["a"], "")).toMatchObject({ kind: "stacked", reason: "no-meaning" })
    expect(alignLines(["a"], null)).toMatchObject({ kind: "stacked", reason: "no-meaning" })
    expect(alignLines([], "x")).toMatchObject({ kind: "stacked", reason: "no-lyrics" })
    expect(alignLines(["  "], "x")).toMatchObject({ kind: "stacked", reason: "no-lyrics" })
  })

  it("splits meaning text into trimmed non-empty lines", () => {
    expect(meaningLines("a\r\n b \n\n")).toEqual(["a", "b"])
    expect(meaningLines(undefined)).toEqual([])
  })
})

describe("stanzas and repeats", () => {
  it("folds accents, case and punctuation", () => {
    expect(foldLine("E gán ámár, álor")).toBe(foldLine("E GAN AMAR ALOR!"))
    expect(foldLine("  ,, ")).toBe("")
  })

  it("marks the lines that say an earlier line again", () => {
    const repeats = repeatsOf(PS2)
    expect(repeats[4]).toBeNull() // first time "Álor jharańá dhárá"
    expect(repeats[10]).toBe(4) // again
    expect(repeats[5]).toBe(0) // the first line returns, without the comma
    expect(repeats[11]).toBe(0)
    expect(repeats[1]).toBeNull()
  })

  it("splits PS 2 where the song returns to its first line and keeps the closing refrain with its stanza", () => {
    expect(splitStanzas(PS2)).toEqual([
      { from: 0, to: 4 },
      { from: 5, to: 11 },
    ])
  })

  it("is one stanza when the song never returns to its first line", () => {
    expect(splitStanzas(["a", "b", "c"])).toEqual([{ from: 0, to: 2 }])
  })

  it("does not split on a line that only repeats the line just sung", () => {
    expect(splitStanzas(["la la", "la la", "other"])).toEqual([{ from: 0, to: 2 }])
  })

  it("handles no lines", () => {
    expect(splitStanzas([])).toEqual([])
    expect(repeatsOf([])).toEqual([])
  })

  it("covers every line exactly once", () => {
    const stanzas = splitStanzas(PS2)
    const covered = stanzas.flatMap((s) => Array.from({ length: s.to - s.from + 1 }, (_, i) => s.from + i))
    expect(covered).toEqual(PS2.map((_, i) => i))
  })
})

describe("lyric structure", () => {
  const roman = (n: number) => parseLyricStructure(song(n).lyrics_original, toSentenceCase)

  it("keeps the lines exactly as the app's lyric sources build them", () => {
    for (const n of [1, 2, 3, 7, 33, 419, 1120, 1995, 5018]) {
      const row = song(n)
      if (!row.lyrics_original) continue
      const expected = buildLyricSources({ lyrics: row.lyrics_original, transliteration: row.transliteration, lyricsDevanagari: row.lyrics_devanagari }).roman
      expect(parseLyricStructure(row.lyrics_original, toSentenceCase).lines, `PS ${n}`).toEqual(expected)
    }
  })

  it("PS 2: two stanzas, drawn where the song returns to its first line; the line that says an earlier line again is a repeat", () => {
    const s = roman(2)
    expect(s.lines).toHaveLength(PS2.length)
    expect(foldLine(s.lines[0] as string)).toBe(foldLine("E gán ámár, álor jharańá dhárá"))
    expect(s.lines[4]).toBe(s.lines[10])
    expect(s.blocks.map((b) => b.lines.map((l) => l.index))).toEqual([
      [0, 1, 2, 3, 4],
      [5, 6, 7, 8, 9, 10, 11],
    ])
    expect(s.derived).toBe(true)
    expect(s.explicitBreaks).toBe(0)
    expect(s.hasRepeats).toBe(true)
    expect(s.blocks[1]?.lines[5]?.repeatOf).toBe(4) // "Álor jharańá dhárá" again
    expect(s.blocks[1]?.lines[0]?.repeatOf).toBe(0) // the first line returns
  })

  it("never labels a block Refrain that the data does not show to be one", () => {
    for (const n of [2, 3, 33, 1120, 1995]) {
      for (const b of roman(n).blocks) {
        if (b.label === "refrain") expect(b.lines.every((l) => l.repeatOf !== null), `PS ${n}`).toBe(true)
        expect(b.labelText).toBeNull() // the catalogue text labels nothing
      }
    }
  })

  it("covers every line exactly once, in order, in every block of every song with lyrics", () => {
    for (const row of catalogue) {
      if (!row.lyrics_original?.trim()) continue
      const s = parseLyricStructure(row.lyrics_original)
      expect(s.blocks.flatMap((b) => b.lines.map((l) => l.index)), `PS ${row.number}`).toEqual(s.lines.map((_, i) => i))
    }
  })

  it("a blank line is a stanza break the text itself made", () => {
    const s = parseLyricStructure("one\ntwo\n\nthree\nfour")
    expect(s.lines).toEqual(["one", "two", "three", "four"])
    expect(s.blocks.map((b) => b.lines.length)).toEqual([2, 2])
    expect(s.blocks.map((b) => b.explicit)).toEqual([true, true])
    expect(s.explicitBreaks).toBe(1)
    expect(s.derived).toBe(false)
  })

  it("several blank lines in a row are one break; leading and trailing blanks are ignored", () => {
    const s = parseLyricStructure("\n\na\nb\n\n\n\nc\nd\n\n")
    expect(s.blocks.map((b) => b.lines.map((l) => l.text))).toEqual([["a", "b"], ["c", "d"]])
    expect(s.explicitBreaks).toBe(1)
  })

  it("keeps indentation as steps, capped at three; a tab is four spaces", () => {
    expect(indentOf("verse")).toBe(0)
    expect(indentOf("  chorus")).toBe(1)
    expect(indentOf("    deeper")).toBe(2)
    expect(indentOf("\tdeeper")).toBe(2)
    expect(indentOf("                far")).toBe(3)
    const s = parseLyricStructure("a\n    b\nc")
    expect(s.lines).toEqual(["a", "b", "c"])
    expect(s.blocks[0]?.lines.map((l) => l.indent)).toEqual([0, 2, 0])
    expect(s.hasIndent).toBe(true)
  })

  it("keeps a repeat marker such as (2x) in the line and reads how many times", () => {
    expect(markerTimes("Bahe jái (2x)")).toBe(2)
    expect(markerTimes("Bahe jái [x3]")).toBe(3)
    expect(markerTimes("Bahe jái (4 x)")).toBe(4)
    expect(markerTimes("Bahe jái")).toBeNull()
    expect(markerTimes("Bahe jái (1x)")).toBeNull()
    const s = parseLyricStructure("a (2x)\nb")
    expect(s.lines).toEqual(["a (2x)", "b"])
    expect(s.blocks[0]?.lines[0]?.times).toBe(2)
    expect(s.hasMarkers).toBe(true)
  })

  it("a line that is only 'Refrain' or 'Chorus' labels the block after it and is not a lyric line", () => {
    const s = parseLyricStructure("verse one\nverse two\n\nRefrain:\nla la\nla la la\n\nverse three")
    expect(s.lines).toEqual(["verse one", "verse two", "la la", "la la la", "verse three"])
    expect(s.blocks.map((b) => b.label)).toEqual([null, "refrain", null])
    expect(s.blocks[1]?.labelText).toBe("Refrain")
    expect(parseLyricStructure("a\nb\n[Chorus]\nc\nd").blocks[1]?.labelText).toBe("Chorus")
  })

  it("a whole stanza that repeats earlier lines word for word is a refrain; the first stanza never is", () => {
    const s = parseLyricStructure("la la\nso so\n\nx\ny\n\nla la\nso so")
    expect(s.blocks.map((b) => b.label)).toEqual([null, null, "refrain"])
    expect(parseLyricStructure("a\na").blocks[0]?.label).toBeNull()
  })

  it("one run of text falls back to the catalogue's own split at | । ॥", () => {
    const s = parseLyricStructure("one line | another line | third line")
    expect(s.lines).toEqual(["one line", "another line", "third line"])
  })

  it("is empty for no text", () => {
    for (const text of [null, undefined, "", "   \n "]) {
      expect(parseLyricStructure(text)).toMatchObject({ lines: [], blocks: [], explicitBreaks: 0, derived: false })
    }
  })

  it("the transform (sentence case for the Roman text) applies to every line", () => {
    expect(parseLyricStructure("A B\nC D", (line) => line.toLowerCase()).lines).toEqual(["a b", "c d"])
  })

  it("counts, from the real catalogue: what the data stores and what is derived", () => {
    let withLyrics = 0
    let explicit = 0
    let markers = 0
    let indent = 0
    let withRepeat = 0
    let multi = 0
    for (const row of catalogue) {
      if (!row.lyrics_original?.trim()) continue
      withLyrics += 1
      const s = parseLyricStructure(row.lyrics_original)
      if (s.explicitBreaks > 0) explicit += 1
      if (s.hasMarkers) markers += 1
      if (s.hasIndent) indent += 1
      if (s.hasRepeats) withRepeat += 1
      if (s.blocks.length > 1) multi += 1
    }
    console.info(JSON.stringify({ songs: catalogue.length, withLyrics, explicit, markers, indent, withRepeat, multi }))
    // the stored text has no blank lines, markers or indentation anywhere: the structure the page shows is derived
    expect(explicit).toBe(0)
    expect(markers).toBe(0)
    expect(indent).toBe(0)
  })
})

const facts = (over: Partial<SongFacts> = {}): SongFacts => ({
  hasLyrics: true,
  hasMeaning: true,
  hasWords: false,
  hasChords: false,
  hasRecordings: true,
  hasVideo: false,
  hasStory: false,
  hasNotationPdf: false,
  align: { kind: "stacked", reason: "count-differs", lyricCount: 12, meaningCount: 18 },
  ...over,
})
const pairsFacts = { kind: "pairs", pairs: [{ line: "a", meaning: "b" }] } as const

describe("which sections the page has", () => {
  it("a bare song has Lyrics, Recordings and Chords, in that order, and no Commentary tab", () => {
    expect(visibleTabs(facts())).toEqual(["lyrics", "recordings", "chords"])
  })

  it("Recordings, Video and Story are there only when the song has them", () => {
    expect(visibleTabs(facts({ hasRecordings: false }))).toEqual(["lyrics", "chords"])
    expect(visibleTabs(facts({ hasVideo: true }))).toEqual(["lyrics", "recordings", "chords", "video"])
    expect(visibleTabs(facts({ hasStory: true }))).toEqual(["lyrics", "recordings", "chords", "story"])
    expect(visibleTabs(facts({ hasVideo: true, hasStory: true }))).toEqual(["lyrics", "recordings", "chords", "video", "story"])
  })

  it("Lyrics and Chords always keep their place, so they can say honestly that they are empty", () => {
    expect(visibleTabs(facts({ hasLyrics: false, hasMeaning: false, hasRecordings: false }))).toEqual(["lyrics", "chords"])
  })

  it("the Menu lists the same sections and Song information last, and nothing else", () => {
    expect(menuSections(facts())).toEqual(["lyrics", "recordings", "chords", "about"])
    expect(menuSections(facts({ hasVideo: true, hasStory: true }))).toEqual(["lyrics", "recordings", "chords", "video", "story", "about"])
    expect(menuSections(facts({ hasRecordings: false }))).not.toContain("recordings")
  })

  it("chords and words never change the section list (they have an honest empty state)", () => {
    expect(visibleTabs(facts({ hasChords: true, hasWords: true }))).toEqual(visibleTabs(facts()))
  })
})

describe("jumping and following the scroll", () => {
  const order = ["lyrics", "recordings", "chords"] as const
  const heights = { lyrics: 700, recordings: 300, chords: 500 }
  const start = 600 + STRIP_HEIGHT // hero + strip

  it("stacks the section tops from the heights above them", () => {
    expect(sectionTops(order, heights, start)).toEqual({ lyrics: 649, recordings: 1349, chords: 1649 })
  })

  it("a section not measured yet counts as 0 high", () => {
    expect(sectionTops(order, { lyrics: 100 }, 0)).toEqual({ lyrics: 0, recordings: 100, chords: 100 })
  })

  it("lands a jump just under the bar and the strip, never above the page", () => {
    expect(jumpOffset(1349, 64)).toBe(1349 - 64 - STRIP_HEIGHT + 1)
    expect(jumpOffset(10, 64)).toBe(0)
  })

  it("follows the scroll: the last section whose top is within reach of the strip", () => {
    const at = (y: number) => activeSectionAt(order, heights, start, y, 64)
    expect(at(0)).toBe("lyrics")
    expect(at(jumpOffset(1349, 64))).toBe("recordings")
    expect(at(jumpOffset(1649, 64) - 100)).toBe("recordings")
    expect(at(5000)).toBe("chords")
  })

  it("a jump lands on the section it asked for", () => {
    const tops = sectionTops(order, heights, start)
    for (const id of order) expect(activeSectionAt(order, heights, start, jumpOffset(tops[id] as number, 64), 64)).toBe(id)
  })

  it("stops at a section that has not been measured yet and has no active section without sections", () => {
    expect(activeSectionAt(order, { lyrics: 100 }, 0, 5000, 0)).toBe("lyrics")
    expect(activeSectionAt([], {}, 0, 0, 0)).toBeNull()
  })
})

describe("meaning source and honesty", () => {
  const base = { meaning: "", hindiMeaning: null, localizedMeanings: {}, themes: ["Song of Liberation"], lyrics: "E gán", title: "E gán" }

  it("English is official", () => {
    expect(meaningSourceFor(base, "en")).toBe("official")
  })

  it("a stored text in another language is reviewed; fetched ones are machine-assisted", () => {
    expect(meaningSourceFor({ ...base, hindiMeaning: "भाव" }, "hi")).toBe("reviewed")
    expect(meaningSourceFor({ ...base, localizedMeanings: { ru: "смысл" } }, "ru")).toBe("reviewed")
    expect(meaningSourceFor(base, "ru")).toBe("machine")
    expect(meaningSourceFor(base, "es")).toBe("machine")
  })

  it("keeps the line breaks of a stored text", () => {
    expect(storedMeaningRaw({ hindiMeaning: "a\nb", localizedMeanings: {} }, "hi")).toBe("a\nb")
    expect(storedMeaningRaw({ hindiMeaning: null, localizedMeanings: { es: " x " } }, "es")).toBe("x")
    expect(storedMeaningRaw({ hindiMeaning: null, localizedMeanings: {} }, "es")).toBeNull()
  })

  it("the stock sentence, the theme and the lyrics are not a meaning", () => {
    expect(officialEnglishMeaning({ ...base, meaning: "A song from the Prabhat Samgiita collection." })).toBeNull()
    expect(officialEnglishMeaning({ ...base, meaning: "Song of Liberation" })).toBeNull()
    expect(officialEnglishMeaning({ ...base, meaning: "E gán" })).toBeNull()
    expect(officialEnglishMeaning({ ...base, meaning: "" })).toBeNull()
    expect(officialEnglishMeaning({ ...base, meaning: "This song of mine is a fountain of effulgence." })).toBe(
      "This song of mine is a fountain of effulgence.",
    )
  })

  it("the catalogue's own english_meaning decides when it is known", () => {
    expect(officialEnglishMeaning({ ...base, meaning: "Song of Liberation" }, null)).toBeNull()
    expect(officialEnglishMeaning({ ...base, meaning: "x" }, "  real text ")).toBe("real text")
  })
})

describe("About this song: provable facts only", () => {
  it("reads day/month/year", () => {
    expect(parseCompositionDate("17/9/1982")).toEqual({ year: 1982, month: 9, day: 17 })
    expect(parseCompositionDate("1982")).toBeNull()
    expect(parseCompositionDate("31/13/1982")).toBeNull()
    expect(parseCompositionDate(undefined)).toBeNull()
  })

  it("lists what PS 2 has: words and music, date, theme, category, official recording, source", () => {
    const rows = aboutRows({
      metadata: { date: "17/9/1982", category: "K MUKTI GIITI", official_theme_label: "Song of Liberation", source: "official-lyrics-page" },
      recordings: [{ provider: "official" }],
    })
    expect(rows.map((r) => r.id)).toEqual(["words", "composed", "theme", "category", "recording", "source"])
    expect(rows[0]).toEqual({ id: "words", value: WORDS_AND_MUSIC })
    expect(rows[4]).toEqual({ id: "recording", kind: "official", count: 1 })
  })

  it("leaves out a row with no data, and never invents a performer, a duration or a place", () => {
    const rows = aboutRows({ metadata: null, recordings: [] })
    expect(rows).toEqual([{ id: "words", value: WORDS_AND_MUSIC }])
    expect(JSON.stringify(rows)).not.toMatch(/perform|5:00|duration|place/i)
  })

  it("gives the demo songs no recording row", () => {
    expect(aboutRows({ metadata: null, recordings: [{ provider: "official" }], demo: true }).some((r) => r.id === "recording")).toBe(false)
  })

  it("uses the catalogue theme when metadata has no official label", () => {
    expect(aboutRows({ metadata: {}, theme: "Devotion", recordings: [] }).find((r) => r.id === "theme")).toEqual({ id: "theme", value: "Devotion" })
  })
})

describe("song page strings", () => {
  const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",")
  const base = (k: string) => k.replace(/_(zero|one|two|few|many|other)$/, "")

  it("ru and es have every English key, with the same variables", () => {
    for (const [lang, dict] of [["ru", songPageRu], ["es", songPageEs]] as Array<[string, Readonly<Record<string, string>>]>) {
      for (const [key, value] of Object.entries(songPageEn) as Array<[string, string]>) {
        expect(dict[key], `${lang} ${key}`).toBeTypeOf("string")
        expect(vars(dict[key] as string), `${lang} ${key} variables`).toBe(vars(value))
      }
    }
  })

  it("Russian has the four plural forms for counted strings", () => {
    const counted = new Set(Object.keys(songPageEn).filter((k) => /_one$/.test(k)).map(base))
    for (const key of counted) {
      for (const form of ["one", "few", "many", "other"]) expect(songPageRu[`${key}_${form}`], `${key}_${form}`).toBeTypeOf("string")
    }
  })

  it("has a name for every tab of the strip and the menu, in every language", () => {
    for (const id of ["lyrics", "meaning", "recordings", "chords", "video", "story", "about"]) {
      for (const lang of ["en", "ru", "es"] as const) expect(translatePage(lang, `songPage.tab.${id}` as never)).toBeTruthy()
    }
  })

  it("fills variables", () => {
    expect(translatePage("en", "songPage.learn.added", { number: 2 })).toBe("PS 2 added to Learn")
    expect(translatePage("ru", "songPage.learn.added", { number: 2 })).toBe("PS 2 добавлена")
  })

  it("never writes Kiirtan with one i", () => {
    for (const dict of [songPageEn, songPageRu, songPageEs]) {
      expect(JSON.stringify(dict)).not.toMatch(/Kirtan/i)
    }
  })
})
