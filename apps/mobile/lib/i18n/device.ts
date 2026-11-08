/**
 * Device language tags ("ru-RU", "zh-Hant-TW", "pt-BR"), best first. Device language detection. `expo-localization` is required lazily inside try/catch so that tests
 * (plain Node, no native modules) and a build without the module both fall back to English.
 */
export function getDeviceLanguageCodes(): string[] {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("expo-localization") as {
      getLocales?: () => Array<{ languageTag?: string | null; languageCode?: string | null }>
    }
    const locales = mod.getLocales?.() ?? []
    return locales.map((locale) => locale.languageTag ?? locale.languageCode ?? "").filter(Boolean)
  } catch {
    return []
  }
}
