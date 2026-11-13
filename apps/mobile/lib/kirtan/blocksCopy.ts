import { useMemo } from "react"

import { useLanguage } from "@/lib/i18n"
import type { Language } from "@/lib/i18n/core"
import { kiirtanBlocksEn, kiirtanBlocksEs, kiirtanBlocksRu } from "@/locales/kiirtanBlocks"

/**
 * The strings of the blocks added on 13 Nov 2026 (locales/kiirtanBlocks.ts) behind the shape of `useT()`:
 * `const t = useBlocksT(); t("kb.audio.listen")`. English is the fallback for a language without its own words.
 */
export type BlocksKey = keyof typeof kiirtanBlocksEn

const DICTIONARIES: Partial<Record<Language, Readonly<Record<string, string>>>> = { en: kiirtanBlocksEn, ru: kiirtanBlocksRu, es: kiirtanBlocksEs }

export function blocksText(language: Language, key: BlocksKey, vars?: Record<string, string | number>): string {
  const raw = DICTIONARIES[language]?.[key] ?? kiirtanBlocksEn[key] ?? key
  return vars ? raw.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? "")) : raw
}

export type BlocksT = (key: BlocksKey, vars?: Record<string, string | number>) => string

export function useBlocksT(): BlocksT {
  const language = useLanguage()
  return useMemo(() => (key, vars) => blocksText(language, key, vars), [language])
}
