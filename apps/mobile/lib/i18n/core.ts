import { dictionaries, type Dictionary } from "@/locales"
import type { en } from "@/locales/en"
import {
  ALL_LANGUAGES,
  COMPLETE_LANGUAGES,
  DEFAULT_LANGUAGE,
  LANGUAGE_REGISTRY,
  entryFor,
  isRegisteredLanguage,
  matchDeviceLanguage,
  type Language,
  type PluralRule,
} from "@/lib/i18n/registry"

/**
 * The translation core. Pure TypeScript: no React, no storage, no native modules, so every
 * `lib/` helper and every test can import it. English is the source of truth and the fallback.
 *
 * The active language lives in this module (a variable plus subscribers). The persisted choice
 * (`stores/languageStore.ts`) and the React hook (`lib/i18n/index.ts`) sit on top of it. Until the
 * app (or a test) calls `setActiveLanguage`, the language is English, which is what tests rely on.
 */

export type { Language } from "@/lib/i18n/registry"
export type LanguagePreference = "auto" | Language

/**
 * The LANGUAGES with a finished translation, in the order the sheet lists them. Stubs are in
 * `ALL_LANGUAGES` (registry.ts) and are not here, so every test that walks LANGUAGES holds only
 * finished languages to full key coverage.
 */
export const LANGUAGES: readonly Language[] = COMPLETE_LANGUAGES
export const FALLBACK_LANGUAGE: Language = DEFAULT_LANGUAGE
export const LANGUAGE_PREFERENCES: readonly LanguagePreference[] = ["auto", ...ALL_LANGUAGES]

/**
 * What a new install starts with. ALWAYS English, whatever the phone speaks: the person chooses
 * another language (or "Automatic") in Profile, Language. An old saved "auto" is kept as chosen.
 */
export const DEFAULT_LANGUAGE_PREFERENCE: LanguagePreference = DEFAULT_LANGUAGE

/** Each language in its own script. Never translated. */
export const LANGUAGE_NATIVE_NAMES = Object.fromEntries(
  LANGUAGE_REGISTRY.map((entry) => [entry.id, entry.native]),
) as Record<Language, string>

/** BCP 47 tags handed to Intl. */
export const LOCALE_TAGS = Object.fromEntries(LANGUAGE_REGISTRY.map((entry) => [entry.id, entry.tag])) as Record<
  Language,
  string
>

export function isLanguage(value: unknown): value is Language {
  return isRegisteredLanguage(value)
}

export function normalizeLanguagePreference(value: unknown): LanguagePreference {
  return value === "auto" || isLanguage(value) ? value : DEFAULT_LANGUAGE_PREFERENCE
}

/** The language for a preference. Under "auto": the first device language we have finished, else English. */
export function resolveLanguage(preference: LanguagePreference, deviceCodes: readonly string[]): Language {
  if (preference !== "auto") return preference
  for (const code of deviceCodes) {
    const match = matchDeviceLanguage(code)
    if (match) return match
  }
  return FALLBACK_LANGUAGE
}

/* ------------------------------------------------------------------ plurals */

export type PluralForm = "zero" | "one" | "two" | "few" | "many" | "other"

export const PLURAL_FORM_NAMES: readonly PluralForm[] = ["zero", "one", "two", "few", "many", "other"]

/** The forms a dictionary must provide for every counted string, per plural rule (CLDR). */
const FORMS_BY_RULE: Record<PluralRule, readonly PluralForm[]> = {
  en: ["one", "other"],
  hi: ["one", "other"],
  pt: ["one", "other"],
  ru: ["one", "few", "many", "other"],
  none: ["other"],
}

/**
 * Russian: one, few, many, other (other is for fractions). English and Spanish: one, other. Hindi and
 * Portuguese: one, other (0 and 1 are "one"). Chinese and Korean: other only.
 * We do not use `Intl.PluralRules`: Hermes does not ship it on every platform, and these rules
 * are short enough to own.
 */
export const REQUIRED_PLURAL_FORMS = Object.fromEntries(
  LANGUAGE_REGISTRY.map((entry) => [entry.id, FORMS_BY_RULE[entry.plural]]),
) as Record<Language, readonly PluralForm[]>

export function pluralForm(language: Language, count: number): PluralForm {
  const n = Math.abs(count)
  switch (entryFor(language).plural) {
    case "ru": {
      if (!Number.isInteger(n)) return "other"
      const mod10 = n % 10
      const mod100 = n % 100
      if (mod10 === 1 && mod100 !== 11) return "one"
      if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "few"
      return "many"
    }
    case "hi":
    case "pt":
      return Math.floor(n) <= 1 ? "one" : "other"
    case "none":
      return "other"
    default:
      return n === 1 ? "one" : "other"
  }
}

/* ------------------------------------------------------------------ keys and params */

type EnDictionary = typeof en
type PluralSuffix = "zero" | "one" | "two" | "few" | "many" | "other"
type StripPlural<K extends string> = K extends `${infer B}_${PluralSuffix}` ? B : K

/** Every key a screen may ask for: the English keys, with plural suffixes folded into the base name. */
export type MessageKey = StripPlural<Extract<keyof EnDictionary, string>>

