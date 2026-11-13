/**
 * The "Instruments" block of the Learn hub (Dada, 13 November 2026): one block, one tile per instrument the app really
 * teaches, each opening its own lesson. English is the source; ru and es mirror it key for key. Spread into
 * locales/learnPage.ts, which is already spread into the main dictionaries, so the parity test covers them.
 */
export const learnInstrumentsEn = {
  "learn.inst.eyebrow": "Play along",
  "learn.inst.first": "Instruments",
  "learn.inst.second": "for the songs",
  "learn.inst.harmonium": "Harmonium",
  "learn.inst.harmonium.sub": "Find Sa and the swaras on the keys",
  "learn.inst.chords": "Chords",
  "learn.inst.chords.sub": "How chords work, three keys at once",
  "learn.inst.guitar": "Guitar",
  "learn.inst.guitar.sub": "Chord shapes and capo, on a song",
  "learn.inst.piano": "Piano",
  "learn.inst.piano.sub": "Notes on the keys, on a song",
} as const

export const learnInstrumentsRu: Readonly<Record<string, string>> = {
  "learn.inst.eyebrow": "Играйте вместе",
  "learn.inst.first": "Инструменты",
  "learn.inst.second": "для песен",
  "learn.inst.harmonium": "Фисгармония",
  "learn.inst.harmonium.sub": "Где Са и свары на клавишах",
  "learn.inst.chords": "Аккорды",
  "learn.inst.chords.sub": "Как устроены аккорды, три клавиши сразу",
  "learn.inst.guitar": "Гитара",
  "learn.inst.guitar.sub": "Формы аккордов и каподастр, на песне",
  "learn.inst.piano": "Пианино",
  "learn.inst.piano.sub": "Ноты на клавишах, на песне",
}

export const learnInstrumentsEs: Record<keyof typeof learnInstrumentsEn, string> = {
  "learn.inst.eyebrow": "Toca con ellas",
  "learn.inst.first": "Instrumentos",
  "learn.inst.second": "para las canciones",
  "learn.inst.harmonium": "Armonio",
  "learn.inst.harmonium.sub": "Encuentra Sa y los swaras en las teclas",
  "learn.inst.chords": "Acordes",
  "learn.inst.chords.sub": "Cómo funcionan los acordes, tres teclas a la vez",
  "learn.inst.guitar": "Guitarra",
  "learn.inst.guitar.sub": "Formas de acordes y cejilla, en una canción",
  "learn.inst.piano": "Piano",
  "learn.inst.piano.sub": "Notas en las teclas, en una canción",
}
