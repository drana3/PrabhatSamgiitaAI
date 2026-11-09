/**
 * The share card: a picture of a song or a Kiirtan that leaves the app (WhatsApp, Stories, the Photos app).
 * Everything here is pure (no React, no native modules) so the sizes, texts, seeds, scrim and the photo rules
 * can be tested. The card is drawn by components/share/SharePosterCard.tsx and turned into a PNG by
 * lib/share/cardIO.ts. The server side (an Open Graph image for the same song) is described in docs/share.md.
 *
 * Both formats are 1080 px wide. Layout numbers below are in those pixels, the card is drawn at that size and
 * scaled down for the preview.
 */

import { hashSeed, type PickOptions } from "@/lib/photos/pick"

export type CardFormat = "portrait" | "square" | "story"

export const CARD_WIDTH = 1080

export const CARD_FORMATS: ReadonlyArray<{ id: CardFormat; label: string; width: number; height: number }> = [
  { id: "portrait", label: "Portrait", width: CARD_WIDTH, height: 1350 },
  { id: "square", label: "Square", width: CARD_WIDTH, height: 1080 },
]

/** The tall shape for Stories (9:16). Offered for an author page only; a song or a Kiirtan keeps its two shapes. */
export const STORY_FORMAT = { id: "story", label: "Story", width: CARD_WIDTH, height: 1920 } as const

const AUTHOR_FORMATS: ReadonlyArray<{ id: CardFormat; label: string; width: number; height: number }> = [...CARD_FORMATS, STORY_FORMAT]

/** The shapes the sheet offers for a subject. */
export function cardFormatsFor(subject: CardSubject): ReadonlyArray<{ id: CardFormat; label: string; width: number; height: number }> {
  return subject.kind === "author" ? AUTHOR_FORMATS : CARD_FORMATS
}

export function cardSize(format: CardFormat): { width: number; height: number } {
  const f = AUTHOR_FORMATS.find((x) => x.id === format) ?? CARD_FORMATS[0]
  return { width: f.width, height: f.height }
}

// ---- what the card is about ----

export type CardSubject =
  | { kind: "song"; number: number; title: string; performer?: string | null }
  | {
      kind: "kiirtan"
      id: string
      title: string
      /** performer or group, as the author wrote it */
      author?: string | null
      /** the kind of the recording ("bhajan", "prabhat_samgiita"); anything else prints "Kiirtan" */
      recordingKind?: string | null
      durationSec?: number | null
      /** the author's own cover picture, when there is one */
      coverUrl?: string | null
      /** Kiirtan type (bnk, lila, ...), for the gradient behind a cover that fails to load */
      type?: string | null
    }
  | {
      /** An author page (docs/share.md, "Author page preview"): no site name, no numbers, English captions. */
      kind: "author"
      /** the page id: it picks the photo behind the card, the same one the link preview on the web shows */
      id: string
      name: string
      authorType: "solo" | "group"
      city?: string | null
      country?: string | null
      /** the kinds of recordings the page has, in the API's words ("kiirtan", "bhajan") */
      kinds?: { kind: string; count: number }[]
      /** the author's photo, as a whole address; none draws the round placeholder with initials */
      photoUrl?: string | null
    }

const RECORDING_KIND_NAMES: Record<string, string> = { bhajan: "Bhajan", devotional_song: "Bhajan", prabhat_samgiita: "Prabhat Samgiita", spiritual_song: "Spiritual song", dance_song: "Dance music", baba_audio: "Baba's Audio Discourses", other_mantra: "Other mantras" }

function recordingKindName(kind: string | null | undefined): string {
  return RECORDING_KIND_NAMES[kind ?? ""] ?? "Kiirtan"
}

const GENERIC_PERFORMERS = new Set(["", "prabhat samgiita", "prabhat samgiita collection", "unknown", "unknown artist"])

function isGenericPerformer(value: string | null | undefined): boolean {
  return GENERIC_PERFORMERS.has((value ?? "").trim().toLowerCase())
}

/** The small line above the title: "PS 123", or "Kiirtan · Artist" ("Kiirtan" alone when the artist is not known). */
export function cardEyebrow(subject: CardSubject): string {
  if (subject.kind === "song") return `PS ${subject.number}`
  if (subject.kind === "author") return authorEyebrow(subject)
  const label = recordingKindName(subject.recordingKind)
  const by = (subject.author ?? "").trim()
  return isGenericPerformer(by) ? label : `${label} · ${by}`
}