type RawFor<K extends string> = K extends keyof EnDictionary
  ? EnDictionary[K]
  : `${K}_other` extends keyof EnDictionary
    ? EnDictionary[`${K}_other`]
    : never

type VarNames<S> = S extends `${string}{${infer N}}${infer R}` ? N | VarNames<R> : never

export type MessageParams<K extends MessageKey> = [VarNames<RawFor<K>>] extends [never]
  ? undefined
  : { [N in VarNames<RawFor<K>>]: string | number }

/** Arguments after the key: required when the English string has `{variables}`. */
export type MessageArgs<K extends MessageKey> = [VarNames<RawFor<K>>] extends [never]
  ? [params?: undefined]
  : [params: MessageParams<K>]

export type TranslateFn = <K extends MessageKey>(key: K, ...args: MessageArgs<K>) => string

/* ------------------------------------------------------------------ number formatting (also used by interpolation) */


/** Locale-aware number; falls back to a hand-written grouping when Intl is missing or throws. */
export function formatNumberFor(
  language: Language,
  value: number,
  options?: { maximumFractionDigits?: number; minimumFractionDigits?: number },
): string {
  if (!Number.isFinite(value)) return String(value)
  try {
    if (typeof Intl !== "undefined" && typeof Intl.NumberFormat === "function") {
      return new Intl.NumberFormat(LOCALE_TAGS[language], options).format(value)
    }
  } catch {
    // fall through to the manual path
  }
  const max = options?.maximumFractionDigits ?? (Number.isInteger(value) ? 0 : 3)
  const min = options?.minimumFractionDigits ?? 0
  let fixed = Math.abs(value).toFixed(max)
  if (fixed.includes(".")) {
    let [whole, frac] = fixed.split(".") as [string, string]
    while (frac.length > min && frac.endsWith("0")) frac = frac.slice(0, -1)
    fixed = frac ? `${whole}.${frac}` : whole
  }
  const [whole = "0", frac] = fixed.split(".")
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, entryFor(language).group)
  const body = frac ? `${grouped}${entryFor(language).decimal}${frac}` : grouped
  return value < 0 ? `-${body}` : body
}

/* ------------------------------------------------------------------ lookup */

const warned = new Set<string>()
function warnOnce(message: string) {
  if (warned.has(message)) return
  warned.add(message)
  const dev = (globalThis as { __DEV__?: boolean }).__DEV__
  if (dev) console.warn(`[i18n] ${message}`)
}

function lookup(dict: Dictionary, language: Language, key: string, count: number | undefined): string | undefined {
  if (count !== undefined) {
    const form = pluralForm(language, count)
    const exact = dict[`${key}_${form}`]
    if (exact !== undefined) return exact
    // a language may omit a form it never uses; "other" is the catch-all
    const other = dict[`${key}_other`]
    if (other !== undefined) return other
  }
  return dict[key]
}

function interpolate(language: Language, template: string, params: Record<string, string | number> | undefined): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = params[name]
    if (value === undefined) return whole
    // only {count} is formatted for the language (12 345); any other number prints as it is (song numbers, years)
    if (typeof value !== "number") return value
    return name === "count" ? formatNumberFor(language, value) : String(value)
  })
}

/** Look up `key` in `language`, fall back to English, interpolate. Returns the key itself if nothing matches. */
export function translate(
  language: Language,
  key: string,
  params?: Record<string, string | number>,
): string {
  const count = typeof params?.count === "number" ? params.count : undefined
  const own = lookup(dictionaries[language], language, key, count)
  if (own !== undefined) return interpolate(language, own, params)
  if (language !== FALLBACK_LANGUAGE) {
    const fallback = lookup(dictionaries[FALLBACK_LANGUAGE], FALLBACK_LANGUAGE, key, count)
    if (fallback !== undefined) {
      warnOnce(`"${key}" is missing in ${language}`)
      // plural forms follow the English rule here, because the text is English
      return interpolate(FALLBACK_LANGUAGE, fallback, params)
    }
  }
  warnOnce(`unknown key "${key}"`)
  return key
}

const translators = new Map<Language, TranslateFn>()

/** A `t` bound to one language. Stable per language, so it is safe in dependency lists. */
export function translatorFor(language: Language): TranslateFn {
  let fn = translators.get(language)
  if (!fn) {
    fn = ((key: string, params?: Record<string, string | number>) =>
      translate(language, key, params)) as TranslateFn
    translators.set(language, fn)
  }
  return fn
}

/* ------------------------------------------------------------------ active language */

let active: Language = FALLBACK_LANGUAGE
const listeners = new Set<() => void>()

export function getActiveLanguage(): Language {
  return active
}

export function setActiveLanguage(language: Language): void {
  if (language === active) return
  active = language
  for (const listener of [...listeners]) listener()
}

export function subscribeLanguage(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Plain `t()` for code that is not a React component: reads the active language at call time. */
export const t: TranslateFn = ((key: string, params?: Record<string, string | number>) =>
  translate(active, key, params)) as TranslateFn
