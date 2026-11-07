import { describe, expect, it } from "vitest"

import { alignLines } from "@/lib/songPage/alignLines"
import { parseLyricStructure } from "@/lib/songPage/lyricStructure"
import {
  PIN_GRACE_MS,
  PIN_RELEASE_PX,
  SCROLL_MODE,
  READING_LINE,
  lyricsInView,
  readingLine,
  reduceReading,
  shownStanza,
  splitTranslation,
  stanzaAtLine,
  stanzaNumbers,
  stripSettle,
  stripVisible,
  translationParagraphs,
} from "@/lib/songPage/readingStrip"
import { songPageEn, songPageEs, songPageRu } from "@/locales/songPage"
import { DEFAULT_SONG_PAGE_SETTINGS, normalizeSettings } from "@/lib/songPage/settings"

// PS 1903 as the catalogue stores it: flat lines, the first line returns, the last stanza is only the refrain again
const LYRICS_1903 = [
  "Álor rather sárathii mor",
  "Tákáo náko kao ná kathá",
  "Kár páne chút́e",
  "Calecho pralep dite káhár vyathá",
  "Álor rather sárathii mor",
  "Tákáo náko kao ná kathá",
  "Andhakáre randhra bhedi rath chút́e jáy niravadhi",
  "Saptáshvera sátat́i raḿge kśure bheḿge upalatá",
  "Álor rather sárathii mor",
  "Tákáo náko kao ná kathá",
  "Nisháná sabári ekai sárathii keo áro áche kii",
  "Path ke ceno rath ke jáno tomár parei nirbhartá",
  "Álor rather sárathii mor",
  "Tákáo náko kao ná kathá",
].join("\n")

// the real English text of PS 1903: short wrapped lines, no blank lines
const FLAT_1903 =
  "O charioteer of light!\nDo not just watch, speak too!\nTowards whom, do You continue rushing?\nOn whose wounds, do You apply ointment?\nPiercing through gaps of darkness,\nYour chariot rushes on without pause.\nThe seven horses, clad in seven colours;\nwith their horseshoes,\ntrample underfoot all stones.\nAll have the same destination.\nThere cannot be any other charioteer.\nYou recognise the path.\nYou know the chariot.\nHence, everyone depends upon You."

const structure = parseLyricStructure(LYRICS_1903)
const blocks = structure.blocks

describe("the structure the strip splits against", () => {
  it("PS 1903 has four stanzas, the last one a refrain", () => {
    expect(blocks).toHaveLength(4)
    expect(blocks.map((b) => b.label)).toEqual([null, null, null, "refrain"])
    expect(stanzaNumbers(blocks)).toEqual([1, 2, 3, null])
  })
})

describe("splitTranslation: by stanza only when that is honest", () => {
  it("the real flat translation (no blank lines, wrapped lines) is shown whole, as one paragraph", () => {
    const split = splitTranslation({ blocks, raw: FLAT_1903, pairs: null })
    expect(split.kind).toBe("whole")
    if (split.kind === "whole") {
      expect(split.paragraphs).toHaveLength(1)
      expect(split.paragraphs[0]).toContain("O charioteer of light! Do not just watch")
      expect(split.paragraphs[0]).not.toContain("\n")
    }
  })

  it("no text, or only blanks: none (no strip, no placeholder)", () => {
    expect(splitTranslation({ blocks, raw: null, pairs: null }).kind).toBe("none")
    expect(splitTranslation({ blocks, raw: "  \n\n ", pairs: null }).kind).toBe("none")
    expect(splitTranslation({ blocks, raw: "", pairs: null }).kind).toBe("none")
  })

  it("as many blank-line paragraphs as stanzas: one for one, each paragraph exactly as stored", () => {
    const raw = ["one\nstill one", "two", "three", "four"].join("\n\n")
    const split = splitTranslation({ blocks, raw, pairs: null })
    expect(split.kind).toBe("stanzas")
    if (split.kind === "stanzas") {
      expect(split.items.map((i) => i.text)).toEqual(["one still one", "two", "three", "four"])
      expect(split.items.map((i) => i.chorus)).toEqual([false, false, false, true])
      expect(split.items.every((i) => !i.ofFirstTime)).toBe(true)
    }
  })

  it("one paragraph fewer than stanzas, with a refrain: the refrain shows the translation of the first time, once", () => {
    const raw = ["first", "second", "third"].join("\n\n")
    const split = splitTranslation({ blocks, raw, pairs: null })
    expect(split.kind).toBe("stanzas")
    if (split.kind === "stanzas") {
      expect(split.items.map((i) => i.text)).toEqual(["first", "second", "third", "first"])
      expect(split.items[3]).toMatchObject({ chorus: true, ofFirstTime: true })
      expect(split.items[0]).toMatchObject({ chorus: false, ofFirstTime: false })
    }
  })

  it("any other number of paragraphs is not guessed: whole, nothing cut or merged", () => {
    const two = splitTranslation({ blocks, raw: "a\n\nb", pairs: null })
    expect(two.kind).toBe("whole")
    if (two.kind === "whole") expect(two.paragraphs).toEqual(["a", "b"])
    expect(splitTranslation({ blocks, raw: "a\n\nb\n\nc\n\nd\n\ne", pairs: null }).kind).toBe("whole")
  })

  it("a song with one stanza has nothing to follow: whole", () => {
    const one = parseLyricStructure("Line one\nLine two\nLine three")
    expect(one.blocks).toHaveLength(1)
    expect(splitTranslation({ blocks: one.blocks, raw: "Para one\n\nPara two", pairs: null }).kind).toBe("whole")
  })

  it("a refrain whose first sung place has no paragraph of its own is not guessed: whole", () => {
    // a refrain block that repeats nothing the text can point to
    const odd = [
      { lines: [{ index: 0, repeatOf: null }], label: null },
      { lines: [{ index: 1, repeatOf: null }], label: "refrain" as const },
      { lines: [{ index: 2, repeatOf: null }], label: null },
    ]
    expect(splitTranslation({ blocks: odd, raw: "a\n\nb", pairs: null }).kind).toBe("whole")
  })

  it("line-by-line pairs (the page's own alignLines) give each stanza its own lines", () => {
    const lyrics = ["L1", "L2", "L3", "L4"]
    const two = [
      { lines: [{ index: 0, repeatOf: null }, { index: 1, repeatOf: null }], label: null },
      { lines: [{ index: 2, repeatOf: null }, { index: 3, repeatOf: null }], label: null },
    ]
    const text = "First line.\nSecond line.\nThird line.\nFourth line."
    const aligned = alignLines(lyrics, text)
    expect(aligned.kind).toBe("pairs")
    const split = splitTranslation({ blocks: two, raw: text, pairs: aligned.kind === "pairs" ? aligned.pairs : null })
    expect(split.kind).toBe("stanzas")
    if (split.kind === "stanzas") expect(split.items.map((i) => i.text)).toEqual(["First line. Second line.", "Third line. Fourth line."])
  })

  it("translationParagraphs: soft breaks become spaces, blank lines separate, spaces on blank lines count as blank", () => {
    expect(translationParagraphs("a\nb\n \t\nc\r\n\r\nd")).toEqual(["a b", "c", "d"])
    expect(translationParagraphs(undefined)).toEqual([])
  })
})