export function cardTitle(subject: CardSubject): string {
  if (subject.kind === "author") return subject.name.trim().replace(/\s+/g, " ") || "Author page"
  const title = subject.title.trim()
  if (title) return title
  return subject.kind === "song" ? `Prabhat Samgiita ${subject.number}` : recordingKindName(subject.recordingKind)
}

/** The line under the title: the performer of a song. A Kiirtan carries its artist in the eyebrow, so it has none. */
export function cardSubline(subject: CardSubject): string | null {
  if (subject.kind === "author") return authorKindsLine(subject) || null
  if (subject.kind !== "song") return null
  const by = (subject.performer ?? "").trim()
  return isGenericPerformer(by) ? null : by
}

// ---- the link printed on the card ----

/** `https://www.example.org/songs/3?open=app` becomes `www.example.org/songs/3`: no protocol, query or trailing slash. */
export function displayUrl(url: string): string {
  return url
    .trim()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, "")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "")
}

/**
 * The short link line. A song has a public page (`/songs/{n}`); a Kiirtan has none yet, so its card prints the
 * website alone rather than a link that would not open the recording.
 * TODO(web): print `/kiirtan/{id}` when the website has that page (see docs/share.md).
 */
export function cardUrlLine(subject: CardSubject, webBase: string): string {
  // an author card prints no address at all (Dada's decision, docs/share.md)
  if (subject.kind === "author") return ""
  const base = displayUrl(webBase)
  return subject.kind === "song" ? `${base}/songs/${subject.number}` : base
}

// ---- the photo ----

/**
 * The stock photo rules of a share image (docs/photo-system.md, "Share sheet image"): the same defaults as the
 * hero. `allowPeople` stays off, so a `close` or `children` photo is never picked, and `lowRes` photos are out.
 */
export const CARD_PHOTO_OPTIONS: PickOptions = { size: "large" }

/**
 * The seed that picks the photo. A song uses the same seed as its page's hero (`ps-{n}`), so the card and the page
 * show one photo. A Kiirtan uses its id, as its cover does everywhere else.
 */
export function cardPhotoSeed(subject: CardSubject): string {
  return subject.kind === "song" ? `ps-${subject.number}` : subject.id
}

// ---- an author card ----

type AuthorSubject = Extract<CardSubject, { kind: "author" }>

const AUTHOR_KIND_NAMES: Record<string, string> = { kiirtan: "Kiirtan", bhajan: "Bhajan", prabhat_samgiita: "Prabhat Samgiita", spiritual_song: "Spiritual song", dance_song: "Dance music" }

/** "Singer · Warsaw, Poland" or "Group · Spain". The same words as the link preview of the website (apps/web/lib/author-card.ts). */
export function authorEyebrow(subject: AuthorSubject): string {
  const role = subject.authorType === "group" ? "Group" : "Singer"
  const place = [subject.city, subject.country]
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
    .join(", ")
  return place ? `${role} · ${place}` : role
}

/** "Kiirtan · Bhajan": the kinds the page has, as words; empty when there are none. */
export function authorKindsLine(subject: AuthorSubject): string {
  return (subject.kinds ?? [])
    .filter((k) => k.count > 0)
    .map((k) => AUTHOR_KIND_NAMES[k.kind] ?? "")
    .filter(Boolean)
    .join(" · ")
}

/**
 * The stock photos an author card may use: warm, nobody in them, from this app's list (`n` of photoData). The website's
 * link preview has the same list (AUTHOR_CARD_PHOTOS in apps/web/lib/author-card.ts) and the same hash, so a page's card
 * in the app and its link preview show one photo. A test keeps the two lists equal.
 */
export const AUTHOR_CARD_PHOTOS = [10, 12, 14, 15, 16, 24, 25, 35] as const

export function authorCardPhotoN(id: string): number {
  return AUTHOR_CARD_PHOTOS[hashSeed(id) % AUTHOR_CARD_PHOTOS.length]
}

