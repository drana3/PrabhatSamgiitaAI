import { useMemo } from "react"

import { pluralForm, type Language } from "@/lib/i18n/core"
import { useLanguage } from "@/lib/i18n"
import { songPageEn, songPageEs, songPageRu } from "@/locales/songPage"

/**
 * The song page's own strings (locales/songPage.ts, also spread into locales/en.ts, ru.ts and es.ts, so the parity
 * test covers them) behind the same shape as `useT()`: `const t = usePageT(); t("songPage.tab.lyrics")`. English is
 * the source and the fallback. The page asks for keys by a union or a conditional, which this loose key type allows.
 */
type EnKey = keyof typeof songPageEn
type PluralBase<K extends string> = K extends `${infer B}_${"one" | "other"}` ? B : K
export type PageKey = PluralBase<EnKey>

const DICTIONARIES: Record<Language, Readonly<Record<string, string>>> = {
  en: songPageEn,
  ru: songPageRu,
  es: songPageEs,
}

function fill(text: string, params?: Record<string, string | number>): string {
  if (!params) return text
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => (name in params ? String(params[name]) : whole))
}

export type PageT = (key: PageKey, params?: Record<string, string | number>) => string

export function translatePage(language: Language, key: PageKey, params?: Record<string, string | number>): string {
  const count = typeof params?.count === "number" ? params.count : undefined
  const pick = (lang: Language): string | undefined => {
    const dict = DICTIONARIES[lang]
    if (count !== undefined) return dict[`${key}_${pluralForm(lang, count)}`] ?? dict[`${key}_other`] ?? dict[key]
    return dict[key]
  }
  const own = pick(language)
  if (own !== undefined) return fill(own, params)
  const fallback = pick("en")
  return fallback !== undefined ? fill(fallback, params) : key
}

export function usePageT(): PageT {
  const language = useLanguage()
  return useMemo(() => (key, params) => translatePage(language, key, params), [language])
}

/** The name of a script ("Roman", "Латиница") in the language of the app. */
export function scriptName(tr: PageT, id: "roman" | "devanagari" | "bengali"): string {
  return tr(`songPage.script.${id}`)
}
