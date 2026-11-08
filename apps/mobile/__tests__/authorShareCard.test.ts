import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, it, vi } from "vitest"

import { DEMO_AUTHORS } from "@/lib/fixtures/authors"

vi.mock("@/lib/fixtures/authorsGate", () => ({ sampleAuthors: () => DEMO_AUTHORS }))

import { SHOW_PAGE_LINK, authorShareKey } from "@/lib/authors/constants"
import { createDemoApi } from "@/lib/authors/demo"
import { createAuthorsApi } from "@/lib/authors/remote"
import { authorCardSubject, authorLinkOf, type SharedPage } from "@/lib/authors/shareCard"
import { STOCK_PHOTO_META } from "@/lib/photos/photoData"
import { authorCardPhoto as webAuthorCardPhoto } from "../../web/lib/author-card"
import {
  AUTHOR_CARD_PHOTOS,
  AUTHOR_GOLD,
  AUTHOR_IVORY,
  AUTHOR_PLACEHOLDERS,
  CARD_SCRIM_MIN_UNDER_TEXT,
  authorBlockHeight,
  authorCardLayout,
  authorCardPhotoN,
  authorInitials,
  authorNameSize,
  authorScrimStops,
  authorTextFrom,
  cardFileName,
  cardFormatsFor,
  cardEyebrow,
  cardSize,
  cardSubline,
  cardTitle,
  cardUrlLine,
  scrimAlphaAt,
  type CardFormat,
  type CardSubject,
} from "@/lib/share/card"

const ID = "0b5c6f0a-3c0e-4a5f-9d53-1f1f4c1d9a10"
const page: SharedPage = { id: ID, slug: "sunil-nath", display_name: "Sunil Nath", author_type: "solo", city: "Warsaw", country: "Poland", kinds: [{ kind: "kiirtan", count: 4 }, { kind: "bhajan", count: 1 }], photo_url: null }
const author = authorCardSubject(page, null)
const song: CardSubject = { kind: "song", number: 7, title: "Prabhu Tumi" }
const FORMATS: CardFormat[] = ["portrait", "square", "story"]

function channel(hex: string, i: number): number {
  const v = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}
function luminance(hex: string): number {
  return 0.2126 * channel(hex, 0) + 0.7152 * channel(hex, 1) + 0.0722 * channel(hex, 2)
}
function contrast(a: number, b: number): number {
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}
/** luminance of a hex colour under `alpha` black, over a white pixel (the worst case a photo can give) */
function underScrim(alpha: number): number {
  const white = 1 - alpha
  const v = white // sRGB value of the pixel, 0..1
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}

describe("author card: shapes", () => {
  it("an author page offers portrait, square and a 1080 x 1920 story; a song keeps two", () => {
    expect(cardFormatsFor(author).map((f) => f.id)).toEqual(["portrait", "square", "story"])
    expect(cardFormatsFor(song).map((f) => f.id)).toEqual(["portrait", "square"])
    expect(cardSize("story")).toEqual({ width: 1080, height: 1920 })
  })
})

describe("author card: words", () => {
  it("reads like the website's link preview, in English", () => {
    expect(cardEyebrow(author)).toBe("Singer · Warsaw, Poland")
    expect(cardTitle(author)).toBe("Sunil Nath")
    expect(cardSubline(author)).toBe("Kiirtan · Bhajan")
    expect(cardEyebrow({ ...author, authorType: "group", city: null })).toBe("Group · Poland")
    expect(cardEyebrow({ ...author, city: " ", country: null })).toBe("Singer")
  })

  it("has no site address and no line at the bottom", () => {
    expect(cardUrlLine(author, "https://www.prabhatasamgiita.org")).toBe("")
    for (const text of [cardEyebrow(author), cardTitle(author), cardSubline(author) ?? ""]) expect(text.toLowerCase()).not.toContain("prabhatasamgiita.org")
  })

  it("leaves out the kinds line when the page has no recordings, and names a nameless page", () => {
    expect(cardSubline({ ...author, kinds: [] })).toBeNull()
    expect(cardSubline({ ...author, kinds: [{ kind: "kiirtan", count: 0 }] })).toBeNull()
    expect(cardTitle({ ...author, name: "  " })).toBe("Author page")
  })

  it("takes two initials for the placeholder", () => {
    expect(authorInitials("Sunil Nath")).toBe("SN")
    expect(authorInitials("Ananda  Maya  Devi")).toBe("AD")
    expect(authorInitials("Dada")).toBe("D")
    expect(authorInitials(" ")).toBe("?")
  })

  it("names the file after the author and the shape", () => {
    expect(cardFileName(author, "story")).toBe("prabhat-samgiita-author-sunil-nath-story.png")
  })

  it("shrinks a long name so that it stays within its lines", () => {
    expect(authorNameSize("Sunil", "portrait")).toBeGreaterThan(authorNameSize("Sunil Nath Kiirtan Group of Warsaw", "portrait"))
    expect(authorNameSize("Sunil", "story")).toBe(authorCardLayout("story").nameSize)
  })
})

