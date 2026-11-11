import type { ScriptId } from "@/lib/songPage/scripts"
import type { WordGlosses } from "@/lib/songPage/songContent"

/** The four printed layouts of a song. One template each, all driven by the same options. */
export const PDF_VARIANTS = ["sheet", "study", "reader", "singing"] as const
export type PdfVariantId = (typeof PDF_VARIANTS)[number]

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
  glosses: WordGlosses | null
  /** the translation of the song by language code: one text, a blank line between the parts */
  translations: Record<string, string>
}

export type PdfOptions = {
  variant: PdfVariantId
  script: ScriptId
  /** languages of the word meanings, in the order they stack under a word; a language the song has none in is skipped */
  wordLanguages: string[]
  /** languages of the translation, in the order they sit side by side or one after the other */
  translationLanguages: string[]
}

export const DEFAULT_PDF_OPTIONS: PdfOptions = { variant: "sheet", script: "roman", wordLanguages: ["en"], translationLanguages: ["en"] }
