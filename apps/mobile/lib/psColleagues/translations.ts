import { COLLEAGUE_LANGS, type ColleagueLang, type WireTranslations, type WireVersion } from "./types"

/** One text of a colleague translation, ready to draw. */
export type ColleagueVersion = {
  text: string
  /** the document's own line under the title, such as "Translated from Bengali" (in the language of the document) */
  note: string | null
  /** the title line the document puts above the translation */
  title: string | null
}

export type ColleagueText = {
  lang: ColleagueLang
  /** the first is the translation, the rest are "Other version" */
  versions: ColleagueVersion[]
}

function versionOf(w: WireVersion): ColleagueVersion {
  return { text: w.t, note: w.n?.trim() || null, title: w.h?.trim() || null }
}

/** The colleague translations a song has, in the page's order (en, ru, uk, fr); empty when the archives hold none for it. */
export function colleagueTextsOf(wire: WireTranslations | null | undefined, songNumber: number | null | undefined): ColleagueText[] {
  if (!wire || songNumber == null) return []
  const entry = wire[String(songNumber)]
  if (!entry) return []
  const out: ColleagueText[] = []
  for (const lang of COLLEAGUE_LANGS) {
    const w = entry[lang]
    if (!w?.t?.trim()) continue
    out.push({ lang, versions: [versionOf(w), ...(w.x ?? []).filter((x) => x.t?.trim()).map(versionOf)] })
  }
  return out
}

/** The name of a language in its own script, as a chip says it. English is "English · colleagues" because the page already has an official English. */
export const COLLEAGUE_LANG_NAME: Record<ColleagueLang, string> = {
  en: "English",
  ru: "Русский",
  uk: "Українська",
  fr: "Français",
}

/** Id of a variant chip of the Translation page: "official", or "colleagues:ru". */
export type TranslationVariant = "official" | `colleagues:${ColleagueLang}`

export function variantOf(lang: ColleagueLang): TranslationVariant {
  return `colleagues:${lang}`
}

export function langOfVariant(variant: TranslationVariant): ColleagueLang | null {
  return variant === "official" ? null : (variant.slice("colleagues:".length) as ColleagueLang)
}

/**
 * The variant the page opens on. The reader's own choice when it is still offered; otherwise Official when the song has
 * one; otherwise the colleague text in the language of the app, else the first one there is.
 */
export function pickVariant(input: {
  chosen: TranslationVariant | null
  hasOfficial: boolean
  texts: readonly ColleagueText[]
  appLanguage: string
}): TranslationVariant {
  const { chosen, hasOfficial, texts, appLanguage } = input
  const offered = (v: TranslationVariant) => (v === "official" ? hasOfficial : texts.some((t) => variantOf(t.lang) === v))
  if (chosen && offered(chosen)) return chosen
  if (hasOfficial || texts.length === 0) return "official"
  const own = texts.find((t) => t.lang === appLanguage)
  return variantOf((own ?? texts[0]).lang)
}
