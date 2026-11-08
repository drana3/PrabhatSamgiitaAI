import { describe, expect, it } from "vitest"

import { BLOCK_TABS, blockIndexOf, blockTabAt, buildWordGrid, wordKey, wordLabel } from "@/lib/songPage/blockTabs"
import { splitWords } from "@/lib/songPage/chordChart"
import { parseLyricStructure } from "@/lib/songPage/lyricStructure"
import { menuSections, visibleTabs, type SongFacts } from "@/lib/songPage/pageSections"
import { translatePage } from "@/lib/songPage/pageCopy"
import { DEFAULT_SONG_PAGE_SETTINGS, normalizeSettings } from "@/lib/songPage/settings"
import { wordLanguagesOf } from "@/lib/songPage/wordLanguages"
import { songPageEn, songPageEs, songPageRu } from "@/locales/songPage"

const facts = (over: Partial<SongFacts> = {}): SongFacts => ({
  hasLyrics: true,
  hasMeaning: true,
  hasWords: false,
  hasChords: false,
  hasRecordings: true,
  hasVideo: false,
  hasStory: false,
  hasNotationPdf: false,
  align: { kind: "pairs", pairs: [{ line: "a", meaning: "b" }] },
  ...over,
})

describe("the text block: three pages, and no Commentary tab", () => {
  it("the pages are Lyrics, Translation and Word by word, in that order", () => {
    expect([...BLOCK_TABS]).toEqual(["lyrics", "translation", "words"])
    expect(BLOCK_TABS.map(blockIndexOf)).toEqual([0, 1, 2])
    expect([0, 1, 2].map(blockTabAt)).toEqual(["lyrics", "translation", "words"])
  })

  it("an index outside the pages (a spring that overshot) lands on the first or last page", () => {
    expect(blockTabAt(-1)).toBe("lyrics")
    expect(blockTabAt(2.6)).toBe("words")
    expect(blockTabAt(9)).toBe("words")
  })

  it("the strip and the menu have no Commentary; the menu ends with Song information", () => {
    expect(visibleTabs(facts())).toEqual(["lyrics", "recordings", "chords"])
    expect(menuSections(facts())).toEqual(["lyrics", "recordings", "chords", "about"])
    expect(visibleTabs(facts())).not.toContain("meaning" as never)
  })
})

describe("the word-by-word languages", () => {
  const glosses = (byLanguage: Record<string, Record<string, string>>) => ({ byLanguage })

  it("lists only the languages that have meanings, English, Russian and Spanish first", () => {
    expect(wordLanguagesOf(glosses({ es: { "0:0": "amigo" }, en: { "0:0": "friend" }, ru: { "0:0": "друг" } }))).toEqual(["en", "ru", "es"])
    expect(wordLanguagesOf(glosses({ ru: { "0:0": "друг" }, en: {}, es: {} }))).toEqual(["ru"])
  })

  it("a new language appears when the data has it, after the three", () => {
    expect(wordLanguagesOf(glosses({ hi: { "0:0": "मित्र" }, en: { "0:0": "friend" } }))).toEqual(["en", "hi"])
  })

  it("has none without word meanings", () => {
    expect(wordLanguagesOf(null)).toEqual([])
    expect(wordLanguagesOf(glosses({}))).toEqual([])
  })
})

describe("the word-by-word grid", () => {
  const text = ["Naviina práte ei aruń álote", "Rúper chande ele mor manete", "Tumi hásáte jáno, tumi kándáte jáno", "Naviina práte ei aruń álote", "Rúper chande ele mor manete"].join("\n")
  const grid = buildWordGrid(parseLyricStructure(text), splitWords)

  it("compares words by letters and accents, not by case or punctuation", () => {
    expect(wordKey("Jáno,")).toBe("jáno")
    expect(wordKey("JÁNO")).toBe(wordKey("jáno"))
    expect(wordKey("jano")).not.toBe(wordKey("jáno"))
    expect(wordKey("देव।")).toBe("देव")
  })

  it("draws a word without the marks at its ends, and keeps the letters", () => {
    expect(wordLabel("jáno,")).toBe("jáno")
    expect(wordLabel("“Tumi”")).toBe("Tumi")
    expect(wordLabel("!!!")).toBe("!!!")
  })

  it("counts every sung word, repeated lines included", () => {
    expect(grid.counts[wordKey("Naviina")]).toBe(2)
    expect(grid.counts[wordKey("jáno")]).toBe(2)
    expect(grid.counts[wordKey("tumi")]).toBe(2)
    expect(grid.total).toBe(5 + 5 + 6 + 5 + 5)
    expect(grid.distinct).toBe(Object.keys(grid.counts).length)
  })

  it("a line sung again is one mark, not its words again; the lines that are sung first are numbered", () => {
    expect(grid.lines.map((l) => l.kind)).toEqual(["words", "words", "words", "again", "again"])
    const numbers = grid.lines.flatMap((l) => (l.kind === "words" ? [l.number] : []))
    expect(numbers).toEqual([1, 2, 3])
  })

  it("every word keeps the line and word index the word meanings are looked up by", () => {
    const third = grid.lines[2]
    expect(third?.kind === "words" ? third.words.map((w) => [w.line, w.index]) : []).toEqual([[2, 0], [2, 1], [2, 2], [2, 3], [2, 4], [2, 5]])
  })

  it("an empty song has no lines", () => {
    expect(buildWordGrid(parseLyricStructure(""), splitWords).lines).toEqual([])
  })
})

