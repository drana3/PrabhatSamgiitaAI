import { t } from "@/lib/i18n"
import { normalizeKind } from "@/lib/kirtan/kind"
import { titleCase } from "@/lib/searchMenu/facets"

/**
 * The MAIN (lead) INSTRUMENT of a recording: the one that carries the music (a Kiirtan with a harmonium and a tabla names the
 * harmonium). A short pick list plus "Add your own". ONE list, kept in step with the API
 * (`apps/api/app/services/recording_instruments.py` INSTRUMENTS; `__tests__/kirtanInstruments.test.ts` and
 * `apps/api/tests/test_value_suggestions.py` pin the two sides). To add one: add its id here and there and an
 * `instrument.<id>` label in en, ru and es. The database stores the id only, so no migration is needed.
 *
 * "Add your own": the person writes a word (2 to 40 characters). They see it at once; the team's queue gets it and accepts it,
 * merges it into a listed instrument or rejects it. A word that already IS a listed instrument ("Piano") becomes its id; a word
 * almost like one ("harmonyum") is offered the listed one before it is sent. One person may bring three NEW words a week
 * (the style's "other" counts too). Rules: docs/kiirtan-recording-info.md, "Add your own".
 *
 * The search menu builds "Kiirtans for piano" from `leadInstrument === "piano"` (docs/search-menu.md, "Fields feeding categories").
 */
export const INSTRUMENT_IDS = ["guitar", "harmonium", "piano", "synthesizer", "keyboard", "tabla", "dholak", "khol", "kartal", "flute", "violin", "sitar", "esraj", "bass_guitar", "ukulele", "voice_only"] as const
export type InstrumentId = (typeof INSTRUMENT_IDS)[number]
/**
 * What the add form OFFERS (Dada, 9 Nov 2026): four instruments, then "add your own" (and the words the team accepted). The others in
 * INSTRUMENT_IDS stay valid: a recording that carries one still reads, the API still accepts it, and a typed "tabla" still becomes it.
 */
export const FORM_INSTRUMENT_IDS: readonly InstrumentId[] = ["guitar", "harmonium", "piano", "voice_only"]
export const OTHER_INSTRUMENT = "other"
/** the ones that are not acoustic: the label says so ("electronic") */
export const ELECTRONIC_INSTRUMENTS: readonly InstrumentId[] = ["synthesizer", "keyboard"]
/** length of a written name, after cleaning (the API's OTHER_MIN and OTHER_MAX) */
export const WORD_MIN = 2
export const WORD_MAX = 40
/** one person's new words a week (the API's NEW_WORDS_PER_WEEK) */
export const NEW_WORDS_PER_WEEK = 3
/** how much alike a written word and a listed one must be for the form to offer the listed one */
export const SIMILAR_RATIO = 0.85

/** The words that mean each id (English); a typed word that equals one of them IS that instrument. Same table as the API's NAMES. */
const NAMES: Record<InstrumentId, readonly string[]> = {
  guitar: ["guitar", "acoustic guitar"],
  harmonium: ["harmonium"],
  piano: ["piano"],
  synthesizer: ["synthesizer", "synth", "electronic", "synthesizer electronic"],
  keyboard: ["keyboard", "keys"],
  tabla: ["tabla"],
  dholak: ["dholak"],
  khol: ["khol", "mridanga", "mridangam", "khol mridanga"],
  kartal: ["kartal", "kartals", "kartala", "hand cymbals", "cymbals"],
  flute: ["flute", "bansuri"],
  violin: ["violin"],
  sitar: ["sitar"],
  esraj: ["esraj"],
  bass_guitar: ["bass guitar", "bass"],
  ukulele: ["ukulele"],
  voice_only: ["voice only", "a cappella", "acapella", "voice only a cappella", "no instruments"],
}

export function isInstrumentId(value: unknown): value is InstrumentId {
  return typeof value === "string" && (INSTRUMENT_IDS as readonly string[]).includes(value)
}

export function isElectronic(id: string | null | undefined): boolean {
  return (ELECTRONIC_INSTRUMENTS as readonly string[]).includes(id ?? "")
}

/** Which kinds ask for the instrument: every kind of music; Baba's Audio Discourses are speech. */
export function kindHasInstrument(kind: string | null | undefined): boolean {
  return normalizeKind(kind) !== "baba_audio"
}

/* ------------------------------------------------------------------ words */

/** The label of an id; `other` with a word shows that word. An id with no translation shows its own words, title-cased. */
export function instrumentLabel(id: string | null | undefined, other?: string | null): string {
  if (!id) return ""
  if (id === OTHER_INSTRUMENT) return (other ?? "").trim() || t("instrument.other")
  return isInstrumentId(id) ? t(`instrument.${id}` as const) : titleCase(id.replace(/_/g, " ")) || t("instrument.other")
}

/** The label with "electronic" next to the ones that are, for the chip. */
export function instrumentChipLabel(id: InstrumentId): string {
  return isElectronic(id) ? `${instrumentLabel(id)} · ${t("instrument.electronicTag")}` : instrumentLabel(id)
}

