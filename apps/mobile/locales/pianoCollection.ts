/**
 * Words for the piano sheets read from the collection "50 PS with translation" (lib/pianoNotes/collection.ts), merged
 * into the piano words in ./pianoNotes.ts. English is the source; ru and es mirror it key for key and start unreviewed
 * by a native speaker (locales/review.json).
 */
export const pianoCollectionEn = {
  "piano.by.collection": "From the collection “50 PS”",
  "piano.version.collection": "From the 50 PS",
  "piano.collection.note": "These notes were read by a program from the printed collection “50 PS”. The team has not checked them yet. Trust your ear.",
  "piano.collection.doubts": "Places marked as uncertain: {count}.",
  "piano.collection.sa": "The program was not sure which note is Sa in this song. Check it by ear.",
  "piano.from.collection": "Start from these notes",
} as const

export const pianoCollectionRu: Record<keyof typeof pianoCollectionEn, string> = {
  "piano.by.collection": "Из сборника «50 ПС»",
  "piano.version.collection": "Из сборника 50 ПС",
  "piano.collection.note": "Эти ноты программа считала с печатного сборника «50 ПС». Команда их ещё не проверила. Доверяйте слуху.",
  "piano.collection.doubts": "Мест, помеченных как сомнительные: {count}.",
  "piano.collection.sa": "Программа не уверена, какая нота в этой песне Sa. Проверьте на слух.",
  "piano.from.collection": "Начать с этих нот",
}

export const pianoCollectionEs: Record<keyof typeof pianoCollectionEn, string> = {
  "piano.by.collection": "Del cuadernillo «50 PS»",
  "piano.version.collection": "Del cuadernillo 50 PS",
  "piano.collection.note": "Un programa leyó estas notas del cuadernillo impreso «50 PS». El equipo todavía no las ha revisado. Confía en tu oído.",
  "piano.collection.doubts": "Lugares marcados como dudosos: {count}.",
  "piano.collection.sa": "El programa no está seguro de cuál es el Sa en esta canción. Compruébalo de oído.",
  "piano.from.collection": "Empezar con estas notas",
}