describe("the reading settings kept on the device", () => {
  it("defaults: no translation under the lines, Official on the Translation page, medium text", () => {
    expect(DEFAULT_SONG_PAGE_SETTINGS.lineTranslation).toBe("off")
    expect(DEFAULT_SONG_PAGE_SETTINGS.translationKind).toBe("official")
    expect(DEFAULT_SONG_PAGE_SETTINGS.textSize).toBe(1)
  })

  it("keeps what the reader chose", () => {
    expect(normalizeSettings({ lineTranslation: "literal", translationKind: "poetic", wordLanguage: "ru", textSize: 2 })).toMatchObject({
      lineTranslation: "literal",
      translationKind: "poetic",
      wordLanguage: "ru",
      textSize: 2,
    })
    expect(normalizeSettings({ lineTranslation: "poetic" }).lineTranslation).toBe("poetic")
  })

  it("damaged or old values fall back to the defaults (Official is never a line setting)", () => {
    expect(normalizeSettings({ lineTranslation: "official" as never, translationKind: "machine" as never, textSize: 7 as never })).toMatchObject({
      lineTranslation: "off",
      translationKind: "official",
      textSize: 1,
    })
    // the old on/off switch is gone: a stored `translationOn` changes nothing
    expect(normalizeSettings({ translationOn: true } as never).lineTranslation).toBe("off")
  })
})

describe("song page strings", () => {
  const visible = (dict: Readonly<Record<string, string>>) => Object.entries(dict).filter(([key]) => !key.includes("a11y")).map(([, value]) => value)

  it("names the Translation page, its kinds and the Song information section in en, ru and es", () => {
    expect(translatePage("en", "songPage.block.translation")).toBe("Translation")
    expect(translatePage("ru", "songPage.block.translation")).toBe("Перевод")
    expect(translatePage("es", "songPage.block.translation")).toBe("Traducción")
    expect(translatePage("en", "songPage.translation.official")).toBe("Official")
    expect(translatePage("en", "songPage.tab.about")).toBe("Song information")
    expect(translatePage("en", "songPage.translation.commentary")).toBe("Commentary")
  })

  it("has every new Translation string in all three languages", () => {
    const keys = Object.keys(songPageEn).filter((key) => key.startsWith("songPage.translation.") || key === "songPage.block.translation" || key === "songPage.words.language" || key === "songPage.options.translation.off" || key === "songPage.lyrics.underline.whole")
    expect(keys.length).toBeGreaterThanOrEqual(12)
    for (const lang of ["en", "ru", "es"] as const) for (const key of keys) expect(translatePage(lang, key as never), `${lang}:${key}`).not.toBe(key)
  })

  it("leaves no visible \"Meaning\" (or Смысл, Significado) in the song page strings", () => {
    expect(visible(songPageEn).filter((v) => /\bmeaning\b(?! of)/i.test(v) && !/word meanings?/i.test(v))).toEqual([])
    expect(visible(songPageRu).filter((v) => /смысл/i.test(v))).toEqual([])
    expect(visible(songPageEs).filter((v) => /significado/i.test(v) && !/significados? de (las )?palabras/i.test(v))).toEqual([])
  })

  it("has the empty states and the word-grid lines in all three languages", () => {
    for (const lang of ["en", "ru", "es"] as const) {
      for (const key of ["songPage.commentary.plain", "songPage.words.none", "songPage.words.tap", "songPage.options.button", "songPage.block.a11y"] as const) {
        expect(translatePage(lang, key)).not.toBe(key)
      }
      expect(translatePage(lang, "songPage.words.times", { count: 3 })).toContain("3×")
    }
    expect(translatePage("en", "songPage.words.none")).toBe("No word meanings yet.")
  })
})
