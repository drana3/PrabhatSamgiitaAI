/**
 * The translations of one song, as the song page uses them (design: docs/ps-translations.md).
 *
 * Three kinds. Official is the translation of the official lyrics page, Poetic reads like a song, Literal follows
 * the words closely. A reader sees only what the server serves: the server never sends an unchecked or machine
 * text, and a literal text only once the team checked it. Members do not offer translations.
 */
export type TranslationKind = "official" | "poetic" | "literal"

/** The order the page offers the kinds in. */
export const TRANSLATION_KINDS: readonly TranslationKind[] = ["official", "poetic", "literal"]

/** How a translation lines up with the lyrics: one text for the whole song, by stanza, or line by line. */
export type TranslationAlignment = "whole" | "stanza" | "line"

/** Lines `from` to `to` (0-based, inclusive) of the lyrics as the page draws them; `to` null means "to the end". */
export type TranslationSegment = { from: number; to: number | null; text: string }

/** What the mark under a text says: "official" (the official lyrics page), "checked" (the team compared it), "reviewed". */
export type TranslationLabel = "official" | "checked" | "reviewed"

export type SongTranslation = {
  id: string
  kind: TranslationKind
  language: string
  /** 0 is the one shown first; the others of the same kind are "Other version" */
  position: number
  alignment: TranslationAlignment
  segments: TranslationSegment[]
  /** the whole text, paragraphs and lines kept */
  text: string
  label: TranslationLabel
  /** true only for a text the team checked (the "Checked" mark appears for these and nothing else) */
  checked: boolean
  creditLine: string | null
  /** the explanation of and comments on the translation; null when there is none (the block is then not drawn) */
  commentary: string | null
  /** true for an official text the app made itself from the catalogue's own `english_meaning` (the API had none) */
  derived: boolean
}

export type SongTranslations = {
  songId: number
  language: string
  /** the kinds this song has, in the page's order */
  kinds: TranslationKind[]
  items: SongTranslation[]
}

export const NO_TRANSLATIONS: SongTranslations = { songId: 0, language: "en", kinds: [], items: [] }
