/**
 * Words for the duplicate handling of Kiirtans and Bhajans (docs/kiirtan-publishing.md, section "Duplicates"):
 * "This file is already in the library", the mantra field and the mantra page, the daily limit, and a recording the
 * team removed as a copy. English is the source of truth; ru and es mirror it key for key (the parity test checks it).
 * "Kiirtan" is always written with two i's in English. Plural groups use _one, _few, _many, _other.
 */
export const duplicatesEn = {
  // "This file is already in the library" and "You already added this"
  "ugc.dup.title": "This file is already in the library",
  "ugc.dup.ownTitle": "You already added this one",
  "ugc.dup.body": "Listen to the one that is there, or choose a different file.",
  "ugc.dup.ownBody": "A recording with this title and sound is already yours. Find it under My uploads.",
  "ugc.dup.play": "Play it",
  "ugc.dup.playA11y": "Play {title}",
  "ugc.dup.another": "Choose a different file",
  "ugc.dup.cantPlay": "It cannot be played right now.",
  "ugc.err.ownDuplicate": "You already added a recording with this title that sounds the same.",
  "ugc.err.dailyLimit": "You have added a lot of recordings today. Please come back tomorrow to add more. Thank you for sharing.",

  // "Sounds like a recording already in the library": listen first
  "ugc.similar.play": "Play",
  "ugc.similar.playA11y": "Play {title}",
  "ugc.similar.cantPlay": "That one cannot be played right now.",

  // the mantra field of the add form
  "ugc.mantra.label": "Mantra (optional)",
  "ugc.mantra.placeholder": "For example, Baba Nam Kevalam",
  "ugc.mantra.hint": "Performances of one mantra are kept together as its versions.",
  "ugc.mantra.suggestions": "Mantras in the library",
  "ugc.mantra.first": "No recording of this mantra yet. Yours will be the first.",
  "ugc.mantra.seeAll": "See all versions",
  "ugc.mantra.checkFailed": "The library could not be checked right now. You can still publish.",

  // counts
  "mantra.versions_one": "{count} version",
  "mantra.versions_other": "{count} versions",
  "mantra.versionsOfThis_one": "{count} version of this mantra",
  "mantra.versionsOfThis_other": "{count} versions of this mantra",

  // the mantra page
  "mantra.over": "Mantra",
  "mantra.listOver": "Browse",
  "mantra.listFirst": "BY",
  "mantra.listSecond": "mantra",
  "mantra.listIntro": "One chant, sung by many. Open a mantra to hear its versions side by side.",
  "mantra.sort.newest": "Newest",
  "mantra.sort.plays": "Most played",
  "mantra.versionsHeading": "Versions",
  "mantra.play": "Play",
  "mantra.playA11y": "Play all versions of {title}",
  "mantra.empty": "No recordings of this mantra yet.",
  "mantra.listEmpty": "No mantras in the library yet. They appear as people add recordings and name the mantra.",
  "mantra.error": "The mantras could not be loaded. Check your connection.",
  "mantra.retry": "Try again",
  "mantra.missing": "This mantra is not in the library any more.",
  "mantra.loading": "Loading",
  "mantra.openA11y": "{title}. {versions}",
  "mantra.entry.title": "Browse by mantra",
  "mantra.entry.sub": "Every performance of one chant, side by side",
  "mantra.entry.a11y": "Browse Kiirtans by mantra",

  // My uploads: removed as a copy
  "ugc.removed.duplicateOf": "Removed as a copy of {title}",
  "ugc.removed.duplicateOfUnknown": "Removed as a copy of a recording that is already in the library",
  "ugc.removed.openOriginal": "Listen to the original",

  // Report
  "ugc.report.reason.duplicate": "Duplicate",
  "ugc.report.hint.duplicate": "The same recording is already in the library",
} as const

