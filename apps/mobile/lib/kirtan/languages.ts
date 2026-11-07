import { t } from "@/lib/i18n"

/**
 * The languages a recording can be sung in: ISO 639 codes, one list, with labels in the app's three languages
 * (`lang.<code>` in locales/recordings.ts). The server keeps the same list (apps/api/app/services/recording_languages.py);
 * `__tests__/kirtanLanguages.test.ts` and `apps/api/tests/test_recording_sets_languages.py` pin the two together.
 * To add a language: add its code here and there, and a `lang.<code>` label in en, ru and es. The database stores the
 * code only, so a new language needs no migration. `other` is the escape hatch: the person names the language in free
 * text (`languageOther`, cut to 80 characters). Pure: no React, no stores.
 */

export const OTHER_LANGUAGE = "other"
export const LANGUAGE_OTHER_MAX = 80

/** (code, English name). The first ones are the languages Dada named; the picker shows them in this order. */
export const LANGUAGES: readonly { code: string; english: string }[] = [
  { code: "bn", english: "Bengali" },
  { code: "sa", english: "Sanskrit" },
  { code: "hi", english: "Hindi" },
  { code: "en", english: "English" },
  { code: "ru", english: "Russian" },
  { code: "es", english: "Spanish" },
  { code: "pt", english: "Portuguese" },
  { code: "de", english: "German" },
  { code: "fr", english: "French" },
  { code: "it", english: "Italian" },
  { code: "pl", english: "Polish" },
  { code: "uk", english: "Ukrainian" },
  { code: "ta", english: "Tamil" },
  { code: "te", english: "Telugu" },
  { code: "ne", english: "Nepali" },
  { code: "zh", english: "Chinese" },
  { code: "ja", english: "Japanese" },
  { code: "id", english: "Indonesian" },
  { code: "vi", english: "Vietnamese" },
  { code: "sw", english: "Swahili" },
  { code: "eo", english: "Esperanto" },
  { code: "ar", english: "Arabic" },
  { code: "tr", english: "Turkish" },
  { code: "nl", english: "Dutch" },
  { code: "cs", english: "Czech" },
  { code: "ko", english: "Korean" },
  { code: "th", english: "Thai" },
  { code: "ml", english: "Malayalam" },
  { code: "kn", english: "Kannada" },
  { code: "mr", english: "Marathi" },
  { code: "gu", english: "Gujarati" },
  { code: "pa", english: "Punjabi" },
  { code: "ur", english: "Urdu" },
  { code: "or", english: "Odia" },
  { code: "as", english: "Assamese" },
  { code: "mai", english: "Maithili" },
  { code: "bho", english: "Bhojpuri" },
  { code: "hu", english: "Hungarian" },
  { code: "ro", english: "Romanian" },
  { code: "bg", english: "Bulgarian" },
  { code: "sr", english: "Serbian" },
  { code: "el", english: "Greek" },
  { code: "he", english: "Hebrew" },
  { code: "fa", english: "Persian" },
  { code: "fi", english: "Finnish" },
  { code: "sv", english: "Swedish" },
  { code: "tl", english: "Tagalog" },
  { code: "my", english: "Burmese" },
  { code: "si", english: "Sinhala" },
]

export const LANGUAGE_CODES: readonly string[] = LANGUAGES.map((language) => language.code)

/** The five words the first version of the form stored; they read as the codes. */
const LEGACY_WORDS: Readonly<Record<string, string>> = { bengali: "bn", sanskrit: "sa", hindi: "hi", english: "en" }
const CODE_OF_NAME = new Map(LANGUAGES.map((language) => [language.english.toLowerCase(), language.code]))

export function isLanguageCode(value: unknown): value is string {
  return typeof value === "string" && LANGUAGE_CODES.includes(value)
}

/** The code for what a server row or an old stored item holds: a code, `other`, an English name or an old word. Anything else is null. */
export function normalizeLanguageCode(value: unknown): string | null {
  if (typeof value !== "string") return null
  const word = value.trim().toLowerCase()
  if (!word) return null
  if (word === OTHER_LANGUAGE || isLanguageCode(word)) return word
  return LEGACY_WORDS[word] ?? CODE_OF_NAME.get(word) ?? null
}

/** The free-text language name, safe to send: one line, 80 characters; empty becomes null. */
export function cleanLanguageOther(text: string | null | undefined): string | null {
  const cleaned = (text ?? "").replace(/\s+/g, " ").trim().slice(0, LANGUAGE_OTHER_MAX).trim()
  return cleaned || null
}

/** The visible name of a language in the app's language. `other` shows the person's own name for it, or "Other". */
export function languageLabel(code: string | null | undefined, other?: string | null): string {
  if (!code) return ""
  if (code === OTHER_LANGUAGE) return cleanLanguageOther(other) ?? t("lang.other")
  return isLanguageCode(code) ? (t as (key: string) => string)(`lang.${code}`) : code
}

function fold(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()
}

export type LanguageChoice = { code: string; label: string; english: string }

/**
 * The picker's list for what the person typed. It matches the code, the English name and the label in the app's
 * language, without regard to case or accents; names that START with the text come first. An empty text lists every
 * language in catalog order. "Other" is never in this list: the picker shows it as its own last row.
 */
export function searchLanguages(query: string, label: (code: string) => string = (code) => languageLabel(code)): LanguageChoice[] {
  const needle = fold(query)
  const all = LANGUAGES.map((language) => ({ code: language.code, english: language.english, label: label(language.code) }))
  if (!needle) return all
  const scored = all.flatMap((choice) => {
    const names = [fold(choice.label), fold(choice.english), choice.code]
    if (names.some((name) => name.startsWith(needle))) return [{ choice, rank: 0 }]
    if (names.some((name) => name.includes(needle))) return [{ choice, rank: 1 }]
    return []
  })
  return scored.sort((a, b) => a.rank - b.rank).map((entry) => entry.choice)
}
