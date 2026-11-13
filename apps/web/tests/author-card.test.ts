import { existsSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

import { authorCardElement } from "@/lib/author-card-image"
import {
  AUTHOR_CARD_PHOTOS,
  CARD_FORMATS,
  IVORY,
  PLACEHOLDER_GRADIENTS,
  SCRIM_MIN_UNDER_TEXT,
  authorCardPath,
  authorCardPhoto,
  cardEyebrow,
  cardFormatOf,
  cardInitials,
  cardKindsLine,
  cardNameSize,
  cardVersion,
  hashSeed,
  isDrawableName,
  scrimStops,
  sniffDrawable,
  type CardProfile,
} from "@/lib/author-card"

const profile = (over: Partial<CardProfile> = {}): CardProfile => ({
  id: "6f1c1d5e-0b7e-4c43-9d57-0a9b6a1b2c3d",
  display_name: "Priya Devi",
  author_type: "solo",
  city: "Warsaw",
  country: "Poland",
  kinds: [
    { kind: "kiirtan", count: 3 },
    { kind: "bhajan", count: 1 },
    { kind: "dance_song", count: 0 },
  ],
  ...over,
})

function luminance(hex: string): number {
  const channel = (i: number) => {
    const v = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2)
}
const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m)
  return (x! + 0.05) / (y! + 0.05)
}

