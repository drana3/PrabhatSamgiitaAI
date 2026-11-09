/**
 * The list of interface languages: the ONE place that says which languages exist and how each behaves
 * (docs/localization.md). Adding a language is a locale file in `locales/` plus one entry here, and
 * a line in `locales/index.ts`; nothing else in the code names a language.
 *
 * `complete: false` marks a language whose locale file is still a stub. A stub speaks English for
 * every missing key (the normal fallback), is listed in `locales/review.json` as "не переведено",
 * is hidden from the language sheet in release builds, and is never picked by "Automatic".
 * Flip it to `true` only when a person has translated and read every key.
 *
 * Pure TypeScript, no React and no native modules, so tests and `core.ts` can import it.
 */

/** How a language counts: `en` one/other (1 is one), `ru` one/few/many/other, `hi` 0 and 1 are one,
 * `pt` 0 and 1 are one, `none` no plural forms (Chinese, Korean: only "other"). CLDR names. */
export type PluralRule = "en" | "ru" | "hi" | "pt" | "none"

/** Which writing system the language needs; it decides which font is loaded (docs/localization.md). */
export type ScriptName = "latin" | "cyrillic" | "devanagari" | "han" | "hangul"

export type LanguageEntry = {
  /** the code stored on the phone; a BCP 47 tag, case as written here */
  id: string
  /** the language in its own script; never translated */
  native: string
  /** handed to Intl for numbers and dates */
  tag: string
  plural: PluralRule
  /** thousands separator and decimal mark for the hand-written number fallback */
  group: string
  decimal: string
  script: ScriptName
  /** false while the locale file is a stub */
  complete: boolean
  /** lower-case device language tags this language answers to (exact, or followed by "-") */
  deviceTags: readonly string[]
}

export const LANGUAGE_REGISTRY = [
  // The default and the fallback. Its dictionary is the source of truth for every key.
  { id: "en", native: "English", tag: "en", plural: "en", group: ",", decimal: ".", script: "latin", complete: true, deviceTags: ["en"] },
  { id: "ru", native: "Русский", tag: "ru", plural: "ru", group: " ", decimal: ",", script: "cyrillic", complete: true, deviceTags: ["ru"] },
  { id: "es", native: "Español", tag: "es", plural: "en", group: ".", decimal: ",", script: "latin", complete: true, deviceTags: ["es"] },
  // Stubs: the locale file exists, the translation does not (yet).
  { id: "hi", native: "हिन्दी", tag: "hi", plural: "hi", group: ",", decimal: ".", script: "devanagari", complete: false, deviceTags: ["hi"] },
  {
    id: "zh-TW",
    native: "繁體中文",
    tag: "zh-TW",
    plural: "none",
    group: ",",
    decimal: ".",
    script: "han",
    complete: false,
    // Traditional Chinese only. Simplified (zh, zh-Hans, zh-CN) is not offered and falls through to English.
    deviceTags: ["zh-tw", "zh-hant", "zh-hk", "zh-mo"],
  },
  { id: "pt-BR", native: "Português (Brasil)", tag: "pt-BR", plural: "pt", group: ".", decimal: ",", script: "latin", complete: false, deviceTags: ["pt"] },
  { id: "ko", native: "한국어", tag: "ko", plural: "none", group: ",", decimal: ".", script: "hangul", complete: false, deviceTags: ["ko"] },
] as const satisfies readonly LanguageEntry[]

export type Language = (typeof LANGUAGE_REGISTRY)[number]["id"]

export const DEFAULT_LANGUAGE: Language = "en"

const BY_ID = new Map<string, LanguageEntry>(LANGUAGE_REGISTRY.map((entry) => [entry.id, entry]))

export function entryFor(language: Language): LanguageEntry {
  return BY_ID.get(language) as LanguageEntry
}

export function isRegisteredLanguage(value: unknown): value is Language {
  return typeof value === "string" && BY_ID.has(value)
}

/** Every registered language, stubs included. */
export const ALL_LANGUAGES: readonly Language[] = LANGUAGE_REGISTRY.map((entry) => entry.id)

/** Languages whose translation is complete: what the parity tests hold to full key coverage. */
export const COMPLETE_LANGUAGES: readonly Language[] = LANGUAGE_REGISTRY.filter((entry) => entry.complete).map((entry) => entry.id)

/** Stubs, for the review list and the tests. */
export const STUB_LANGUAGES: readonly Language[] = LANGUAGE_REGISTRY.filter((entry) => !entry.complete).map((entry) => entry.id)

/**
 * Which of our languages a device language tag stands for ("pt-PT" is Portuguese, so pt-BR; "zh-Hant-TW"
 * is Traditional Chinese). Only complete languages unless `includeStubs`, so that "Automatic" never
 * lands on a language that would show English anyway when a later device language is translated.
 */
export function matchDeviceLanguage(tag: string, options?: { includeStubs?: boolean }): Language | null {
  const lower = tag.toLowerCase().replace(/_/g, "-")
  if (!lower) return null
  for (const entry of LANGUAGE_REGISTRY) {
    if (!entry.complete && !options?.includeStubs) continue
    if (entry.deviceTags.some((prefix) => lower === prefix || lower.startsWith(`${prefix}-`))) return entry.id
  }
  return null
}

/**
 * What a language list may offer. A language whose `complete` is false (see its entry above) is hidden
 * from EVERY list in the app (the onboarding step, Profile > Language) until it is translated and read
 * by a native speaker: flip that one `complete` to `true` and it appears in all of them. The only
 * exception is a developer build started with `EXPO_PUBLIC_SHOW_ALL_LANGUAGES=1`.
 * A person whose stored language is hidden keeps working: the app speaks English for it.
 */
export function selectableLanguages(showStubs: boolean): readonly Language[] {
  return showStubs ? ALL_LANGUAGES : COMPLETE_LANGUAGES
}

/** Developer switch to see the unfinished languages too. Off in every build unless this variable is set. */
export const SHOW_UNFINISHED_LANGUAGES = process.env.EXPO_PUBLIC_SHOW_ALL_LANGUAGES === "1"

/** The languages every list in the app offers right now (Profile > Language, the onboarding step). */
export function offeredLanguages(): readonly Language[] {
  return selectableLanguages(SHOW_UNFINISHED_LANGUAGES)
}

/** Registered but not offered yet: the ones waiting for a translation and a native reader. */
export function hiddenLanguages(): readonly Language[] {
  const offered = new Set<string>(offeredLanguages())
  return ALL_LANGUAGES.filter((id) => !offered.has(id))
}
