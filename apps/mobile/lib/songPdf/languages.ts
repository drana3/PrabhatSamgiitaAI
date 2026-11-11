import { LYRIC_LANGUAGES, lyricLanguage, type LyricLanguage } from "@/lib/songPage/lyricLanguages"

/** Names of languages a song may have word meanings in that the app does not offer as a language of its own. */
const ALSO_NAMED: Record<string, { name: string; native: string }> = {
  fr: { name: "French", native: "Français" },
  de: { name: "German", native: "Deutsch" },
  it: { name: "Italian", native: "Italiano" },
  pt: { name: "Portuguese", native: "Português" },
  "pt-BR": { name: "Portuguese (Brazil)", native: "Português (Brasil)" },
  bn: { name: "Bengali", native: "বাংলা" },
  ko: { name: "Korean", native: "한국어" },
  ja: { name: "Japanese", native: "日本語" },
}

/** Adds the code at the end of the choice, or takes it out; the order of the choice is the order on the page. */
export function toggleCode(list: readonly string[], code: string): string[] {
  return list.includes(code) ? list.filter((c) => c !== code) : [...list, code]
}

export type LanguageGroups = {
  /** the languages the song really has text in, the chosen ones first (in the order chosen), then the rest in the list's order */
  inSong: LyricLanguage[]
  /** the other languages of the list: shown, not selectable, so the person sees they are coming */
  notYet: LyricLanguage[]
}

const fold = (text: string): string => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

/**
 * The rows of the language menu: split by what the song has, filtered by the search (the English or the native name,
 * the code too), the chosen ones on top of their group. `available` codes the list does not know are kept, named by the code.
 */
export function groupLanguages(available: readonly string[], chosen: readonly string[], query: string): LanguageGroups {
  const q = fold(query.trim())
  const known = new Set(LYRIC_LANGUAGES.map((l) => l.code))
  const extra = available.filter((code) => !known.has(code)).map((code) => ({ code, name: ALSO_NAMED[code]?.name ?? code, native: ALSO_NAMED[code]?.native ?? code }))
  const all = [...LYRIC_LANGUAGES, ...extra]
  const matches = (l: LyricLanguage) => !q || fold(l.name).includes(q) || fold(l.native).includes(q) || fold(l.code).includes(q)
  const rank = (l: LyricLanguage) => {
    const i = chosen.indexOf(l.code)
    return i < 0 ? chosen.length + all.indexOf(l) : i
  }
  const inSong = all.filter((l) => available.includes(l.code) && matches(l)).sort((a, b) => rank(a) - rank(b))
  const notYet = all.filter((l) => !available.includes(l.code) && matches(l))
  return { inSong, notYet }
}

/** `English · Русский`, or `English +2` when it would not fit: what the closed row says. */
export function summaryOf(chosen: readonly string[], show = 2): { names: string; more: number } {
  const names = chosen.slice(0, show).map((code) => lyricLanguage(code)?.native ?? code)
  return { names: names.join(" · "), more: Math.max(0, chosen.length - show) }
}

/**
 * The language of the PDF is the language of the app: Russian when the app is in Russian, English otherwise. The word
 * meanings and the translation come in that language; when the song has none in it yet, English stands in and `fellBack` says so.
 */
export function pdfLanguages(
  appLanguage: string,
  available: { words: readonly string[]; translations: readonly string[] },
): { language: "en" | "ru"; words: string[]; translations: string[]; fellBack: boolean } {
  const language = appLanguage === "ru" ? "ru" : "en"
  const pick = (have: readonly string[]) => (have.includes(language) ? [language] : have.includes("en") ? ["en"] : [])
  const words = pick(available.words)
  const translations = pick(available.translations)
  return { language, words, translations, fellBack: language !== "en" && (translations[0] === "en" || (available.words.length > 0 && words[0] === "en")) }
}