describe("author share card rules", () => {
  it("has three shapes with the ratios the platforms want", () => {
    expect(CARD_FORMATS.link).toEqual({ width: 1200, height: 630 })
    expect(CARD_FORMATS.story.height / CARD_FORMATS.story.width).toBeCloseTo(16 / 9, 2)
    expect(CARD_FORMATS.square).toEqual({ width: 1080, height: 1080 })
    expect(cardFormatOf("story")).toBe("story")
    expect(cardFormatOf("nonsense")).toBe("link")
    expect(cardFormatOf(null)).toBe("link")
  })

  it("picks one photo per page id, always from the list, and the files exist", () => {
    const seen = new Set<number>()
    for (let i = 0; i < 300; i++) {
      const n = authorCardPhoto(`page-${i}`)
      expect(AUTHOR_CARD_PHOTOS).toContain(n)
      seen.add(n)
    }
    expect(seen.size).toBe(AUTHOR_CARD_PHOTOS.length)
    expect(authorCardPhoto("same")).toBe(authorCardPhoto("same"))
    for (const n of AUTHOR_CARD_PHOTOS) expect(existsSync(path.join(__dirname, "..", "public", "share", "bg", `${n}.jpg`))).toBe(true)
  })

  it("uses the FNV-1a hash of the app, so the app's card and the link preview agree", () => {
    expect(hashSeed("")).toBe(0x811c9dc5)
    expect(hashSeed("a")).toBe(0xe40c292c)
    expect(hashSeed("ps-1")).toBe(hashSeed("ps-1"))
  })

  it("writes the small line in English, with and without a place", () => {
    expect(cardEyebrow(profile())).toBe("Singer · Warsaw, Poland")
    expect(cardEyebrow(profile({ author_type: "group", city: null, country: "Spain" }))).toBe("Group · Spain")
    expect(cardEyebrow(profile({ city: null, country: null }))).toBe("Singer")
  })

  it("lists only kinds that have recordings", () => {
    expect(cardKindsLine(profile())).toBe("Kiirtan · Bhajan")
    expect(cardKindsLine(profile({ kinds: [] }))).toBe("")
  })

  it("makes initials from the first and last word", () => {
    expect(cardInitials("Priya Devi")).toBe("PD")
    expect(cardInitials("Dharmacakra Kiirtan Group")).toBe("DG")
    expect(cardInitials("Madhu")).toBe("M")
    expect(cardInitials("  ")).toBe("?")
  })

  it("keeps ivory text readable (4.5:1) on every placeholder colour, at the lighter stop", () => {
    for (const g of PLACEHOLDER_GRADIENTS) expect(contrast(IVORY, g.from)).toBeGreaterThanOrEqual(4.5)
  })

  it("lays 0.6 black under the text at least, on every shape", () => {
    for (const format of ["link", "story", "square"] as const) {
      const stops = scrimStops(format)
      expect(stops[stops.length - 1]!.alpha).toBeGreaterThanOrEqual(SCRIM_MIN_UNDER_TEXT)
      expect(Math.max(...stops.map((s) => s.alpha))).toBeGreaterThanOrEqual(SCRIM_MIN_UNDER_TEXT)
      // white on white under the minimum scrim is still 4.5:1
      const under = Math.round(255 * (1 - SCRIM_MIN_UNDER_TEXT))
      const hex = `#${under.toString(16).padStart(2, "0").repeat(3)}`
      expect(contrast("#ffffff", hex)).toBeGreaterThanOrEqual(4.5)
    }
  })

  it("makes the name smaller as it gets longer", () => {
    expect(cardNameSize("Priya", "link")).toBeGreaterThan(cardNameSize("Dharmacakra Kiirtan Group of Madrid", "link"))
    expect(cardNameSize("Priya", "story")).toBeGreaterThan(cardNameSize("Priya", "link"))
  })

  it("addresses the picture by page id, with a version", () => {
    const id = profile().id
    expect(authorCardPath(id)).toBe(`/share/author/${id}`)
    expect(authorCardPath(id, "story", "abc")).toBe(`/share/author/${id}?format=story&v=abc`)
    expect(cardVersion("2026-11-08T10:00:00Z")).toBe(cardVersion("2026-11-08T10:00:00Z"))
    expect(cardVersion("2026-11-08T10:00:01Z")).not.toBe(cardVersion("2026-11-08T10:00:00Z"))
    expect(cardVersion(null)).toBe("")
  })

  it("draws only JPEG and PNG pictures", () => {
    expect(sniffDrawable(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg")
    expect(sniffDrawable(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png")
    expect(sniffDrawable(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))).toBeNull()
  })

  it("knows which names its fonts can draw", () => {
    expect(isDrawableName("Priya Devi")).toBe(true)
    expect(isDrawableName("Dhīrāj Kiirtan")).toBe(true)
    expect(isDrawableName("प्रिया")).toBe(false)
  })
})

describe("author share card content", () => {
  const FORBIDDEN = [/prabhatasamgiita/i, /\.org/i, /listener/i, /plays?\b/i, /www\./i, /http/i]

  function texts(node: unknown, out: string[] = []): string[] {
    if (node === null || node === undefined || typeof node === "boolean") return out
    if (typeof node === "string" || typeof node === "number") {
      out.push(String(node))
      return out
    }
    if (Array.isArray(node)) {
      node.forEach((n) => texts(n, out))
      return out
    }
    const element = node as { props?: { children?: unknown; src?: unknown } }
    if (element.props) texts(element.props.children, out)
    return out
  }

  for (const format of ["link", "story", "square"] as const) {
    it(`${format}: says the name, the small line and the kinds, and nothing about the site or listeners`, () => {
      const tree = authorCardElement({ profile: profile(), format, background: "data:image/jpeg;base64,AA", photo: null })
      const all = texts(tree).join(" | ")
      expect(all).toContain("Priya Devi")
      expect(all).toContain("Singer · Warsaw, Poland")
      expect(all).toContain("Kiirtan · Bhajan")
      expect(all).toContain("PD") // the placeholder, since there is no photo
      for (const word of FORBIDDEN) expect(all).not.toMatch(word)
      expect(all).not.toMatch(/\d/)
    })
  }

  it("keeps the placeholder out when the author has a photo", () => {
    const tree = authorCardElement({ profile: profile(), format: "square", background: "data:image/jpeg;base64,AA", photo: "data:image/jpeg;base64,BB" })
    expect(texts(tree).join("|")).not.toContain("PD")
  })

  it("never prints an unreadable name as boxes", () => {
    const tree = authorCardElement({ profile: profile({ display_name: "प्रिया देवी" }), format: "link", background: "data:image/jpeg;base64,AA", photo: null })
    const all = texts(tree).join("|")
    expect(all).not.toContain("प्रिया")
    expect(all).toContain("Author page")
  })
})
