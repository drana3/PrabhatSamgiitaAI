import { en } from "@/locales/en"
import { es } from "@/locales/es"
import { hi } from "@/locales/hi"
import { ko } from "@/locales/ko"
import { ptBR } from "@/locales/ptBR"
import { ru } from "@/locales/ru"
import { zhTW } from "@/locales/zhTW"
import type { Language } from "@/lib/i18n/registry"

/** A dictionary is a flat map. Plural groups use the suffixes `_one`, `_few`, `_many`, `_other`. */
export type Dictionary = Readonly<Record<string, string>>

/**
 * One dictionary per language in `lib/i18n/registry.ts`; TypeScript fails here if a registered
 * language has no entry. A stub is an empty dictionary (everything falls back to English).
 */
export const dictionaries = {
  en,
  ru,
  es,
  hi,
  "zh-TW": zhTW,
  "pt-BR": ptBR,
  ko,
} as const satisfies Record<Language, Dictionary>
