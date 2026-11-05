import { describe, expect, it } from "vitest"

import {
  CARD_FORMATS,
  CARD_PHOTO_OPTIONS,
  CARD_SCRIM_MIN_UNDER_TEXT,
  CARD_WIDTH,
  cardActions,
  cardEyebrow,
  cardFileName,
  cardLayout,
  cardPhotoSeed,
  cardScrimStops,
  cardSize,
  cardSubline,
  cardTextFrom,
  cardTitle,
  cardTitleSize,
  cardUrlLine,
  displayUrl,
  scrimAlphaAt,
  type CardSubject,
} from "@/lib/share/card"
import { pickFromList } from "@/lib/photos/pick"
import { STOCK_PHOTO_META } from "@/lib/photos/photoData"

const song: CardSubject = { kind: "song", number: 123, title: "Prabhu Tumi", performer: "Dada Maetreya" }
const kiirtan: CardSubject = { kind: "kiirtan", id: "k-77", title: "Baba Nam Kevalam", author: "Sunil Nath", recordingKind: "kiirtan" }

describe("share card: formats", () => {
  it("both formats are 1080 wide: portrait 1080x1350, square 1080x1080", () => {
    expect(CARD_FORMATS.map((f) => f.width)).toEqual([CARD_WIDTH, CARD_WIDTH])
    expect(cardSize("portrait")).toEqual({ width: 1080, height: 1350 })
    expect(cardSize("square")).toEqual({ width: 1080, height: 1080 })
  })
})

describe("share card: texts", () => {
  it("a song reads `PS 123`", () => {
    expect(cardEyebrow(song)).toBe("PS 123")
  })

  it("a Kiirtan reads `Kiirtan · Artist`, a Bhajan `Bhajan · Artist`", () => {
    expect(cardEyebrow(kiirtan)).toBe("Kiirtan · Sunil Nath")
    expect(cardEyebrow({ ...kiirtan, recordingKind: "bhajan" })).toBe("Bhajan · Sunil Nath")
  })

  it("a Kiirtan without a known artist is just `Kiirtan`, never `Kiirtan · `", () => {
    expect(cardEyebrow({ ...kiirtan, author: "" })).toBe("Kiirtan")
    expect(cardEyebrow({ ...kiirtan, author: null })).toBe("Kiirtan")
    expect(cardEyebrow({ ...kiirtan, author: " Prabhat Samgiita " })).toBe("Kiirtan")
  })

  it("the title is trimmed and has a fallback", () => {
    expect(cardTitle({ ...song, title: "  Prabhu Tumi " })).toBe("Prabhu Tumi")
    expect(cardTitle({ ...song, title: "" })).toBe("Prabhat Samgiita 123")
    expect(cardTitle({ ...kiirtan, title: " " })).toBe("Kiirtan")
  })

  it("a song shows its performer under the title; a generic one is left out; a Kiirtan has no subline", () => {
    expect(cardSubline(song)).toBe("Dada Maetreya")
    expect(cardSubline({ ...song, performer: "Prabhat Samgiita Collection" })).toBeNull()
    expect(cardSubline({ ...song, performer: null })).toBeNull()
    expect(cardSubline(kiirtan)).toBeNull()
  })
})

describe("share card: link line", () => {
  it("drops the protocol, the query and the trailing slash", () => {
    expect(displayUrl("https://www.prabhatasamgiita.org/songs/3?open=app")).toBe("www.prabhatasamgiita.org/songs/3")
    expect(displayUrl("https://example.org/")).toBe("example.org")
    expect(displayUrl("http://example.org/a/#top")).toBe("example.org/a")
  })

  it("a song prints its page, a Kiirtan the website only (it has no page yet)", () => {
    expect(cardUrlLine(song, "https://www.prabhatasamgiita.org")).toBe("www.prabhatasamgiita.org/songs/123")
    expect(cardUrlLine(kiirtan, "https://www.prabhatasamgiita.org/")).toBe("www.prabhatasamgiita.org")
  })
})

describe("share card: photo rules", () => {
  it("the song seed is the hero seed of the song page", () => {
    expect(cardPhotoSeed(song)).toBe("ps-123")
  })

  it("a Kiirtan uses its id", () => {
    expect(cardPhotoSeed(kiirtan)).toBe("k-77")
  })

  it("never opts into people", () => {
    expect(CARD_PHOTO_OPTIONS.allowPeople).not.toBe(true)
    expect(CARD_PHOTO_OPTIONS.size).toBe("large")
  })

  it("no seed picks a close, children or low-resolution photo", () => {
    const seeds = [...Array.from({ length: 400 }, (_, i) => `ps-${i + 1}`), ...Array.from({ length: 200 }, (_, i) => `k-${i}`)]
    for (const seed of seeds) {
      for (const mood of [undefined, "night", "morning", "long"] as const) {
        const photo = pickFromList(STOCK_PHOTO_META, seed, mood, CARD_PHOTO_OPTIONS)
        expect(photo).toBeDefined()
        expect(["none", "far"]).toContain(photo?.people ?? "none")
        expect(photo?.lowRes).not.toBe(true)
      }
    }
  })

  it("the same song always gets the same photo", () => {
    const a = pickFromList(STOCK_PHOTO_META, cardPhotoSeed(song), undefined, CARD_PHOTO_OPTIONS)
    const b = pickFromList(STOCK_PHOTO_META, cardPhotoSeed({ ...song, title: "Other" }), undefined, CARD_PHOTO_OPTIONS)
    expect(a?.n).toBe(b?.n)
  })
})

