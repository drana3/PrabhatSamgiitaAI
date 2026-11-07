import { useMemo } from "react"

import { useLanguage } from "@/lib/i18n"
import type { Language } from "@/lib/i18n/core"
import { shareCardEn, shareCardEs, shareCardRu } from "@/locales/shareCard"

/**
 * The share card sheet's own strings (locales/shareCard.ts) behind the shape of `useT()`:
 * `const t = useShareCardT(); t("shareCard.save")`. English is the fallback.
 */
export type ShareCardKey = keyof typeof shareCardEn

const DICTIONARIES: Record<Language, Readonly<Record<string, string>>> = { en: shareCardEn, ru: shareCardRu, es: shareCardEs }

export function shareCardText(language: Language, key: ShareCardKey): string {
  return DICTIONARIES[language][key] ?? shareCardEn[key] ?? key
}

export type ShareCardT = (key: ShareCardKey) => string

export function useShareCardT(): ShareCardT {
  const language = useLanguage()
  return useMemo(() => (key) => shareCardText(language, key), [language])
}