describe("author card: the photo behind it", () => {
  it("is one of the warm photos with nobody in them", () => {
    for (const n of AUTHOR_CARD_PHOTOS) {
      const meta = STOCK_PHOTO_META.find((p) => p.n === n)
      expect(meta, `photo ${n}`).toBeDefined()
      expect(meta!.tone).toBe("warm")
      expect(meta!.people ?? "none").toBe("none")
      expect(meta!.lowRes).not.toBe(true)
    }
  })

  it("is stable per page id", () => {
    expect(authorCardPhotoN(ID)).toBe(authorCardPhotoN(ID))
    expect(AUTHOR_CARD_PHOTOS).toContain(authorCardPhotoN("another-id"))
  })

  it("is the website's photo: same list, same hash (apps/web/lib/author-card.ts)", () => {
    const web = readFileSync(resolve(__dirname, "../../web/lib/author-card.ts"), "utf8")
    const list = /AUTHOR_CARD_PHOTOS = \[([^\]]*)\]/.exec(web)?.[1]?.split(",").map((s) => Number(s.trim()))
    expect(list).toEqual([...AUTHOR_CARD_PHOTOS])
    // the web's own function (it imports nothing), asked about many ids
    for (let i = 0; i < 200; i++) {
      const id = `${ID.slice(0, 30)}${String(i).padStart(6, "0")}`
      expect(authorCardPhotoN(id), id).toBe(webAuthorCardPhoto(id))
    }
    const webPlaceholders = [...web.matchAll(/from: "(#[0-9A-Fa-f]{6})", to: "(#[0-9A-Fa-f]{6})"/g)].map((m) => ({ from: m[1], to: m[2] }))
    expect(webPlaceholders).toEqual([...AUTHOR_PLACEHOLDERS])
  })
})

describe("author card: legibility", () => {
  it("ivory text on the placeholder keeps 4.5:1 at its lighter stop", () => {
    for (const g of AUTHOR_PLACEHOLDERS) expect(contrast(luminance(AUTHOR_IVORY), luminance(g.from))).toBeGreaterThanOrEqual(4.5)
  })

  it("the scrim is at least 0.6 black from where the text starts, so ivory is 4.5:1 and the gold line 3:1 (large text) on a white photo", () => {
    for (const format of FORMATS) {
      const stops = authorScrimStops(format)
      const from = authorTextFrom(format)
      expect(scrimAlphaAt(from, stops)).toBeGreaterThanOrEqual(CARD_SCRIM_MIN_UNDER_TEXT - 1e-9)
      expect(scrimAlphaAt(1, stops)).toBeGreaterThanOrEqual(CARD_SCRIM_MIN_UNDER_TEXT)
      const worst = underScrim(CARD_SCRIM_MIN_UNDER_TEXT)
      expect(contrast(luminance(AUTHOR_IVORY), worst)).toBeGreaterThanOrEqual(4.5)
      expect(contrast(luminance(AUTHOR_GOLD), worst)).toBeGreaterThanOrEqual(3)
      expect(stops.map((s) => s.at)).toEqual([...stops.map((s) => s.at)].sort((a, b) => a - b))
    }
  })

  it("the text block fits the card, and in a story stays in the 1250 px that Instagram does not cover", () => {
    for (const format of FORMATS) {
      const { height } = cardSize(format)
      const l = authorCardLayout(format)
      expect(authorBlockHeight(format) + l.padding * 2 + l.safeBottom).toBeLessThan(height)
    }
    const l = authorCardLayout("story")
    const top = cardSize("story").height - l.padding - l.safeBottom - authorBlockHeight("story")
    expect(l.safeBottom).toBeGreaterThanOrEqual(335)
    expect(top).toBeGreaterThanOrEqual(335)
  })
})

describe("author card: the link", () => {
  it("carries the page id while the page link is hidden, and the address once it is offered", () => {
    expect(SHOW_PAGE_LINK).toBe(false)
    expect(authorShareKey(page)).toBe(ID)
    expect(authorShareKey(page, true)).toBe("sunil-nath")
    expect(authorLinkOf(page)).toMatch(new RegExp(`/author/${ID}$`))
  })

  it("falls back to the address when the server sent no id", () => {
    expect(authorShareKey({ slug: "sunil-nath" })).toBe("sunil-nath")
    expect(authorLinkOf({ slug: "sunil-nath", id: null })).toMatch(/\/author\/sunil-nath$/)
    expect(authorCardSubject({ ...page, id: undefined }, null).id).toBe("sunil-nath")
  })
})

describe("author page opened by its id", () => {
  it("the remote client takes it as the page, not as a moved address", async () => {
    const fetchFake = (async () => new Response(JSON.stringify({ id: ID, slug: "sunil-nath", display_name: "S" }), { status: 200, headers: { "Content-Type": "application/json" } })) as typeof fetch
    const api = createAuthorsApi({ baseUrl: "https://api.example/", headers: () => ({}), fetch: fetchFake })
    const byId = await api.profile(ID)
    expect(byId.kind).toBe("profile")
    expect((await api.profile("old-name")).kind).toBe("moved")
  })

  it("the demo answers to the id as well as to the address", async () => {
    const api = createDemoApi()
    const first = DEMO_AUTHORS[0]!.profile
    const bySlug = await api.profile(first.slug)
    expect(bySlug.kind).toBe("profile")
    const id = bySlug.kind === "profile" ? bySlug.profile.id : undefined
    expect(id).toBeTruthy()
    const byId = await api.profile(id as string)
    expect(byId.kind === "profile" && byId.profile.slug).toBe(first.slug)
    expect((await api.recordings(id as string, {})).total).toBe((await api.recordings(first.slug, {})).total)
  })
})
