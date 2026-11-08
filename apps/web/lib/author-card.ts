/**
 * The share picture of an author page (docs/share.md, "Author page preview"): what it says, which photo sits behind it,
 * and the numbers of its layout. Pure (no React, no I/O) so the rules can be tested; the drawing is
 * `author-card-image.tsx` and the route is `app/share/author/[id]/route.tsx`.
 *
 * What the picture never carries, by Dada's decision: the website's address (top or bottom), a count of listeners or
 * plays, a bottom line, text in another language than English. A page that hides its statistics therefore loses nothing
 * here: no number of that kind is ever read.
 */

export type CardFormat = "link" | "story" | "square"

export const CARD_FORMATS: Record<CardFormat, { width: number; height: number }> = {
  /** chats, Facebook, social previews: 1.91:1 */
  link: { width: 1200, height: 630 },
  /** Instagram story: 9:16. Instagram covers the top and the bottom, so everything sits in the middle band. */
  story: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
}

export function isCardFormat(value: unknown): value is CardFormat {
  return value === "link" || value === "story" || value === "square"
}

/** The shortest form a person can mistype is still a format: anything unknown is the link card. */
export function cardFormatOf(value: string | null | undefined): CardFormat {
  return isCardFormat(value) ? value : "link"
}

/**
 * The stock photos an author card may use: the warm ones with nobody in them from the app's own list
 * (apps/mobile/lib/photos/photoData.ts, numbers are the app's `n`). Files are `public/share/bg/<n>.jpg`. The app reads the
 * same list (`AUTHOR_CARD_PHOTOS` in lib/share/authorCard.ts), so the card in the app and the link preview show one photo.
 * Unsplash License: no credit line needed.
 */
export const AUTHOR_CARD_PHOTOS = [10, 12, 14, 15, 16, 24, 25, 35] as const

/** FNV-1a, 32 bit: the same function as `hashSeed` in the app's lib/photos/pick.ts. */
export function hashSeed(seed: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** The photo behind a page's card: stable per page id, the same everywhere. */
export function authorCardPhoto(id: string): number {
  return AUTHOR_CARD_PHOTOS[hashSeed(id) % AUTHOR_CARD_PHOTOS.length]!
}

/** What the card needs of a profile. Nothing about listeners, plays, links or the bio. */
export type CardProfile = {
  id: string
  display_name: string
  author_type: "solo" | "group"
  city: string | null
  country: string | null
  kinds: { kind: string; count: number }[]
  verified?: boolean
}

const KIND_NAME: Record<string, string> = {
  kiirtan: "Kiirtan",
  bhajan: "Bhajan",
  prabhat_samgiita: "Prabhat Samgiita",
  spiritual_song: "Spiritual song",
  dance_song: "Dance music",
}

/** "Singer · Warsaw, Poland" or "Group · Spain" (English). */
export function cardEyebrow(profile: CardProfile): string {
  const role = profile.author_type === "group" ? "Group" : "Singer"
  const place = [profile.city, profile.country]
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
    .join(", ")
  return place ? `${role} · ${place}` : role
}

/** The kinds the author has, as words: "Kiirtan · Bhajan". Empty when there are none (the line is then left out). */
export function cardKindsLine(profile: CardProfile): string {
  return profile.kinds
    .filter((k) => k.count > 0)
    .map((k) => KIND_NAME[k.kind] ?? "")
    .filter(Boolean)
    .join(" · ")
}

export function cardName(profile: CardProfile): string {
  return profile.display_name.trim().replace(/\s+/g, " ")
}

/** Up to two capitals for the round placeholder when there is no photo. */
export function cardInitials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .map((w) => Array.from(w.replace(/[^\p{L}\p{N}]/gu, ""))[0] ?? "")
    .filter(Boolean)
  if (words.length === 0) return "?"
  const picked = words.length === 1 ? words : [words[0]!, words[words.length - 1]!]
  return picked.join("").toLocaleUpperCase("en")
}

/**
 * Colours of the round placeholder, chosen by the page id. Every pair is dark enough for ivory text on it
 * (a test checks 4.5:1 at the lighter stop).
 */