/** Up to two capitals for the round placeholder when the page has no photo. */
export function authorInitials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .map((w) => Array.from(w.replace(/[^\p{L}\p{N}]/gu, ""))[0] ?? "")
    .filter(Boolean)
  if (words.length === 0) return "?"
  const picked = words.length === 1 ? words : [words[0], words[words.length - 1]]
  return picked.join("").toLocaleUpperCase("en")
}

/** Gradients of the round placeholder, chosen by the page id; each is dark enough for ivory text (same as the website). */
export const AUTHOR_PLACEHOLDERS: readonly { from: string; to: string }[] = [
  { from: "#7A2E12", to: "#3A1409" },
  { from: "#3F5A2A", to: "#1F2E15" },
  { from: "#6B2F4A", to: "#34172A" },
  { from: "#1F4F5C", to: "#0F2A33" },
  { from: "#8A5A12", to: "#4A2E08" },
  { from: "#7C4A32", to: "#3B2118" },
]

export function authorPlaceholder(id: string): { from: string; to: string } {
  return AUTHOR_PLACEHOLDERS[hashSeed(`ph:${id}`) % AUTHOR_PLACEHOLDERS.length]
}

export const AUTHOR_IVORY = "#FBF6EC"
export const AUTHOR_GOLD = "#E2B955"

export type AuthorCardLayout = {
  padding: number
  /** diameter of the round photo */
  avatar: number
  /** gap between the round photo and the text under it */
  avatarGap: number
  nameSize: number
  nameLines: number
  eyebrowSize: number
  kindsSize: number
  /** kept free at the top and bottom: Instagram draws over them in a Story (1250 px in the middle stay clear) */
  safeTop: number
  safeBottom: number
}

export function authorCardLayout(format: CardFormat): AuthorCardLayout {
  if (format === "story") return { padding: 84, avatar: 300, avatarGap: 40, nameSize: 132, nameLines: 3, eyebrowSize: 36, kindsSize: 34, safeTop: 335, safeBottom: 335 }
  if (format === "square") return { padding: 80, avatar: 240, avatarGap: 36, nameSize: 112, nameLines: 2, eyebrowSize: 32, kindsSize: 30, safeTop: 0, safeBottom: 0 }
  return { padding: 84, avatar: 280, avatarGap: 40, nameSize: 132, nameLines: 3, eyebrowSize: 36, kindsSize: 34, safeTop: 0, safeBottom: 0 }
}

/** The name is the card: big for a short one, smaller as it gets longer, so that it stays within its lines. */
export function authorNameSize(name: string, format: CardFormat): number {
  const n = name.length
  const factor = n <= 14 ? 1 : n <= 24 ? 0.84 : n <= 36 ? 0.68 : 0.54
  return Math.round(authorCardLayout(format).nameSize * factor)
}

/** Height of the text block at its tallest: round photo, hairline, eyebrow, the name on all its lines, the kinds line. */
export function authorBlockHeight(format: CardFormat): number {
  const l = authorCardLayout(format)
  return l.avatar + l.avatarGap + 4 + Math.round(l.eyebrowSize * 0.9) + l.eyebrowSize + 12 + Math.round(l.nameSize * 1.02) * l.nameLines + Math.round(l.kindsSize * 0.7) + l.kindsSize + 8
}

/** Where the text block starts at the earliest, as a share of the card height (it sits at the bottom, above the safe band). */
export function authorTextFrom(format: CardFormat): number {
  const { height } = cardSize(format)
  const l = authorCardLayout(format)
  return Math.max(0, 1 - (authorBlockHeight(format) + l.padding + l.safeBottom) / height)
}

/** The scrim of an author card: nearly clear above, 0.6 black where the text block starts, 0.88 at the bottom edge. */
export function authorScrimStops(format: CardFormat): ScrimStop[] {
  const text = authorTextFrom(format)
  return [
    { at: 0, alpha: 0.22 },
    { at: Math.max(0.04, text - 0.2), alpha: 0.1 },
    { at: text, alpha: CARD_SCRIM_MIN_UNDER_TEXT },
    { at: 1, alpha: 0.88 },
  ]
}

// ---- layout (1080 px wide) ----

export type CardLayout = {
  padding: number
  markSize: number
  markRadius: number
  eyebrowSize: number
  eyebrowTracking: number
  sublineSize: number
  urlSize: number
  /** gap between the lines of the text block */
  gap: number
  /** top of the scrim as a share of the card height */
  scrimFrom: number
}

