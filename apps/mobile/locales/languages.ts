/**
 * Names of the interface languages, shown under each language's own name in Profile, Language, and the
 * "not translated yet" line. English is the source; ru and es mirror it key for key. Adding a language
 * adds one `language.name.<id>` here. See docs/localization.md.
 */
export const languagesEn = {
  "language.name.hi": "Hindi",
  "language.name.zh-TW": "Chinese (Traditional, Taiwan)",
  "language.name.pt-BR": "Portuguese (Brazil)",
  "language.name.ko": "Korean",
  "language.stub": "Not translated yet. The app shows English.",
} as const

export const languagesEs = {
  "language.name.hi": "Hindi",
  "language.name.zh-TW": "Chino (tradicional, Taiwán)",
  "language.name.pt-BR": "Portugués (Brasil)",
  "language.name.ko": "Coreano",
  "language.stub": "Aún sin traducir. La app se muestra en inglés.",
} as const

export const languagesRu = {
  "language.name.hi": "Хинди",
  "language.name.zh-TW": "Китайский (традиционный, Тайвань)",
  "language.name.pt-BR": "Португальский (Бразилия)",
  "language.name.ko": "Корейский",
  "language.stub": "Пока не переведено. Приложение показывает английский.",
} as const
