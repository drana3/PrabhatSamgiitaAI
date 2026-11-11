/**
 * Strings of the song page's tabs, the row of icons, "Add to learning" and the player's "About this song" button
 * (decision of 10 November 2026). They are merged into locales/songPage.ts, which is already spread into locales/en.ts,
 * ru.ts and es.ts, so the parity test covers them and no foreign file had to change. English is the source.
 * "Kiirtan" is always written with two i's (none is used here).
 */
export const songTabsEn = {
  // the player's "i" button
  "player.about.button": "About this song",
  "player.about.hint": "Tap the i to read about this song",

  // the five tabs; Lyrics, Chords and Video keep the page's older words
  "songTabs.meaning": "Meaning",
  "songTabs.info": "Info",

  // Meaning tab: the word by word language (its choice lives behind the Aa button), the small line that names it
  "songWords.language.title": "Word by word language",
  "songWords.language.now": "Meanings in {language}",

  // Video tab
  "songVideo.add": "Add a video",
  "songVideo.open.a11y": "Open on {site}",
  "songVideo.report.a11y": "Report this video",
  "songVideo.note": "Videos open on their own sites. The team does not host or check them.",

  // the window "Chords by members": one card for each chart
  "songMembers.you": "You",
  "songMembers.anonymous": "Anonymous",
  "songMembers.pending": "Waiting for review",
  "songMembers.show.a11y": "{name}, {meta}. Show this chart",
  "songMembers.hide.a11y": "{name}, {meta}. Hide this chart",

  // the row of icons under the title: the word under each icon, what a tap does, the spoken label
  "songAct.save.caption": "Save",
  "songAct.saved.caption": "Saved",
  "songAct.saved.help": "Puts the song in Mine. When it is saved, tap again to change where it is kept.",
  "songAct.saved.a11y.off": "Save to Mine",
  "songAct.saved.a11y.on": "Saved. Change where it is kept",
  "songAct.download.caption": "Download",
  "songAct.download.caption.busy": "{percent}%",
  "songAct.download.caption.done": "Downloaded",
  "songAct.download.help": "Keeps the song on this phone so it plays without internet.",
  "songAct.playlist.caption": "Playlist",
  "songAct.playlist.a11y": "Add to playlist",
  "songAct.playlist.help": "Pick a playlist or make a new one.",
  "songAct.share.caption": "Share",
  "songAct.share.a11y": "Share this song",
  "songAct.share.help": "Send the song to a friend.",
  "songAct.more.caption": "More",
  "songAct.more.a11y": "More actions",
  "songAct.more.help": "Queue, collection, report a problem.",
  "songAct.play": "Play",
  "songAct.pause": "Pause",

  // the recordings row under the header
  "songRec.row_one": "{count} recording",
  "songRec.row_other": "{count} recordings",
  "songRec.open": "open in the player",

  // Learn
  "songLearn.add": "Add to learning",
  "songPage.learn.add.a11y": "Add PS {number} to your Learn list",
  "songPage.learn.added": "PS {number} added to Learn",
  "songPage.learn.in": "In your Learn list",
  "songPage.learn.in.a11y": "PS {number} is in your Learn list. Open its learning path",
  "songPage.learn.open": "Open",

  // Lyrics tab: where the translation is
  "songLyr.where": "The translation of the song is in the Meaning tab.",
  "songLyr.where.open": "Open Meaning",

  // Words tab
  "songWords.mode.a11y": "What to show",
  "songWords.mode.translation": "Translation",
  "songWords.mode.words": "Word by word",

  // Chords tab
  "songChords.shapes": "Shapes to play",
  "songChords.lines": "Chords over the words",
  "songChords.sounds": "Sounds in {key}",
  "songChords.capo": "Capo {capo}",
  "songChords.capoOff": "No capo",
  "songChords.sa": "Sa on {key}",
  "songChords.badge.a11y": "{text}. Change",
  "songChords.easier": "Easier: capo {capo}",
  "songChords.easier.a11y": "Easier: capo {capo}. Tap to use it",
  "songChords.sheet.capo": "Capo",
  "songChords.sheet.key": "Key on the harmonium",
  "songChords.sheet.done": "Done",
  "songChords.members.title": "Chords by members",
  "songChords.members.row_one": "Chords by members · {count}",
  "songChords.members.row_other": "Chords by members · {count}",
  "songChords.members.none": "Chords by members",
  "songChords.members.add": "Add yours",
  "songChords.piano.row_one": "Piano notes · {count} version",
  "songChords.piano.row_other": "Piano notes · {count} versions",
  "songChords.piano.none": "Piano notes",
  "songChords.piano.add": "Add notes",

  // Video tab
  "songVideo.empty": "No video of this song yet.",
} as const