/** The picker: the listed instruments, then "Other" (which asks for a word). */
export function instrumentChoices(): { id: string; label: string }[] {
  return [...INSTRUMENT_IDS.map((id) => ({ id: id as string, label: instrumentChipLabel(id) })), { id: OTHER_INSTRUMENT, label: t("instrument.addOwn") }]
}

/** The picker of the add form: the four it offers (see FORM_INSTRUMENT_IDS); "add your own" is the picker's own row. */
export function formInstrumentChoices(): { id: string; label: string }[] {
  return FORM_INSTRUMENT_IDS.map((id) => ({ id: id as string, label: instrumentChipLabel(id) }))
}

/* ------------------------------------------------------------------ normalization */

/** A word without case, accents, punctuation and extra spaces: the identity of a word (the API's `normalized_key`). */
export function normalizedWord(text: string | null | undefined): string {
  if (!text) return ""
  const plain = text.normalize("NFKD").replace(/[̀-ͯ]/g, "")
  return plain
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 80)
}

/** The word as it is sent: one line, single spaces, cut to WORD_MAX. */
export function cleanWord(text: string | null | undefined): string {
  return (text ?? "").trim().replace(/\s+/g, " ").slice(0, WORD_MAX)
}

/** `short` below WORD_MIN letters (after cleaning), else null. (Too long cannot happen: the field is cut.) */
export function wordProblem(text: string | null | undefined): "short" | null {
  return cleanWord(text).length < WORD_MIN || normalizedWord(text).length < WORD_MIN ? "short" : null
}

/** The listed instrument a written word is ("Piano", " bass  guitar", "Mridangam"), or null. */
export function listedInstrumentFor(text: string | null | undefined): InstrumentId | null {
  const key = normalizedWord(text)
  if (!key) return null
  for (const id of INSTRUMENT_IDS) {
    if (key === normalizedWord(id.replace(/_/g, " ")) || NAMES[id].some((name) => normalizedWord(name) === key)) return id
  }
  return null
}

/** 2 x (longest common subsequence) / (both lengths): 1 for the same word, near 1 for a typo. */
export function likeness(a: string, b: string): number {
  if (!a.length || !b.length) return 0
  const row = new Array<number>(b.length + 1).fill(0)
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = 0
    for (let j = 1; j <= b.length; j += 1) {
      const above = row[j] ?? 0
      row[j] = a[i - 1] === b[j - 1] ? diagonal + 1 : Math.max(above, row[j - 1] ?? 0)
      diagonal = above
    }
  }
  return (2 * (row[b.length] ?? 0)) / (a.length + b.length)
}

/**
 * The key of the table whose words a written word is at least 85% like ("harmonyum" and harmonium), or null; a word that IS a
 * listed one is not "like" one (it is that one). One rule for every "Add your own": instrument, style, language.
 */
export function similarWord<K extends string>(text: string | null | undefined, table: Readonly<Record<K, readonly string[]>>): K | null {
  const key = normalizedWord(text)
  if (!key) return null
  let best: { ratio: number; id: K } | null = null
  for (const id of Object.keys(table) as K[]) {
    for (const name of table[id]) {
      const known = normalizedWord(name)
      if (known === key) return null
      const ratio = likeness(key, known)
      if (ratio >= SIMILAR_RATIO && (!best || ratio > best.ratio)) best = { ratio, id }
    }
  }
  return best?.id ?? null
}

/** The listed instrument a written word is at least 85% like ("harmonyum" and harmonium), or null. The form offers it as "Did you mean". */
export function similarInstrument(text: string | null | undefined): InstrumentId | null {
  if (!normalizedWord(text) || listedInstrumentFor(text)) return null
  const table = Object.fromEntries(INSTRUMENT_IDS.map((id) => [id, [id.replace(/_/g, " "), ...NAMES[id]]])) as Record<InstrumentId, string[]>
  return similarWord(text, table)
}

/* ------------------------------------------------------------------ what the form sends */

export type InstrumentValue = { instrument: string | null; instrumentOther: string }
export const NO_INSTRUMENT: InstrumentValue = { instrument: null, instrumentOther: "" }

/**
 * What the form sends: only a kind of music keeps an instrument; "other" needs a word (2 to 40 characters), a listed instrument
 * drops the word, and a word that IS a listed instrument becomes its id. `tooShort` marks "other" with no usable word.
 */
export function cleanInstrument(
  kind: string | null | undefined,
  instrument: string | null | undefined,
  other: string | null | undefined,
): { instrument: string | null; instrumentOther: string | null; tooShort: boolean } {
  if (!kindHasInstrument(kind) || !instrument) return { instrument: null, instrumentOther: null, tooShort: false }
  if (instrument !== OTHER_INSTRUMENT) return { instrument: isInstrumentId(instrument) ? instrument : null, instrumentOther: null, tooShort: false }
  const word = cleanWord(other)
  if (wordProblem(word)) return { instrument: OTHER_INSTRUMENT, instrumentOther: null, tooShort: true }
  const listed = listedInstrumentFor(word)
  return listed ? { instrument: listed, instrumentOther: null, tooShort: false } : { instrument: OTHER_INSTRUMENT, instrumentOther: word, tooShort: false }
}
