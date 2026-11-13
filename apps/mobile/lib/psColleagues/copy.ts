import { useMemo } from "react"

import { useLanguage } from "@/lib/i18n"
import type { Language } from "@/lib/i18n/core"
import { colleaguesEn, colleaguesEs, colleaguesRu } from "@/locales/colleagues"

export type ColleagueKey = keyof typeof colleaguesEn
export type ColleagueT = (key: ColleagueKey, params?: Record<string, string | number>) => string

// the other app languages fall back to English (their strings are not written yet)
const DICTIONARIES: Partial<Record<Language, Readonly<Record<string, string>>>> = { en: colleaguesEn, ru: colleaguesRu, es: colleaguesEs }

export function translateColleague(language: Language, key: ColleagueKey, params?: Record<string, string | number>): string {
  const text = DICTIONARIES[language]?.[key] ?? colleaguesEn[key]
  return params ? text.replace(/\{(\w+)\}/g, (whole, name: string) => (name in params ? String(params[name]) : whole)) : text
}

/** `const tc = useColleagueT(); tc("colleagues.source")`: English is the fallback. */
export function useColleagueT(): ColleagueT {
  const language = useLanguage()
  return useMemo(() => (key, params) => translateColleague(language, key, params), [language])
}
