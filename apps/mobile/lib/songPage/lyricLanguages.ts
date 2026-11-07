/**
 * The languages a listener can choose for the lyrics: "Translation" (the line under each line),
 * "Word meanings" (the gloss under each word) and the translation chips of the song page. One list
 * for all of them, so the full player and the song page can not offer different languages.
 *
 * The codes are the ones the translation API already speaks (constants/languages.ts): Chinese is
 * `zh-CN` (Simplified) and `zh-TW` (Traditional, Taiwan).
 *
 * Pure: no React, no stores. `resolveLyricLanguage` turns a saved choice into the language to show;
 * `pickShown` says what a song can really show for it, so the screen never shows another language
 * under the wrong name and never invents text.
 */

export type LyricLanguage = {
  code: string
  /** English name */
  name: string
  /** the name in its own script, as the picker shows it */
  native: string
}

export const LYRIC_LANGUAGES: readonly LyricLanguage[] = [
  { code: "en", name: "English", native: "English" },
  { code: "ru", name: "Russian", native: "Русский" },
  { code: "es", name: "Spanish", native: "Español" },
  { code: "zh-CN", name: "Chinese (Simplified)", native: "简体中文" },
  { code: "zh-TW", name: "Chinese (Traditional, Taiwan)", native: "繁體中文 (台灣)" },
  // Hindi has real meanings in the catalogue today (hindiMeaning), so it stays, after the five.
  { code: "hi", name: "Hindi", native: "हिन्दी" },
]

export const LYRIC_LANGUAGE_CODES: readonly string[] = LYRIC_LANGUAGES.map((language) => language.code)

/** The language the song data is written in; always the fallback. */
export const SOURCE_LANGUAGE = "en"

/** The saved value of a choice that has not been made: follow the language of the app. */
export const FOLLOW_APP = "auto"
/** The saved value of "no translation" / "no word meanings". */
export const OFF = "off"

export function isLyricLanguage(code: unknown): code is string {
  return typeof code === "string" && LYRIC_LANGUAGE_CODES.includes(code)
}

export function lyricLanguage(code: string): LyricLanguage | null {
  return LYRIC_LANGUAGES.find((language) => language.code === code) ?? null
}

/** English name for sentences ("Not available in Russian yet"); the code itself when it is not in the list. */
export function lyricLanguageName(code: string): string {
  return lyricLanguage(code)?.name ?? code
}

/** `Русский · Russian` in the picker; `English` alone when both names are the same. */
export function lyricLanguageTitle(code: string): string {
  const language = lyricLanguage(code)
  if (!language) return code
  return language.native === language.name ? language.name : `${language.native} · ${language.name}`
}

/** Short mark for pills: `EN`, `RU`, `ZH-CN`. */
export function lyricShortCode(code: string): string {
  return code.toUpperCase()
}

/** The language to show when nothing was chosen: the app's own language when it is offered, else English. */
export function defaultLyricLanguage(appLanguage: string | null | undefined): string {
  const base = (appLanguage ?? "").toLowerCase().split(/[-_]/)[0]
  return isLyricLanguage(base) ? base : SOURCE_LANGUAGE
}

/** A saved choice (`null`, "auto", a language) as the language to show. A code that is no longer offered falls back to the default. */
export function resolveLyricLanguage(choice: string | null | undefined, appLanguage: string | null | undefined): string {
  return isLyricLanguage(choice) ? choice : defaultLyricLanguage(appLanguage)
}

/** A saved choice that may also be Off: returns `"off"` or a language code. */
export function resolveLyricChoice(choice: string | null | undefined, appLanguage: string | null | undefined): string {
  return choice === OFF ? OFF : resolveLyricLanguage(choice, appLanguage)
}

/** Make a stored value safe: Off, a known language, or "follow the app". Anything else (an old "fr") follows the app. */
export function normalizeLyricChoice(value: unknown): string {
  return value === OFF ? OFF : isLyricLanguage(value) ? value : FOLLOW_APP
}

/**
 * v1 of the player store kept `translation: "en" | "ru" | "off"` and `wordMeanings: boolean`. The old
 * defaults (English, On) mean "follow the app"; an explicit Russian or Off stays as it was.
 */
export function migratePlayerLanguages(persisted: unknown): unknown {
  const old = (persisted ?? {}) as Record<string, unknown>
  const translation = old.translation === "ru" ? "ru" : old.translation === OFF ? OFF : FOLLOW_APP
  const wordLanguage = old.wordMeanings === false ? OFF : FOLLOW_APP
  const { wordMeanings: _dropped, ...rest } = old
  return { ...rest, translation, wordLanguage }
}

