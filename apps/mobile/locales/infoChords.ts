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

  // Chords tab: the switch between versions of the chords (the song's own, the colleagues', each member's)
  "songChords.version.a11y": "Version of the chords",
  "songChords.version.main": "Main",
  "songChords.version.colleagues": "Colleagues",
  "songChords.version.colleaguesPdf": "Colleagues · PDF",
  "songChords.version.offer": "Offer chords",
  "songChords.apart.title": "Chords as a separate list",
  "songChords.apart.note": "These chords could not be laid over the lines of the song without guessing, so they are shown as the document wrote them.",
} as const

export const infoChordsRu: Readonly<Record<string, string>> = {
  "songInfo.datePlace": "Дата и место",
  "songInfo.datePlace.source": "Из документов коллег",
  "songInfo.collections": "В коллекциях",
  "songInfo.collection.a11y": "Открыть коллекцию {name}",

  "songChords.script.a11y": "Письмо слов",
  "songChords.script.roman": "Roman",
  "songChords.script.devanagari": "Devanagari",

  "songChords.version.a11y": "Версия аккордов",
  "songChords.version.main": "Основная",
  "songChords.version.colleagues": "Коллеги",
  "songChords.version.colleaguesPdf": "Коллеги · PDF",
  "songChords.version.offer": "Предложить аккорды",
  "songChords.apart.title": "Аккорды отдельным списком",
  "songChords.apart.note": "Эти аккорды нельзя честно положить на строки песни без догадок, поэтому они показаны так, как их написал документ.",
}

export const infoChordsEs: Record<keyof typeof infoChordsEn, string> = {
  "songInfo.datePlace": "Fecha y lugar",
  "songInfo.datePlace.source": "De los documentos de los colegas",
  "songInfo.collections": "En colecciones",
  "songInfo.collection.a11y": "Abrir la colección {name}",

  "songChords.script.a11y": "Escritura de las palabras",
  "songChords.script.roman": "Roman",
  "songChords.script.devanagari": "Devanagari",

  "songChords.version.a11y": "Versión de los acordes",
  "songChords.version.main": "Principal",
  "songChords.version.colleagues": "Colegas",
  "songChords.version.colleaguesPdf": "Colegas · PDF",
  "songChords.version.offer": "Ofrecer acordes",
  "songChords.apart.title": "Acordes en una lista aparte",
  "songChords.apart.note": "Estos acordes no se pueden poner sobre las líneas de la canción sin adivinar, así que se muestran como los escribió el documento.",
}