export const songTabsRu: Readonly<Record<string, string>> = {
  "player.about.button": "Об этой песне",
  "player.about.hint": "Нажмите на i, чтобы прочитать об этой песне",

  "songTabs.meaning": "Смысл",
  "songTabs.info": "Инфо",

  // Вкладка «Смысл»: язык «слово за словом» (выбор за кнопкой Aa) и мелкая строка с его названием
  "songWords.language.title": "Язык «слово за словом»",
  "songWords.language.now": "Значения на языке: {language}",

  // Вкладка «Видео»
  "songVideo.add": "Добавить видео",
  "songVideo.open.a11y": "Открыть на {site}",
  "songVideo.report.a11y": "Сообщить о проблеме с видео",
  "songVideo.note": "Видео открываются на своих сайтах. Команда их не хранит и не проверяет.",

  // окно «Аккорды от участников»: одна карточка на каждый разбор
  "songMembers.you": "Вы",
  "songMembers.anonymous": "Аноним",
  "songMembers.pending": "Ждёт проверки",
  "songMembers.show.a11y": "{name}, {meta}. Показать разбор",
  "songMembers.hide.a11y": "{name}, {meta}. Скрыть разбор",

  "songAct.save.caption": "Сохранить",
  "songAct.saved.caption": "Сохранено",
  "songAct.saved.help": "Кладёт песню в «Моё». Если она уже сохранена, нажмите ещё раз, чтобы изменить, где она лежит.",
  "songAct.saved.a11y.off": "Сохранить в «Моё»",
  "songAct.saved.a11y.on": "Сохранено. Изменить, где лежит",
  "songAct.download.caption": "Скачать",
  "songAct.download.caption.busy": "{percent}%",
  "songAct.download.caption.done": "Скачано",
  "songAct.download.help": "Оставляет песню на этом телефоне, чтобы она играла без интернета.",
  "songAct.playlist.caption": "Плейлист",
  "songAct.playlist.a11y": "Добавить в плейлист",
  "songAct.playlist.help": "Выберите плейлист или создайте новый.",
  "songAct.share.caption": "Поделиться",
  "songAct.share.a11y": "Поделиться этой песней",
  "songAct.share.help": "Отправить песню другу.",
  "songAct.more.caption": "Ещё",
  "songAct.more.a11y": "Другие действия",
  "songAct.more.help": "Очередь, подборка, сообщить о проблеме.",
  "songAct.play": "Слушать",
  "songAct.pause": "Пауза",

  "songRec.row_one": "{count} запись",
  "songRec.row_few": "{count} записи",
  "songRec.row_many": "{count} записей",
  "songRec.row_other": "{count} записи",
  "songRec.open": "открыть в плеере",

  "songLearn.add": "Добавить в обучение",
  "songPage.learn.add.a11y": "Добавить PS {number} в ваш список Learn",
  "songPage.learn.added": "PS {number} добавлена в Learn",
  "songPage.learn.in": "В вашем списке Learn",
  "songPage.learn.in.a11y": "PS {number} в вашем списке Learn. Открыть путь изучения",
  "songPage.learn.open": "Открыть",

  "songLyr.where": "Перевод песни лежит во вкладке «Смысл».",
  "songLyr.where.open": "Открыть «Смысл»",

  "songWords.mode.a11y": "Что показать",
  "songWords.mode.translation": "Перевод",
  "songWords.mode.words": "Слово за словом",

  "songChords.shapes": "Какие аккорды брать",
  "songChords.lines": "Аккорды над словами",
  "songChords.sounds": "Звучит в {key}",
  "songChords.capo": "Каподастр {capo}",
  "songChords.capoOff": "Без каподастра",
  "songChords.sa": "Са на {key}",
  "songChords.badge.a11y": "{text}. Изменить",
  "songChords.easier": "Проще: каподастр {capo}",
  "songChords.easier.a11y": "Проще: каподастр {capo}. Нажмите, чтобы поставить",
  "songChords.sheet.capo": "Каподастр",
  "songChords.sheet.key": "Строй гармониума",
  "songChords.sheet.done": "Готово",
  "songChords.members.title": "Аккорды от участников",
  "songChords.members.row_one": "Аккорды от участников · {count}",
  "songChords.members.row_few": "Аккорды от участников · {count}",
  "songChords.members.row_many": "Аккорды от участников · {count}",
  "songChords.members.row_other": "Аккорды от участников · {count}",
  "songChords.members.none": "Аккорды от участников",
  "songChords.members.add": "Добавить свои",
  "songChords.piano.row_one": "Ноты для пианино · {count} вариант",
  "songChords.piano.row_few": "Ноты для пианино · {count} варианта",
  "songChords.piano.row_many": "Ноты для пианино · {count} вариантов",
  "songChords.piano.row_other": "Ноты для пианино · {count} варианта",
  "songChords.piano.none": "Ноты для пианино",
  "songChords.piano.add": "Добавить ноты",

  "songVideo.empty": "Видео с этой песней пока нет.",
}