describe("which stanza is in the middle of the screen", () => {
  const spans = [
    { top: 0, height: 200 },
    { top: 216, height: 150 },
    { top: 382, height: 300 },
  ]
  it("the stanza that holds the reading line", () => {
    expect(stanzaAtLine(spans, 100)).toBe(0)
    expect(stanzaAtLine(spans, 250)).toBe(1)
    expect(stanzaAtLine(spans, 500)).toBe(2)
  })
  it("in a gap or beyond the lyrics: the nearest stanza, never nothing", () => {
    expect(stanzaAtLine(spans, 205)).toBe(0)
    expect(stanzaAtLine(spans, 212)).toBe(1)
    expect(stanzaAtLine(spans, -400)).toBe(0)
    expect(stanzaAtLine(spans, 9000)).toBe(2)
  })
  it("no stanzas: -1", () => {
    expect(stanzaAtLine([], 10)).toBe(-1)
  })
  it("the reading line sits a bit above the middle of what the bars leave", () => {
    expect(readingLine(100, 700)).toBeCloseTo(100 + 600 * READING_LINE, 5)
    expect(readingLine(100, 700)).toBeLessThan(400)
    expect(readingLine(300, 100)).toBe(300)
  })
  it("scrolling the lyrics up moves the stanza under the line from first to last", () => {
    const line = readingLine(100, 700)
    const at = (scrollY: number) => stanzaAtLine(spans.map((s) => ({ top: 400 + s.top - scrollY, height: s.height })), line)
    expect([at(0), at(300), at(500), at(900)]).toEqual([0, 1, 2, 2])
  })
})

