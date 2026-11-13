import { cleanWord, normalizedWord, wordProblem } from "@/lib/kirtan/instruments"

/**
 * "Others" (the category formerly called "Other mantras"; the kind id `other_mantra` stays): what a recording IS is a REQUIRED single
 * choice, never a tag and never pre-selected (Dada, 9 Nov 2026). Six named ones and "Something else", where the person writes a short
 * name that the team checks like any own word (the same queue as the main instrument's own word, field `mantra`).
 *
 * The ids are the API's MANTRA_TYPES (`apps/api/app/models/recordings.py`); `pitriyajina` keeps its id from before, only its visible
 * name changed. The visible spelling of every name and its source: docs/others-category.md.
 */
export const MANTRA_IDS = ["guru_puja", "pitriyajina", "samgacchadhvam", "nityam_shuddham", "ananda_sutram", "shlokas"] as const
export type ListedMantraId = (typeof MANTRA_IDS)[number]
/** "Something else": the recording's type is `other` and `typeOther` is the name the person wrote */
export const OTHER_MANTRA = "other"

/** English words that mean each listed one (the API's MANTRA_NAMES): a typed word that equals one of them IS that choice. */
const NAMES: Record<ListedMantraId, readonly string[]> = {
  guru_puja: ["guru puja", "gurupuja", "guru pooja", "guru pujan"],
  pitriyajina: ["pitr yajina", "pitri yajna", "pitri yajina", "pitr yajna", "pitriyajina"],
  samgacchadhvam: ["samgacchadhvam", "sangacchadhvam", "sam gaccha dhvam", "samgacchadvam"],
  nityam_shuddham: ["nityam shuddham", "nityam shudham", "nityam shudam", "nityam suddham"],
  ananda_sutram: ["ananda sutram", "ananda sutra", "anandasutram"],
  shlokas: ["shlokas", "shloka", "slokas", "sloka"],
}

export function isListedMantra(value: unknown): value is ListedMantraId {
  return typeof value === "string" && (MANTRA_IDS as readonly string[]).includes(value)
}

/** Is this a type id of Others at all (a listed one or "other")? */
export function isMantraType(value: unknown): value is ListedMantraId | typeof OTHER_MANTRA {
  return value === OTHER_MANTRA || isListedMantra(value)
}

/** The listed choice a written word is ("Guru Puja", "slokas", "Nityam Shudham"), or null. */
export function listedMantraFor(text: string | null | undefined): ListedMantraId | null {
  const key = normalizedWord(text)
  if (!key) return null
  for (const id of MANTRA_IDS) {
    if (key === normalizedWord(id.replace(/_/g, " ")) || NAMES[id].some((name) => normalizedWord(name) === key)) return id
  }
  return null
}

export type MantraValue = { type: string | null; typeOther: string }
export const NO_MANTRA: MantraValue = { type: null, typeOther: "" }

/**
 * What the form sends for the kind `other_mantra`: a listed id drops the word, "other" needs a name of 2 to 40 characters (a name that
 * IS a listed choice becomes it). `missing`: nothing chosen. `tooShort`: "Something else" without a usable name. Any other kind has no
 * mantra choice at all.
 */
export function cleanMantra(
  kind: string | null | undefined,
  type: string | null | undefined,
  other: string | null | undefined,
): { type: string | null; typeOther: string | null; missing: boolean; tooShort: boolean } {
  if (kind !== "other_mantra") return { type: null, typeOther: null, missing: false, tooShort: false }
  if (!type || !isMantraType(type)) return { type: null, typeOther: null, missing: true, tooShort: false }
  if (type !== OTHER_MANTRA) return { type, typeOther: null, missing: false, tooShort: false }
  const word = cleanWord(other)
  if (wordProblem(word)) return { type: OTHER_MANTRA, typeOther: null, missing: false, tooShort: true }
  const listed = listedMantraFor(word)
  return listed ? { type: listed, typeOther: null, missing: false, tooShort: false } : { type: OTHER_MANTRA, typeOther: word, missing: false, tooShort: false }
}
