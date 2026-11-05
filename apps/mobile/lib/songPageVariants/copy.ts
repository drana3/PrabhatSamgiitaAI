import { useMemo } from "react"

import { pluralForm, type Language } from "@/lib/i18n/core"
import { useLanguage } from "@/lib/i18n"
import { songVariantsEn, songVariantsEs, songVariantsRu } from "@/locales/songVariants"

/**
 * The song page variants' own strings (locales/songVariants.ts) behind the same shape as `useT()`:
 * `const t = useVariantT(); t("songVariant.tab.lyrics")`. English is the source and the fallback.
 * Once these dictionaries are spread into locales/en.ts, ru.ts and es.ts this file can switch to `useT()`.
 */
type EnKey = keyof typeof songVariantsEn
type PluralBase<K extends string> = K extends `${infer B}_${"one" | "other"}` ? B : K
export type VariantKey = PluralBase<EnKey>

const DICTIONARIES: Record<Language, Readonly<Record<string, string>>> = {
  en: songVariantsEn,
  ru: songVariantsRu,
  es: songVariantsEs,
}

function fill(text: string, params?: Record<string, string | number>): string {
  if (!params) return text
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => (name in params ? String(params[name]) : whole))
}

export type VariantT = (key: VariantKey, params?: Record<string, string | number>) => string

export function translateVariant(language: Language, key: VariantKey, params?: Record<string, string | number>): string {
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

export function useVariantT(): VariantT {
  const language = useLanguage()
  return useMemo(() => (key, params) => translateVariant(language, key, params), [language])
}
