import { useMemo, useSyncExternalStore } from "react"

import {
  getActiveLanguage,
  subscribeLanguage,
  translatorFor,
  type Language,
  type TranslateFn,
} from "@/lib/i18n/core"

export {
  DEFAULT_LANGUAGE_PREFERENCE,
  FALLBACK_LANGUAGE,
  LANGUAGES,
  LANGUAGE_NATIVE_NAMES,
  LANGUAGE_PREFERENCES,
  getActiveLanguage,
  isLanguage,
  normalizeLanguagePreference,
  pluralForm,
  resolveLanguage,
  setActiveLanguage,
  t,
  translate,
  translatorFor,
  type Language,
  type LanguagePreference,
  type MessageKey,
  type TranslateFn,
} from "@/lib/i18n/core"
export {
  ALL_LANGUAGES,
  COMPLETE_LANGUAGES,
  STUB_LANGUAGES,
  SHOW_UNFINISHED_LANGUAGES,
  entryFor as languageEntry,
  hiddenLanguages,
  offeredLanguages,
  selectableLanguages,
} from "@/lib/i18n/registry"
export {
  formatBytes,
  formatDate,
  formatDateTime,
  formatNumber,
  formatTime,
  type DateStyle,
} from "@/lib/i18n/format"

/** The language the screen is showing now. Re-renders the component when the person changes it. */
export function useLanguage(): Language {
  return useSyncExternalStore(subscribeLanguage, getActiveLanguage, getActiveLanguage)
}

/**
 * `const t = useT()` in every component that shows text. The component re-renders at once when the
 * language changes. The returned function is stable for a given language.
 */
export function useT(): TranslateFn {
  const language = useLanguage()
  return useMemo(() => translatorFor(language), [language])
}
