/**
 * Strings of the Info tab's date, place and collections rows and of the Chords tab's script switch (13 November 2026).
 * Kept in their own file and merged into locales/songPage.ts (already spread into en.ts, ru.ts and es.ts), so the parity
 * test covers them. English is the source. "Kiirtan" is always written with two i's (none is used here).
 */
export const infoChordsEn = {
  // Info tab
  "songInfo.datePlace": "Date and place",
  "songInfo.datePlace.source": "From the colleagues' documents",
  "songInfo.collections": "In collections",
  "songInfo.collection.a11y": "Open the collection {name}",

  // Chords tab: the script of the words under the chord letters (Roman unless the reader chooses otherwise here)
  "songChords.script.a11y": "Script of the words",
  "songChords.script.roman": "Roman",
  "songChords.script.devanagari": "Devanagari",
} as const

export const infoChordsRu: Readonly<Record<string, string>> = {
  "songInfo.datePlace": "Дата и место",
  "songInfo.datePlace.source": "Из документов коллег",
  "songInfo.collections": "В коллекциях",
  "songInfo.collection.a11y": "Открыть коллекцию {name}",

  "songChords.script.a11y": "Письмо слов",
  "songChords.script.roman": "Roman",
  "songChords.script.devanagari": "Devanagari",
}

export const infoChordsEs: Record<keyof typeof infoChordsEn, string> = {
  "songInfo.datePlace": "Fecha y lugar",
  "songInfo.datePlace.source": "De los documentos de los colegas",
  "songInfo.collections": "En colecciones",
  "songInfo.collection.a11y": "Abrir la colección {name}",

  "songChords.script.a11y": "Escritura de las palabras",
  "songChords.script.roman": "Roman",
  "songChords.script.devanagari": "Devanagari",
}
