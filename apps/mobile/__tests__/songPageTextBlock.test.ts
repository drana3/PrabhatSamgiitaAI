import { describe, expect, it } from "vitest"

import {
  anchorOf,
  blockTabAfterJump,
  buildWordGrid,
  scrollSections,
  stripActive,
  wordKey,
  wordLabel,
} from "@/lib/songPage/blockTabs"
import { splitWords } from "@/lib/songPage/chordChart"
import { parseLyricStructure } from "@/lib/songPage/lyricStructure"
import { lyricsLayout, menuSections, sectionTops, visibleTabs, type SongFacts } from "@/lib/songPage/pageSections"
import { translatePage } from "@/lib/songPage/pageCopy"
import { DEFAULT_SONG_PAGE_SETTINGS, normalizeSettings } from "@/lib/songPage/settings"
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

describe("the text block: Commentary is a tab of the Lyrics block, not a place of its own", () => {
  it("the strip and the menu still list Commentary (id meaning), the scroll has no place for it", () => {
    expect(visibleTabs(facts())).toEqual(["lyrics", "meaning", "recordings", "chords"])
    expect(menuSections(facts())).toEqual(["lyrics", "meaning", "recordings", "chords", "about"])
    expect(scrollSections(menuSections(facts()))).toEqual(["lyrics", "recordings", "chords", "about"])
  })

  it("a jump to Commentary lands on the top of the text block", () => {
    expect(anchorOf("meaning")).toBe("lyrics")
    expect(anchorOf("chords")).toBe("chords")
    const tops = sectionTops(scrollSections(menuSections(facts())), { lyrics: 500, recordings: 200, chords: 300 }, 400)
    expect(tops[anchorOf("meaning")]).toBe(400)
    expect(tops[anchorOf("recordings")]).toBe(900)
  })

  it("Commentary opens its tab; Lyrics leaves Word by word as it is; other sections leave the tab alone", () => {
    expect(blockTabAfterJump("meaning", "lyrics")).toBe("commentary")
    expect(blockTabAfterJump("meaning", "words")).toBe("commentary")
    expect(blockTabAfterJump("lyrics", "commentary")).toBe("lyrics")
    expect(blockTabAfterJump("lyrics", "words")).toBe("words")
    expect(blockTabAfterJump("chords", "commentary")).toBe("commentary")
  })

  it("the strip lights Commentary only while the block is in view on its Commentary tab", () => {
    expect(stripActive("lyrics", "commentary")).toBe("meaning")
    expect(stripActive("lyrics", "lyrics")).toBe("lyrics")
    expect(stripActive("lyrics", "words")).toBe("lyrics")
    expect(stripActive("chords", "commentary")).toBe("chords")
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

describe("the translation switch of the text options", () => {
  it("off, the lyrics stand alone; on, the layout is the one the data allows", () => {
    expect(lyricsLayout(facts()).kind).toBe("pairs")
    expect(lyricsLayout(facts(), true).kind).toBe("pairs")
    expect(lyricsLayout(facts(), false).kind).toBe("plain")
    expect(lyricsLayout(facts({ hasLyrics: false }), false).kind).toBe("empty")
  })

  it("is kept with the settings: on and medium by default, damaged values fall back", () => {
    expect(DEFAULT_SONG_PAGE_SETTINGS.translationOn).toBe(true)
    expect(DEFAULT_SONG_PAGE_SETTINGS.textSize).toBe(1)
    expect(normalizeSettings({ translationOn: false, textSize: 2 })).toMatchObject({ translationOn: false, textSize: 2 })
    expect(normalizeSettings({ translationOn: "no" as never, textSize: 7 as never })).toMatchObject({ translationOn: true, textSize: 1 })
    expect(normalizeSettings({ textSize: 0 }).textSize).toBe(0)
  })
})

describe("Meaning is Commentary wherever the reader sees it", () => {
  const visible = (dict: Readonly<Record<string, string>>) => Object.entries(dict).filter(([key]) => !key.includes("a11y")).map(([, value]) => value)

  it("names the tab, the menu row and the header in en, ru and es", () => {
    expect(translatePage("en", "songPage.tab.meaning")).toBe("Commentary")
    expect(translatePage("ru", "songPage.tab.meaning")).toBe("Комментарий")
    expect(translatePage("es", "songPage.tab.meaning")).toBe("Comentario")
    expect(translatePage("en", "songPage.meaning.in", { language: "Russian" })).toBe("Commentary in Russian")
    expect(translatePage("ru", "songPage.meaning.in", { language: "Русский" })).toBe("Комментарий на языке: Русский")
    expect(translatePage("es", "songPage.meaning.in", { language: "Ruso" })).toBe("Comentario en Ruso")
  })

  it("leaves no visible \"Meaning\" (or Смысл, Significado) in the song page strings", () => {
    expect(visible(songPageEn).filter((v) => /\bmeaning\b(?! of)/i.test(v) && !/word meanings?/i.test(v))).toEqual([])
    expect(visible(songPageRu).filter((v) => /смысл/i.test(v))).toEqual([])
    expect(visible(songPageEs).filter((v) => /significado/i.test(v) && !/significados? de (las )?palabras/i.test(v))).toEqual([])
  })

  it("has the empty states and the word-grid lines in all three languages", () => {
    for (const lang of ["en", "ru", "es"] as const) {
      for (const key of ["songPage.commentary.empty", "songPage.commentary.plain.none", "songPage.words.none", "songPage.words.tap", "songPage.options.button", "songPage.block.a11y"] as const) {
        expect(translatePage(lang, key)).not.toBe(key)
      }
      expect(translatePage(lang, "songPage.words.times", { count: 3 })).toContain("3×")
    }
    expect(translatePage("en", "songPage.words.none")).toBe("No word meanings yet.")
  })
})
