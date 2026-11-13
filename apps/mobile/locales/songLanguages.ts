/**
 * Strings of the language menu opened from the Aa window (decision of 11 November 2026). Merged into locales/songPage.ts,
 * which is already spread into locales/en.ts, ru.ts and es.ts, so the parity test covers them. English is the source.
 */
export const songLanguagesEn = {
  "lang.title": "Languages",
  "lang.layer.words": "Word meanings",
  "lang.layer.translation": "Translation",
  "lang.search": "Search languages",
  "lang.inSong": "In this song",
  "lang.notYet": "Not in this song yet",
  "lang.more": "+{count}",
  "lang.done": "Done",
  "lang.back": "Back",
  "lang.empty": "No language matches.",
} as const

export const songLanguagesRu: Readonly<Record<string, string>> = {
  "lang.title": "Языки",
  "lang.layer.words": "Значение слов",
  "lang.layer.translation": "Перевод",
  "lang.search": "Найти язык",
  "lang.inSong": "Есть для этой песни",
  "lang.notYet": "Для этой песни пока нет",
  "lang.more": "+{count}",
  "lang.done": "Готово",
  "lang.back": "Назад",
  "lang.empty": "Такого языка нет в списке.",
}

export const songLanguagesEs: Record<keyof typeof songLanguagesEn, string> = {
  "lang.title": "Idiomas",
  "lang.layer.words": "Significado de las palabras",
  "lang.layer.translation": "Traducción",
  "lang.search": "Buscar idioma",
  "lang.inSong": "En esta canción",
  "lang.notYet": "Aún no en esta canción",
  "lang.more": "+{count}",
  "lang.done": "Listo",
  "lang.back": "Atrás",
  "lang.empty": "Ningún idioma coincide.",
}
