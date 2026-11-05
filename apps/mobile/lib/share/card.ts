/**
 * The share card: a picture of a song or a Kiirtan that leaves the app (WhatsApp, Stories, the Photos app).
 * Everything here is pure (no React, no native modules) so the sizes, texts, seeds, scrim and the photo rules
 * can be tested. The card is drawn by components/share/SharePosterCard.tsx and turned into a PNG by
 * lib/share/cardIO.ts. The server side (an Open Graph image for the same song) is described in docs/share.md.
 *
 * Both formats are 1080 px wide. Layout numbers below are in those pixels, the card is drawn at that size and
 * scaled down for the preview.
 */

import type { PickOptions } from "@/lib/photos/pick"

export type CardFormat = "portrait" | "square"

export const CARD_WIDTH = 1080

export const CARD_FORMATS: ReadonlyArray<{ id: CardFormat; label: string; width: number; height: number }> = [
  { id: "portrait", label: "Portrait", width: CARD_WIDTH, height: 1350 },
  { id: "square", label: "Square", width: CARD_WIDTH, height: 1080 },
]

export function cardSize(format: CardFormat): { width: number; height: number } {
  const f = CARD_FORMATS.find((x) => x.id === format) ?? CARD_FORMATS[0]
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
      /** "bhajan" prints "Bhajan", anything else "Kiirtan" */
      recordingKind?: string | null
      durationSec?: number | null
      /** the author's own cover picture, when there is one */
      coverUrl?: string | null
      /** Kiirtan type (bnk, lila, ...), for the gradient behind a cover that fails to load */
      type?: string | null
    }

const GENERIC_PERFORMERS = new Set(["", "prabhat samgiita", "prabhat samgiita collection", "unknown", "unknown artist"])

function isGenericPerformer(value: string | null | undefined): boolean {
  return GENERIC_PERFORMERS.has((value ?? "").trim().toLowerCase())
}

/** The small line above the title: "PS 123", or "Kiirtan · Artist" ("Kiirtan" alone when the artist is not known). */
export function cardEyebrow(subject: CardSubject): string {
  if (subject.kind === "song") return `PS ${subject.number}`
  const label = subject.recordingKind === "bhajan" ? "Bhajan" : "Kiirtan"
  const by = (subject.author ?? "").trim()
  return isGenericPerformer(by) ? label : `${label} · ${by}`
}

export function cardTitle(subject: CardSubject): string {
  const title = subject.title.trim()
  if (title) return title
  return subject.kind === "song" ? `Prabhat Samgiita ${subject.number}` : subject.recordingKind === "bhajan" ? "Bhajan" : "Kiirtan"
}

/** The line under the title: the performer of a song. A Kiirtan carries its artist in the eyebrow, so it has none. */
export function cardSubline(subject: CardSubject): string | null {
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
  const middle = subject.kind === "song" ? `ps-${subject.number}` : `${subject.recordingKind === "bhajan" ? "bhajan" : "kiirtan"}-${slug(subject.title) || slug(subject.id) || "recording"}`
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
