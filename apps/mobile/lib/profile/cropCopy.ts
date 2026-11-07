import { useMemo } from "react"

import { getActiveLanguage, useLanguage } from "@/lib/i18n"
import type { Language } from "@/lib/i18n/core"
import { photoCropEn, photoCropEs, photoCropRu } from "@/locales/photoCrop"

/**
 * The crop sheet's own strings (locales/photoCrop.ts) behind the shape of `useT()`:
 * `const t = useCropT(); t("photoCrop.done")`. English is the fallback.
 */
export type CropKey = keyof typeof photoCropEn

const DICTIONARIES: Record<Language, Readonly<Record<string, string>>> = { en: photoCropEn, ru: photoCropRu, es: photoCropEs }

export function cropText(language: Language, key: CropKey): string {
  return DICTIONARIES[language][key] ?? photoCropEn[key] ?? key
}

export type CropT = (key: CropKey) => string

export function useCropT(): CropT {
  const language = useLanguage()
  return useMemo(() => (key) => cropText(language, key), [language])
}

/** For code outside React (the picker helper). */
export function cropTextNow(key: CropKey): string {
  return cropText(getActiveLanguage(), key)
}