export function cardLayout(format: CardFormat): CardLayout {
  const portrait = format === "portrait"
  return {
    padding: 72,
    markSize: 104,
    markRadius: 26,
    eyebrowSize: 34,
    eyebrowTracking: 3.4,
    sublineSize: portrait ? 42 : 38,
    urlSize: 32,
    gap: portrait ? 22 : 18,
    scrimFrom: portrait ? 0.34 : 0.28,
  }
}

/**
 * Font size of the title: big for a short name, smaller as it gets longer, so that it stays within three lines.
 * The card is about the title; the eyebrow (34 px) and this (up to 148 px) are more than 4x apart.
 */
export function cardTitleSize(title: string, format: CardFormat): number {
  const n = title.trim().length
  const base = n <= 14 ? 148 : n <= 24 ? 124 : n <= 36 ? 100 : n <= 56 ? 80 : 64
  return format === "square" ? Math.round(base * 0.86) : base
}

export function cardTitleLineHeight(size: number): number {
  return Math.round(size * 0.98)
}

// ---- the scrim ----

/** Black laid over the photo under the text, so white text keeps 4.5:1 even on a white pixel: at 0.6, white becomes #666 (5.7:1). */
export const CARD_SCRIM_MIN_UNDER_TEXT = 0.6

export type ScrimStop = { at: number; alpha: number }

/**
 * The bottom scrim as stops (position 0 top to 1 bottom, alpha of black). Nothing above `scrimFrom`, then a ramp
 * that already reaches CARD_SCRIM_MIN_UNDER_TEXT where the text block starts (`textFrom`), and the strongest
 * point at the bottom edge, where the link line sits.
 */
export function cardScrimStops(format: CardFormat): ScrimStop[] {
  const l = cardLayout(format)
  const textFrom = cardTextFrom(format)
  return [
    { at: 0, alpha: 0.18 },
    { at: l.scrimFrom, alpha: 0 },
    { at: textFrom, alpha: CARD_SCRIM_MIN_UNDER_TEXT },
    { at: 1, alpha: 0.86 },
  ]
}

/** Where the text block may start at the earliest, as a share of the card height (the block is bottom-aligned). */
export function cardTextFrom(format: CardFormat): number {
  return format === "portrait" ? 0.56 : 0.5
}

/** Alpha of the scrim at a position (linear between stops). */
export function scrimAlphaAt(position: number, stops: readonly ScrimStop[]): number {
  const p = Math.min(1, Math.max(0, position))
  if (stops.length === 0) return 0
  if (p <= stops[0].at) return stops[0].alpha
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1]
    const b = stops[i]
    if (p <= b.at) return b.at === a.at ? b.alpha : a.alpha + ((b.alpha - a.alpha) * (p - a.at)) / (b.at - a.at)
  }
  return stops[stops.length - 1].alpha
}

// ---- file names and actions ----

function slug(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "")
}

/** `prabhat-samgiita-ps-123-portrait.png`, or `prabhat-samgiita-kiirtan-<title>-square.png`. */
export function cardFileName(subject: CardSubject, format: CardFormat): string {
  if (subject.kind === "author") return `prabhat-samgiita-author-${slug(subject.name) || slug(subject.id) || "page"}-${format}.png`
  const middle = subject.kind === "song" ? `ps-${subject.number}` : `${recordingKindName(subject.recordingKind).toLowerCase().replace(/ /g, "-")}-${slug(subject.title) || slug(subject.id) || "recording"}`
  return `prabhat-samgiita-${middle}-${format}.png`
}

export type CardAction = "share" | "save" | "copy"

/**
 * The buttons of the card sheet.
 * - native: "Share image" (the system share sheet takes the PNG file; Save Image and Instagram are in it) and
 *   "Copy link".
 * - web: "Save image" (a download) and "Copy link"; "Share image" too where the browser can share a file
 *   (navigator.canShare with files, mostly phones).
 */
export function cardActions(opts: { native: boolean; canShareFile: boolean }): CardAction[] {
  if (opts.native) return ["share", "copy"]
  return opts.canShareFile ? ["share", "save", "copy"] : ["save", "copy"]
}