describe("Scroll mode and Tap override", () => {
  const t0 = 10_000
  it("a tap pins the strip to the stanza; a tap on the pinned stanza goes back to Scroll mode", () => {
    const pinned = reduceReading(SCROLL_MODE, { type: "tap", index: 2, y: 500, now: t0 })
    expect(pinned).toMatchObject({ mode: "tap", pinned: 2 })
    expect(reduceReading(pinned, { type: "tap", index: 2, y: 500, now: t0 + 50 })).toEqual(SCROLL_MODE)
  })
  it("a tap on another stanza moves the pin", () => {
    const pinned = reduceReading(SCROLL_MODE, { type: "tap", index: 1, y: 100, now: t0 })
    expect(reduceReading(pinned, { type: "tap", index: 3, y: 120, now: t0 + 900 })).toMatchObject({ mode: "tap", pinned: 3 })
  })
  it("scrolling right after the tap, or only a little, keeps the pin", () => {
    const pinned = reduceReading(SCROLL_MODE, { type: "tap", index: 1, y: 100, now: t0 })
    expect(reduceReading(pinned, { type: "scroll", y: 100 + PIN_RELEASE_PX + 400, now: t0 + PIN_GRACE_MS - 1 })).toBe(pinned)
    expect(reduceReading(pinned, { type: "scroll", y: 100 + PIN_RELEASE_PX - 1, now: t0 + PIN_GRACE_MS + 5000 })).toBe(pinned)
  })
  it("scrolling on, after the short pause, lets the strip follow again (either direction)", () => {
    const pinned = reduceReading(SCROLL_MODE, { type: "tap", index: 1, y: 400, now: t0 })
    expect(reduceReading(pinned, { type: "scroll", y: 400 + PIN_RELEASE_PX, now: t0 + PIN_GRACE_MS })).toEqual(SCROLL_MODE)
    expect(reduceReading(pinned, { type: "scroll", y: 400 - PIN_RELEASE_PX, now: t0 + PIN_GRACE_MS })).toEqual(SCROLL_MODE)
  })
  it("Scroll mode stays Scroll mode on scroll", () => {
    expect(reduceReading(SCROLL_MODE, { type: "scroll", y: 900, now: t0 })).toBe(SCROLL_MODE)
  })
  it("the strip shows the pinned stanza, else the one under the eye, always inside the list", () => {
    const pinned = reduceReading(SCROLL_MODE, { type: "tap", index: 3, y: 0, now: t0 })
    expect(shownStanza(pinned, 0, 4)).toBe(3)
    expect(shownStanza(SCROLL_MODE, 2, 4)).toBe(2)
    expect(shownStanza(pinned, 0, 2)).toBe(1)
    expect(shownStanza(SCROLL_MODE, -1, 4)).toBe(0)
    expect(shownStanza(SCROLL_MODE, 0, 0)).toBe(-1)
  })
})

describe("when the strip is there", () => {
  const on = { tab: "lyrics" as const, split: "stanzas" as const, translationOn: true, inView: true, sheetOpen: false }
  it("only on the Lyrics tab, with a translation, switched on, lyrics on screen, no sheet open", () => {
    expect(stripVisible(on)).toBe(true)
    expect(stripVisible({ ...on, split: "whole" })).toBe(true)
    expect(stripVisible({ ...on, tab: "commentary" })).toBe(false)
    expect(stripVisible({ ...on, tab: "words" })).toBe(false)
    expect(stripVisible({ ...on, split: "none" })).toBe(false)
    expect(stripVisible({ ...on, translationOn: false })).toBe(false)
    expect(stripVisible({ ...on, inView: false })).toBe(false)
    expect(stripVisible({ ...on, sheetOpen: true })).toBe(false)
  })
  it("the lyrics are in view when a real part of them is between the bars; a sliver at an edge does not count", () => {
    const view = { visibleTop: 100, visibleBottom: 700 }
    expect(lyricsInView({ top: 200, bottom: 900, ...view })).toBe(true)
    expect(lyricsInView({ top: -500, bottom: 400, ...view })).toBe(true)
    expect(lyricsInView({ top: 690, bottom: 1500, ...view })).toBe(false)
    expect(lyricsInView({ top: -900, bottom: 130, ...view })).toBe(false)
    expect(lyricsInView({ top: 0, bottom: 0, ...view })).toBe(false)
  })
})

describe("the strip's drag: where it settles", () => {
  it("a slow release settles on the nearer state", () => {
    expect(stripSettle(110, 0, 100, 300).expanded).toBe(false)
    expect(stripSettle(250, 0, 100, 300).expanded).toBe(true)
  })
  it("a throw up opens it even from low, a throw down closes it even from high (projection, not distance)", () => {
    expect(stripSettle(120, -1500, 100, 300)).toEqual({ expanded: true, fling: true })
    expect(stripSettle(280, 1500, 100, 300)).toEqual({ expanded: false, fling: true })
  })
  it("a plain release does not overshoot (no fling), a hard throw may", () => {
    expect(stripSettle(250, -200, 100, 300).fling).toBe(false)
    expect(stripSettle(250, -700, 100, 300).fling).toBe(true)
  })
})

describe("the choice is kept on the device, and the words exist in every language", () => {
  it("compact by default; a stored choice survives, junk does not", () => {
    expect(DEFAULT_SONG_PAGE_SETTINGS.stripExpanded).toBe(false)
    expect(normalizeSettings({ stripExpanded: true }).stripExpanded).toBe(true)
    expect(normalizeSettings({ stripExpanded: "yes" as never }).stripExpanded).toBe(false)
    expect(normalizeSettings(undefined).stripExpanded).toBe(false)
  })
  it("the strip's strings exist in en, ru and es; the whole-song note is the neutral one", () => {
    const keys = Object.keys(songPageEn).filter((k) => k.startsWith("songPage.read."))
    expect(keys.length).toBeGreaterThan(5)
    for (const key of keys) {
      expect(songPageRu).toHaveProperty([key])
      expect(songPageEs).toHaveProperty([key])
    }
    expect(songPageEn["songPage.lyrics.expand.note"]).toBe("Translation is shown for the whole song.")
    expect(songPageEn["songPage.read.whole"]).toBe("Translation of the whole song")
  })
})
