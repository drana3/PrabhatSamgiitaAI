import type { ScriptId } from "@/lib/songPage/scripts"
import type { WordGlosses } from "@/lib/songPage/songContent"

/**
 * The printed layouts of a song. One template each, all driven by the same options. `projector` is the odd one: 16:9 slides,
 * one stanza each, very large type, for a screen or a projector.
 */
export const PDF_VARIANTS = ["sheet", "study", "reader", "singing", "projector"] as const
export type PdfVariantId = (typeof PDF_VARIANTS)[number]

/** The five looks of a printed song. A look sets the colours, the type and the head of the page; a layout sets the body. */
export const PDF_THEMES = ["dawn", "night", "hymnal", "poster", "mono"] as const
export type PdfThemeId = (typeof PDF_THEMES)[number]

/** What a layout needs from the song page. Plain data: the builder never reads a store. */
export type PdfSongInput = {
  number: number
  title: string
  /** `14 Sep 1982`, or null when the catalogue has no date */
  composed: string | null
  raga: string | null
  tala: string | null
  /** every line of the Roman text, in order; the word meanings are keyed by these line and word positions */
  romanLines: string[]
  /** the lines of each script the song has (the Roman ones included) */
  linesByScript: Partial<Record<ScriptId, string[]>>
  /** a photo for the head of the page (a data or file address; nobody in it), or null: the look then prints without one */
  photo: string | null
  glosses: WordGlosses | null
  /** the translation of the song by language code: one text, a blank line between the parts */
  translations: Record<string, string>
}

export type PdfOptions = {
  variant: PdfVariantId
  theme: PdfThemeId
  script: ScriptId
  /** languages of the word meanings, in the order they stack under a word; a language the song has none in is skipped */
  wordLanguages: string[]
  /** languages of the translation, in the order they sit side by side or one after the other */
  translationLanguages: string[]
  /** the Sheet picks its own layout, photo band and type scale to fit one page; this overrides that (for checking the fit) */
  fit?: { k?: number; kt?: number; mode?: "wide" | "dense" | "tight"; band?: "tall" | "slim"; flow?: boolean }
}

export const DEFAULT_PDF_OPTIONS: PdfOptions = { variant: "sheet", theme: "dawn", script: "roman", wordLanguages: ["en"], translationLanguages: ["en"] }