describe("share card: layout", () => {
  it("the title is big when short and smaller as it grows, never under 48 px", () => {
    const sizes = ["Om", "Prabhu Tumi", "Baba Nam Kevalam Hari", "A fairly long title of a song here", "x".repeat(50), "y".repeat(120)].map((t) => cardTitleSize(t, "portrait"))
    for (let i = 1; i < sizes.length; i++) expect(sizes[i]).toBeLessThanOrEqual(sizes[i - 1])
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(48)
    expect(sizes[0]).toBeGreaterThanOrEqual(cardLayout("portrait").eyebrowSize * 4)
  })

  it("the square card sets the title a little smaller", () => {
    expect(cardTitleSize("Prabhu Tumi", "square")).toBeLessThan(cardTitleSize("Prabhu Tumi", "portrait"))
  })

  it("the text block fits: a three-line title, subline, eyebrow and link inside the space below textFrom", () => {
    for (const format of ["portrait", "square"] as const) {
      const { height } = cardSize(format)
      const l = cardLayout(format)
      const size = cardTitleSize("x".repeat(56), format)
      const lines = 3
      const block = l.eyebrowSize + l.gap + lines * size + l.gap + l.sublineSize + l.gap + l.urlSize
      expect(block + l.padding).toBeLessThanOrEqual(height * (1 - cardTextFrom(format)) + 120)
    }
  })
})

describe("share card: bottom scrim", () => {
  it("is clear above scrimFrom and never below the text minimum from the text block down", () => {
    for (const format of ["portrait", "square"] as const) {
      const stops = cardScrimStops(format)
      expect(scrimAlphaAt(cardLayout(format).scrimFrom, stops)).toBe(0)
      for (let p = cardTextFrom(format); p <= 1; p += 0.02) {
        expect(scrimAlphaAt(p, stops)).toBeGreaterThanOrEqual(CARD_SCRIM_MIN_UNDER_TEXT - 1e-9)
      }
    }
  })

  it("white text on a white pixel under the minimum scrim keeps 4.5:1", () => {
    const gray = Math.round(255 * (1 - CARD_SCRIM_MIN_UNDER_TEXT))
    const lin = (c: number) => {
      const s = c / 255
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    }
    const lum = 0.2126 * lin(gray) + 0.7152 * lin(gray) + 0.0722 * lin(gray)
    expect(1.05 / (lum + 0.05)).toBeGreaterThanOrEqual(4.5)
  })

  it("stops are in order", () => {
    for (const format of ["portrait", "square"] as const) {
      const stops = cardScrimStops(format)
      for (let i = 1; i < stops.length; i++) expect(stops[i].at).toBeGreaterThanOrEqual(stops[i - 1].at)
    }
  })

  it("interpolates linearly and clamps outside 0..1", () => {
    const stops = [
      { at: 0, alpha: 0 },
      { at: 1, alpha: 1 },
    ]
    expect(scrimAlphaAt(0.25, stops)).toBeCloseTo(0.25)
    expect(scrimAlphaAt(-1, stops)).toBe(0)
    expect(scrimAlphaAt(2, stops)).toBe(1)
    expect(scrimAlphaAt(0.5, [])).toBe(0)
  })
})

describe("share card: file names and actions", () => {
  it("names the file after the song and the format", () => {
    expect(cardFileName(song, "portrait")).toBe("prabhat-samgiita-ps-123-portrait.png")
    expect(cardFileName(song, "square")).toBe("prabhat-samgiita-ps-123-square.png")
  })

  it("names a Kiirtan file after its title, folded to plain letters", () => {
    expect(cardFileName({ ...kiirtan, title: "Bábá Nám Kevalam!" }, "square")).toBe("prabhat-samgiita-kiirtan-baba-nam-kevalam-square.png")
    expect(cardFileName({ ...kiirtan, title: "Бог", recordingKind: "bhajan" }, "square")).toBe("prabhat-samgiita-bhajan-k-77-square.png")
  })

  it("a long title does not make a long file name", () => {
    expect(cardFileName({ ...kiirtan, title: "word ".repeat(40) }, "portrait").length).toBeLessThan(80)
  })

  it("native shares the file; the web saves it, and shares it too where the browser can", () => {
    expect(cardActions({ native: true, canShareFile: false })).toEqual(["share", "copy"])
    expect(cardActions({ native: false, canShareFile: false })).toEqual(["save", "copy"])
    expect(cardActions({ native: false, canShareFile: true })).toEqual(["share", "save", "copy"])
  })
})