export const PLACEHOLDER_GRADIENTS: readonly { from: string; to: string }[] = [
  { from: "#7A2E12", to: "#3A1409" }, // ember
  { from: "#3F5A2A", to: "#1F2E15" }, // moss
  { from: "#6B2F4A", to: "#34172A" }, // dusk rose
  { from: "#1F4F5C", to: "#0F2A33" }, // sea
  { from: "#8A5A12", to: "#4A2E08" }, // ochre
  { from: "#7C4A32", to: "#3B2118" }, // clay
]

export function placeholderGradient(id: string): { from: string; to: string } {
  return PLACEHOLDER_GRADIENTS[hashSeed(`ph:${id}`) % PLACEHOLDER_GRADIENTS.length]!
}

export const INK = "#14100C"
export const IVORY = "#FBF6EC"
export const GOLD = "#E2B955"

/** Black laid under the text, as in the app's cards: white on a white pixel under 0.6 black is 5.7:1. */
export const SCRIM_MIN_UNDER_TEXT = 0.6

export type CardLayout = {
  padding: number
  /** diameter of the round photo */
  portrait: number
  nameSize: number
  nameLines: number
  eyebrowSize: number
  kindsSize: number
  /** `row`: portrait beside the text (the wide card); `column`: portrait above it */
  direction: "row" | "column"
  /** space kept free at the top and bottom (Instagram draws over them in a story) */
  safeTop: number
  safeBottom: number
}

export function cardLayout(format: CardFormat): CardLayout {
  if (format === "link") {
    return { padding: 64, portrait: 176, nameSize: 84, nameLines: 2, eyebrowSize: 26, kindsSize: 24, direction: "row", safeTop: 0, safeBottom: 0 }
  }
  if (format === "story") {
    // 1250 px in the middle of 1920 are never covered: 335 free above and below
    return { padding: 84, portrait: 300, nameSize: 132, nameLines: 3, eyebrowSize: 36, kindsSize: 34, direction: "column", safeTop: 335, safeBottom: 335 }
  }
  return { padding: 80, portrait: 240, nameSize: 112, nameLines: 2, eyebrowSize: 32, kindsSize: 30, direction: "column", safeTop: 0, safeBottom: 0 }
}

/** The name is the card: big for a short one, smaller as it gets longer so that it stays within its lines. */
export function cardNameSize(name: string, format: CardFormat): number {
  const base = cardLayout(format).nameSize
  const n = name.length
  const factor = n <= 14 ? 1 : n <= 24 ? 0.84 : n <= 36 ? 0.68 : 0.54
  return Math.round(base * factor)
}

/**
 * Alpha of black at each height of the scrim (0 top, 1 bottom): nearly clear above, 0.6 black where the text block starts
 * (`textFrom`, worked out from the layout: portrait, rule, three lines, kinds), 0.88 at the bottom edge.
 */
export function scrimStops(format: CardFormat): { at: number; alpha: number }[] {
  const from = format === "link" ? 0.2 : format === "story" ? 0.18 : 0.12
  const text = format === "link" ? 0.46 : format === "story" ? 0.34 : 0.3
  return [
    { at: 0, alpha: 0.22 },
    { at: from, alpha: 0.1 },
    { at: text, alpha: SCRIM_MIN_UNDER_TEXT },
    { at: 1, alpha: 0.88 },
  ]
}

/** The address of the picture for a page (id, not address, so a new page link never breaks a link already shared). */
export function authorCardPath(id: string, format: CardFormat = "link", version?: string | number): string {
  const query = new URLSearchParams()
  if (format !== "link") query.set("format", format)
  if (version !== undefined && version !== "") query.set("v", String(version))
  const q = query.toString()
  return `/share/author/${encodeURIComponent(id)}${q ? `?${q}` : ""}`
}

/** A version for the picture's address that changes when the page changes (chats cache a preview by its address). */
export function cardVersion(updatedAt: string | null | undefined): string {
  const ms = updatedAt ? Date.parse(updatedAt) : NaN
  return Number.isFinite(ms) ? Math.floor(ms / 1000).toString(36) : ""
}

/** The first bytes of a picture: only JPEG and PNG can be drawn by the image renderer. */
export function sniffDrawable(bytes: Uint8Array): "image/jpeg" | "image/png" | null {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg"
  if (bytes.length > 7 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png"
  return null
}

/** Names the renderer cannot draw (no glyphs for the script in its fonts): the card then shows the placeholder's letter only. */
export function isDrawableName(name: string): boolean {
  return /^[\p{Script=Latin}\p{N}\p{P}\p{Z}\p{S}]+$/u.test(name)
}