export const songTabsEs: Record<keyof typeof songTabsEn, string> = {
  "player.about.button": "Sobre esta canción",
  "player.about.hint": "Toca la i para leer sobre esta canción",

  "songTabs.meaning": "Significado",
  "songTabs.info": "Info",

  // Pestaña Significado: el idioma de palabra por palabra (se elige tras el botón Aa) y la línea pequeña que lo nombra
  "songWords.language.title": "Idioma de palabra por palabra",
  "songWords.language.now": "Significados en {language}",

  // Pestaña Vídeo
  "songVideo.add": "Añadir un vídeo",
  "songVideo.open.a11y": "Abrir en {site}",
  "songVideo.report.a11y": "Avisar de un problema con el vídeo",
  "songVideo.note": "Los vídeos se abren en sus propios sitios. El equipo no los aloja ni los revisa.",

  // la ventana «Acordes de miembros»: una tarjeta por cada cifrado
  "songMembers.you": "Tú",
  "songMembers.anonymous": "Anónimo",
  "songMembers.pending": "Esperando revisión",
  "songMembers.show.a11y": "{name}, {meta}. Mostrar este cifrado",
  "songMembers.hide.a11y": "{name}, {meta}. Ocultar este cifrado",

  "songAct.save.caption": "Guardar",
  "songAct.saved.caption": "Guardado",
  "songAct.saved.help": "Pone la canción en Mío. Si ya está guardada, toca otra vez para cambiar dónde se guarda.",
  "songAct.saved.a11y.off": "Guardar en Mío",
  "songAct.saved.a11y.on": "Guardado. Cambiar dónde se guarda",
  "songAct.download.caption": "Descargar",
  "songAct.download.caption.busy": "{percent}%",
  "songAct.download.caption.done": "Descargado",
  "songAct.download.help": "Guarda la canción en este teléfono para oírla sin internet.",
  "songAct.playlist.caption": "Lista",
  "songAct.playlist.a11y": "Añadir a una lista",
  "songAct.playlist.help": "Elige una lista o crea una nueva.",
  "songAct.share.caption": "Compartir",
  "songAct.share.a11y": "Compartir esta canción",
  "songAct.share.help": "Enviar la canción a un amigo.",
  "songAct.more.caption": "Más",
  "songAct.more.a11y": "Más acciones",
  "songAct.more.help": "Cola, colección, avisar de un problema.",
  "songAct.play": "Reproducir",
  "songAct.pause": "Pausa",

  "songRec.row_one": "{count} grabación",
  "songRec.row_other": "{count} grabaciones",
  "songRec.open": "abrir en el reproductor",

  "songLearn.add": "Añadir al aprendizaje",
  "songPage.learn.add.a11y": "Añadir PS {number} a tu lista de Learn",
  "songPage.learn.added": "PS {number} añadida a Learn",
  "songPage.learn.in": "En tu lista de Learn",
  "songPage.learn.in.a11y": "PS {number} está en tu lista de Learn. Abrir su ruta de aprendizaje",
  "songPage.learn.open": "Abrir",

  "songLyr.where": "La traducción de la canción está en la pestaña Significado.",
  "songLyr.where.open": "Abrir Significado",

  "songWords.mode.a11y": "Qué mostrar",
  "songWords.mode.translation": "Traducción",
  "songWords.mode.words": "Palabra por palabra",

  "songChords.shapes": "Acordes para tocar",
  "songChords.lines": "Acordes sobre las palabras",
  "songChords.sounds": "Suena en {key}",
  "songChords.capo": "Cejilla {capo}",
  "songChords.capoOff": "Sin cejilla",
  "songChords.sa": "Sa en {key}",
  "songChords.badge.a11y": "{text}. Cambiar",
  "songChords.easier": "Más fácil: cejilla {capo}",
  "songChords.easier.a11y": "Más fácil: cejilla {capo}. Toca para ponerla",
  "songChords.sheet.capo": "Cejilla",
  "songChords.sheet.key": "Tono del armonio",
  "songChords.sheet.done": "Listo",
  "songChords.members.title": "Acordes de miembros",
  "songChords.members.row_one": "Acordes de miembros · {count}",
  "songChords.members.row_other": "Acordes de miembros · {count}",
  "songChords.members.none": "Acordes de miembros",
  "songChords.members.add": "Añade los tuyos",
  "songChords.piano.row_one": "Notas de piano · {count} versión",
  "songChords.piano.row_other": "Notas de piano · {count} versiones",
  "songChords.piano.none": "Notas de piano",
  "songChords.piano.add": "Añadir notas",

  "songVideo.empty": "Todavía no hay vídeo de esta canción.",
}