export type ShownLanguage = {
  /** the language the person asked for */
  wanted: string
  /** the language whose text is really on screen; null when the song has nothing at all */
  shown: string | null
  /** true when `shown` is not what was asked for (English instead of Russian, or nothing) */
  gap: boolean
}

/**
 * What a song can show for a wanted language. `has(code)` says whether the song has real text in
 * that language. English is the fallback; when the song has no English either, nothing is shown.
 */
export function pickShown(wanted: string, has: (code: string) => boolean): ShownLanguage {
  if (has(wanted)) return { wanted, shown: wanted, gap: false }
  if (wanted !== SOURCE_LANGUAGE && has(SOURCE_LANGUAGE)) return { wanted, shown: SOURCE_LANGUAGE, gap: true }
  return { wanted, shown: null, gap: true }
}

/** The honest line under a setting or a card when the song lacks the language. */
export function gapNotice(pick: Pick<ShownLanguage, "wanted" | "shown">): string {
  const name = lyricLanguageName(pick.wanted)
  return pick.shown ? `Not available in ${name} yet. Showing ${lyricLanguageName(pick.shown)}.` : `Not available in ${name} yet.`
}

export const REQUEST_LABEL = "Request"
export const REQUESTED_LABEL = "Requested"
export const REQUEST_TOAST = "Requested. We will tell you when it is added."

/** One row of a language picker. `state` is a short hint under the name for the current song. */
export type LanguageChoiceRow = {
  code: string
  title: string
  name: string
  native: string
  state: "available" | "missing"
}

export function languageChoiceRows(has: (code: string) => boolean): LanguageChoiceRow[] {
  return LYRIC_LANGUAGES.map((language) => ({
    code: language.code,
    title: lyricLanguageTitle(language.code),
    name: language.name,
    native: language.native,
    state: has(language.code) ? "available" : "missing",
  }))
}

/** Languages under each line: the saved ones that are still offered, or the app language when none was chosen. */
export function effectiveTranslations(stored: readonly string[] | null | undefined, appLanguage: string | null | undefined): string[] {
  const chosen = (stored ?? []).filter((code, i, all) => isLyricLanguage(code) && all.indexOf(code) === i)
  return chosen.length ? chosen : [defaultLyricLanguage(appLanguage)]
}

/** Stored translations made safe: only offered languages, no duplicates, at most `max`. Empty means "follow the app". */
export function normalizeStoredTranslations(value: unknown, max: number): string[] {
  const list = Array.isArray(value) ? value.filter((c): c is string => isLyricLanguage(c)) : []
  return list.filter((c, i) => list.indexOf(c) === i).slice(-max)
}

/**
 * v1 of the song page store saved `translations: ["en"]` as its default, so a saved English alone
 * cannot be told from "never chose". It becomes "follow the app" (an empty list); anything else stays.
 */
export function migrateSongPageLanguages(persisted: unknown): unknown {
  const old = (persisted ?? {}) as Record<string, unknown>
  const list = Array.isArray(old.translations) ? old.translations : []
  const translations = list.length === 1 && list[0] === SOURCE_LANGUAGE ? [] : list
  return { ...old, translations }
}

export type LyricGap = {
  kind: "translation" | "words"
  /** the language the person asked for */
  wanted: string
  /** the language on screen instead (English), or null when the song has nothing */
  shown: string | null
  /** `Not available in Russian yet. Showing English.` */
  text: string
}

/**
 * The gaps of the two player settings for the song on screen: a language is asked for and the song
 * lacks it. Off never has a gap. One entry per setting that has one.
 */
export function lyricGaps(input: {
  translation: string
  wordLanguage: string
  hasTranslationIn: (code: string) => boolean
  hasWordMeaningsIn: (code: string) => boolean
}): LyricGap[] {
  const gaps: LyricGap[] = []
  const add = (kind: LyricGap["kind"], wanted: string, has: (code: string) => boolean) => {
    if (wanted === OFF) return
    const pick = pickShown(wanted, has)
    if (pick.gap) gaps.push({ kind, wanted, shown: pick.shown, text: gapNotice(pick) })
  }
  add("translation", input.translation, input.hasTranslationIn)
  add("words", input.wordLanguage, input.hasWordMeaningsIn)
  return gaps
}
