/**
 * Words for the compact key picker and the "How it will look" button (Dada, 9 Nov 2026, part 2): the one-line explanations that now
 * live inside the sheet, the line under each key in the list, and the button that opens the preview window. English is the source of
 * truth; ru and es mirror it key for key (the parity test checks it). Spread last in en.ts, ru.ts and es.ts.
 */
export const keyPickerEn = {
  "keyPicker.explain.guitar": "The chord the song comes home to, usually the last. Ignore the capo: use the chords your fingers make.",
  "keyPicker.explain.harmonium": "Sa is the note your harmonium treats as home. Anyone can move the chords to their own Sa.",
  "keyPicker.explain.piano": "The chord the song comes home to, usually the last. Anyone can move the chords to their own key.",
  "keyPicker.explain.tune": "The note this tune comes home to, for example D. Not sure? Choose Not sure.",
  "keyPicker.explain.sa": "The key that is Sa in your melody. Readers can play the notes in any key.",
  "keyPicker.explain.reader": "Sa is the key the notes start from. Easy keys put Sa on C.",
  "keyPicker.usual": "Usual chords: {chords}",
  "chordOffer.preview.button": "How it will look",
  "chordOffer.preview.button.a11y": "How it will look. Opens a window with the chart as the song page will show it.",
} as const

export const keyPickerRu: Record<keyof typeof keyPickerEn, string> = {
  "keyPicker.explain.guitar": "Аккорд, на котором песня «приходит домой», обычно последний. Каподастр не считайте: берите аккорды, которые делают пальцы.",
  "keyPicker.explain.harmonium": "Sa — нота, которую ваша фисгармония считает «домом». Любой сможет перенести аккорды на своё Sa.",
  "keyPicker.explain.piano": "Аккорд, на котором песня «приходит домой», обычно последний. Любой сможет сдвинуть аккорды в свою тональность.",
  "keyPicker.explain.tune": "Нота, на которой эта мелодия «приходит домой», например D. Не уверены? Выберите «Не знаю».",
  "keyPicker.explain.sa": "Клавиша, которая в вашей мелодии звучит как Sa. Читатель сможет сыграть ноты в любой тональности.",
  "keyPicker.explain.reader": "Sa — клавиша, от которой считаются ноты. «Лёгкие клавиши» ставят Sa на До.",
  "keyPicker.usual": "Частые аккорды: {chords}",
  "chordOffer.preview.button": "Как это будет выглядеть",
  "chordOffer.preview.button.a11y": "Как это будет выглядеть. Открывает окно с разбором таким, каким его покажет страница песни.",
}

export const keyPickerEs: Record<keyof typeof keyPickerEn, string> = {
  "keyPicker.explain.guitar": "El acorde al que vuelve la canción, normalmente el último. Ignora la cejilla: usa los acordes que hacen tus dedos.",
  "keyPicker.explain.harmonium": "Sa es la nota que tu armonio toma como casa. Cualquiera puede mover los acordes a su propio Sa.",
  "keyPicker.explain.piano": "El acorde al que vuelve la canción, normalmente el último. Cualquiera puede pasar los acordes a su propio tono.",
  "keyPicker.explain.tune": "La nota a la que vuelve esta melodía, por ejemplo D. ¿No estás seguro? Elige «No estoy seguro».",
  "keyPicker.explain.sa": "La tecla que es Sa en tu melodía. Quien lea podrá tocar las notas en cualquier tono.",
  "keyPicker.explain.reader": "Sa es la tecla desde la que cuentan las notas. Las teclas fáciles ponen Sa en Do.",
  "keyPicker.usual": "Acordes habituales: {chords}",
  "chordOffer.preview.button": "Así se verá",
  "chordOffer.preview.button.a11y": "Así se verá. Abre una ventana con el cifrado tal como lo mostrará la página de la canción.",
}
