/**
 * Interface strings of the colleagues' material on the song page (components/song-page/ColleagueTranslation.tsx and
 * ColleagueChords.tsx). Kept in their own file, not in en.ts, es.ts and ru.ts. English is the source and the fallback;
 * ru and es mirror it key for key (the test in __tests__/psColleagues.test.ts checks it). The texts and chord pages
 * themselves are data, not here.
 */
export const colleaguesEn = {
  "colleagues.source": "From colleagues' collection",
  "colleagues.variants.a11y": "Translation to read",
  "colleagues.chip.en": "English · colleagues",
  "colleagues.chords.title": "Colleagues' chords",
  "colleagues.chords.from.docx": "From the colleagues' documents",
  "colleagues.chords.from.pdf": "From the PDF “{file}”",
  "colleagues.chords.capo": "Capo {capo}",
  "colleagues.chords.capo.none": "No capo",
  "colleagues.chords.capo.unstated": "Capo: not stated in the document",
  "colleagues.chords.wordsOnly.no": "Chord lines only, without the words, as in the PDF.",
  "colleagues.chords.differ": "The two sources differ in the capo or the chords. Both are shown as they are.",
  "colleagues.chords.page.a11y": "Chord page, scrolls sideways",
} as const

export const colleaguesRu: Record<keyof typeof colleaguesEn, string> = {
  "colleagues.source": "Из сборника коллег",
  "colleagues.variants.a11y": "Какой перевод читать",
  "colleagues.chip.en": "English · коллеги",
  "colleagues.chords.title": "Аккорды коллег",
  "colleagues.chords.from.docx": "Из документов коллег",
  "colleagues.chords.from.pdf": "Из PDF «{file}»",
  "colleagues.chords.capo": "Каподастр {capo}",
  "colleagues.chords.capo.none": "Без каподастра",
  "colleagues.chords.capo.unstated": "Каподастр: в документе не указан",
  "colleagues.chords.wordsOnly.no": "Только строки аккордов, без слов, как в PDF.",
  "colleagues.chords.differ": "Два источника расходятся в каподастре или аккордах. Показаны оба, как есть.",
  "colleagues.chords.page.a11y": "Страница аккордов, листается вбок",
}

export const colleaguesEs: Record<keyof typeof colleaguesEn, string> = {
  "colleagues.source": "De la colección de los colegas",
  "colleagues.variants.a11y": "Traducción para leer",
  "colleagues.chip.en": "English · colegas",
  "colleagues.chords.title": "Acordes de los colegas",
  "colleagues.chords.from.docx": "De los documentos de los colegas",
  "colleagues.chords.from.pdf": "Del PDF «{file}»",
  "colleagues.chords.capo": "Cejilla {capo}",
  "colleagues.chords.capo.none": "Sin cejilla",
  "colleagues.chords.capo.unstated": "Cejilla: no indicada en el documento",
  "colleagues.chords.wordsOnly.no": "Solo las líneas de acordes, sin la letra, como en el PDF.",
  "colleagues.chords.differ": "Las dos fuentes difieren en la cejilla o en los acordes. Se muestran las dos tal como están.",
  "colleagues.chords.page.a11y": "Página de acordes, se desplaza hacia los lados",
}
