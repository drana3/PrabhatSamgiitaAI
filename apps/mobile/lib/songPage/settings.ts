import { clampCapo } from "./chords"
import type { ChordInstrument, ChordMode } from "./chordChart"
import { HARMONIUM_KEYS } from "./chords"
import type { ScriptChoice } from "./scripts"
import { FOLLOW_APP, normalizeLyricChoice, normalizeStoredTranslations } from "./lyricLanguages"
import { MAX_TRANSLATIONS } from "./translations"

/**
 * Reading and playing settings of the song page. The spec stores them per user
 * and shares them with the Player karaoke view; here they are stored per device
 * until the account sync (API-16) exists.
 */
export type SongPageSettings = {
  script: ScriptChoice
  /**
   * Languages under each line and in the Meaning section (up to two). Empty means nobody chose yet:
   * follow the language of the app (see effectiveTranslations in lyricLanguages.ts).
   */
  translations: string[]
  /**
   * The language of the word meanings on the Words card: "auto" follows the app language. It is NOT
   * the translation setting: picking a word language never changes the Meaning section.
   */
  wordLanguage: string
  chordsOn: boolean
  instrument: ChordInstrument
  capo: number
  chordMode: ChordMode
  harmoniumKey: string
}

export const DEFAULT_SONG_PAGE_SETTINGS: SongPageSettings = {
  script: "roman",
  translations: [],
  wordLanguage: FOLLOW_APP,
  chordsOn: false,
  instrument: "guitar",
  capo: 0,
  chordMode: "shapes",
  harmoniumKey: "D",
}

const SCRIPTS: ScriptChoice[] = ["roman", "devanagari", "bengali", "both"]

/** Make stored (possibly old or damaged) settings safe to use. */
export function normalizeSettings(input: Partial<SongPageSettings> | null | undefined): SongPageSettings {
  const d = DEFAULT_SONG_PAGE_SETTINGS
  const raw = input ?? {}
  // `fr` and the like (offered before the list was fixed) are dropped; nothing left means "follow the app"
  const translations = normalizeStoredTranslations(raw.translations, MAX_TRANSLATIONS)
  return {
    script: SCRIPTS.includes(raw.script as ScriptChoice) ? (raw.script as ScriptChoice) : d.script,
    translations,
    // a word language is one language (or "auto"); "off" is a player-only value
    wordLanguage: raw.wordLanguage === "off" ? FOLLOW_APP : normalizeLyricChoice(raw.wordLanguage),
    chordsOn: typeof raw.chordsOn === "boolean" ? raw.chordsOn : d.chordsOn,
    instrument: raw.instrument === "harmonium" ? "harmonium" : "guitar",
    capo: clampCapo(typeof raw.capo === "number" ? raw.capo : d.capo),
    chordMode: raw.chordMode === "sounding" ? "sounding" : "shapes",
    harmoniumKey: (HARMONIUM_KEYS as readonly string[]).includes(raw.harmoniumKey ?? "")
      ? (raw.harmoniumKey as string)
      : d.harmoniumKey,
  }
}