export const duplicatesRu = {
  "ugc.dup.title": "Этот файл уже есть в библиотеке",
  "ugc.dup.ownTitle": "Вы уже добавляли эту запись",
  "ugc.dup.body": "Послушайте ту, что уже есть, или выберите другой файл.",
  "ugc.dup.ownBody": "Запись с таким названием и звучанием уже ваша. Она в разделе «Мои загрузки».",
  "ugc.dup.play": "Послушать",
  "ugc.dup.playA11y": "Воспроизвести: {title}",
  "ugc.dup.another": "Выбрать другой файл",
  "ugc.dup.cantPlay": "Сейчас её нельзя воспроизвести.",
  "ugc.err.ownDuplicate": "Вы уже добавляли запись с таким названием и таким же звучанием.",
  "ugc.err.dailyLimit": "Сегодня вы добавили много записей. Приходите завтра, чтобы добавить ещё. Спасибо, что делитесь.",

  "ugc.similar.play": "Послушать",
  "ugc.similar.playA11y": "Воспроизвести: {title}",
  "ugc.similar.cantPlay": "Сейчас эту запись нельзя воспроизвести.",

  "ugc.mantra.label": "Мантра (по желанию)",
  "ugc.mantra.placeholder": "Например, Баба Нам Кевалам",
  "ugc.mantra.hint": "Исполнения одной мантры собираются вместе как её версии.",
  "ugc.mantra.suggestions": "Мантры в библиотеке",
  "ugc.mantra.first": "Записей этой мантры пока нет. Ваша будет первой.",
  "ugc.mantra.seeAll": "Все версии",
  "ugc.mantra.checkFailed": "Сейчас не удалось проверить библиотеку. Публиковать всё равно можно.",

  "mantra.versions_one": "{count} версия",
  "mantra.versions_few": "{count} версии",
  "mantra.versions_many": "{count} версий",
  "mantra.versions_other": "{count} версии",
  "mantra.versionsOfThis_one": "{count} версия этой мантры",
  "mantra.versionsOfThis_few": "{count} версии этой мантры",
  "mantra.versionsOfThis_many": "{count} версий этой мантры",
  "mantra.versionsOfThis_other": "{count} версии этой мантры",

  "mantra.over": "Мантра",
  "mantra.listOver": "Обзор",
  "mantra.listFirst": "ПО",
  "mantra.listSecond": "мантрам",
  "mantra.listIntro": "Одна мантра, много исполнителей. Откройте мантру, чтобы услышать её версии рядом.",
  "mantra.sort.newest": "Новые",
  "mantra.sort.plays": "Самые слушаемые",
  "mantra.versionsHeading": "Версии",
  "mantra.play": "Слушать",
  "mantra.playA11y": "Воспроизвести все версии: {title}",
  "mantra.empty": "Записей этой мантры пока нет.",
  "mantra.listEmpty": "В библиотеке пока нет мантр. Они появляются, когда люди добавляют записи и указывают мантру.",
  "mantra.error": "Не удалось загрузить мантры. Проверьте соединение.",
  "mantra.retry": "Повторить",
  "mantra.missing": "Этой мантры больше нет в библиотеке.",
  "mantra.loading": "Загрузка",
  "mantra.openA11y": "{title}. {versions}",
  "mantra.entry.title": "Обзор по мантрам",
  "mantra.entry.sub": "Все исполнения одной мантры рядом",
  "mantra.entry.a11y": "Открыть киртаны по мантрам",

  "ugc.removed.duplicateOf": "Удалена как копия записи «{title}»",
  "ugc.removed.duplicateOfUnknown": "Удалена как копия записи, которая уже есть в библиотеке",
  "ugc.removed.openOriginal": "Послушать оригинал",

  "ugc.report.reason.duplicate": "Дубликат",
  "ugc.report.hint.duplicate": "Такая же запись уже есть в библиотеке",
} as const

export const duplicatesEs: Record<keyof typeof duplicatesEn, string> = {
  "ugc.dup.title": "Este archivo ya está en la biblioteca",
  "ugc.dup.ownTitle": "Ya añadiste esta grabación",
  "ugc.dup.body": "Escucha la que ya está, o elige otro archivo.",
  "ugc.dup.ownBody": "Una grabación con este título y este sonido ya es tuya. Búscala en Mis subidas.",
  "ugc.dup.play": "Escucharla",
  "ugc.dup.playA11y": "Reproducir {title}",
  "ugc.dup.another": "Elegir otro archivo",
  "ugc.dup.cantPlay": "No se puede reproducir ahora.",
  "ugc.err.ownDuplicate": "Ya añadiste una grabación con este título que suena igual.",
  "ugc.err.dailyLimit": "Hoy has añadido muchas grabaciones. Vuelve mañana para añadir más. Gracias por compartir.",

  "ugc.similar.play": "Escuchar",
  "ugc.similar.playA11y": "Reproducir {title}",
  "ugc.similar.cantPlay": "Esa no se puede reproducir ahora.",

  "ugc.mantra.label": "Mantra (opcional)",
  "ugc.mantra.placeholder": "Por ejemplo, Baba Nam Kevalam",
  "ugc.mantra.hint": "Las interpretaciones de un mismo mantra se agrupan como sus versiones.",
  "ugc.mantra.suggestions": "Mantras de la biblioteca",
  "ugc.mantra.first": "Todavía no hay grabaciones de este mantra. La tuya será la primera.",
  "ugc.mantra.seeAll": "Ver todas las versiones",
  "ugc.mantra.checkFailed": "Ahora no se pudo consultar la biblioteca. Aun así puedes publicar.",

  "mantra.versions_one": "{count} versión",
  "mantra.versions_other": "{count} versiones",
  "mantra.versionsOfThis_one": "{count} versión de este mantra",
  "mantra.versionsOfThis_other": "{count} versiones de este mantra",

  "mantra.over": "Mantra",
  "mantra.listOver": "Explorar",
  "mantra.listFirst": "POR",
  "mantra.listSecond": "mantra",
  "mantra.listIntro": "Un mismo canto, muchas voces. Abre un mantra para oír sus versiones una junto a otra.",
  "mantra.sort.newest": "Recientes",
  "mantra.sort.plays": "Más escuchadas",
  "mantra.versionsHeading": "Versiones",
  "mantra.play": "Reproducir",
  "mantra.playA11y": "Reproducir todas las versiones de {title}",
  "mantra.empty": "Todavía no hay grabaciones de este mantra.",
  "mantra.listEmpty": "Aún no hay mantras en la biblioteca. Aparecen cuando la gente añade grabaciones e indica el mantra.",
  "mantra.error": "No se pudieron cargar los mantras. Revisa tu conexión.",
  "mantra.retry": "Reintentar",
  "mantra.missing": "Este mantra ya no está en la biblioteca.",
  "mantra.loading": "Cargando",
  "mantra.openA11y": "{title}. {versions}",
  "mantra.entry.title": "Explorar por mantra",
  "mantra.entry.sub": "Todas las interpretaciones de un canto, una junto a otra",
  "mantra.entry.a11y": "Explorar kiirtans por mantra",

  "ugc.removed.duplicateOf": "Eliminada por ser copia de {title}",
  "ugc.removed.duplicateOfUnknown": "Eliminada por ser copia de una grabación que ya está en la biblioteca",
  "ugc.removed.openOriginal": "Escuchar la original",

  "ugc.report.reason.duplicate": "Duplicado",
  "ugc.report.hint.duplicate": "La misma grabación ya está en la biblioteca",
}
