import { clampCapo } from "./chords"
import type { ChordInstrument, ChordMode } from "./chordChart"
import { HARMONIUM_KEYS } from "./chords"
import type { ScriptChoice } from "./scripts"
import { MAX_TRANSLATIONS } from "./translations"

/**
 * Reading and playing settings of the song page. The spec stores them per user
 * and shares them with the Player karaoke view; here they are stored per device
 * until the account sync (API-16) exists.
 */
export type SongPageSettings = {
  script: ScriptChoice
  translations: string[]
  chordsOn: boolean
  instrument: ChordInstrument
  capo: number
  chordMode: ChordMode
  harmoniumKey: string
}

export const DEFAULT_SONG_PAGE_SETTINGS: SongPageSettings = {
  script: "roman",
  translations: ["en"],
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
  const translations = Array.isArray(raw.translations)
    ? raw.translations.filter((c): c is string => typeof c === "string" && c.length > 0)
    : []
  const unique = translations.filter((c, i) => translations.indexOf(c) === i).slice(-MAX_TRANSLATIONS)
  return {
    script: SCRIPTS.includes(raw.script as ScriptChoice) ? (raw.script as ScriptChoice) : d.script,
    translations: unique.length ? unique : d.translations,
    chordsOn: typeof raw.chordsOn === "boolean" ? raw.chordsOn : d.chordsOn,
    instrument: raw.instrument === "harmonium" ? "harmonium" : "guitar",
    capo: clampCapo(typeof raw.capo === "number" ? raw.capo : d.capo),
    chordMode: raw.chordMode === "sounding" ? "sounding" : "shapes",
    harmoniumKey: (HARMONIUM_KEYS as readonly string[]).includes(raw.harmoniumKey ?? "")
      ? (raw.harmoniumKey as string)
      : d.harmoniumKey,
  }
}
