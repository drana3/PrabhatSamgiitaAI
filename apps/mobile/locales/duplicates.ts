/**
 * Words for the duplicate handling of Kiirtans and Bhajans (docs/kiirtan-publishing.md, section "Duplicates"):
 * "This file is already in the library", the mantra field and the mantra page, the daily limit, and a recording the
 * team removed as a copy. English is the source of truth; ru and es mirror it key for key (the parity test checks it).
 * "Kiirtan" is always written with two i's in English. Plural groups use _one, _few, _many, _other.
 */
export const duplicatesEn = {
  // "This file is already in the library" and "You already added this"
  "ugc.dup.playA11y": "Play {title}",
  "ugc.dup.cantPlay": "It cannot be played right now.",
  "ugc.err.ownDuplicate": "You already added a recording with this title that sounds the same.",
  "ugc.err.dailyLimit": "You have added a lot of recordings today. Please come back tomorrow to add more. Thank you for sharing.",

  // "Sounds like a recording already in the library": listen first
  "ugc.similar.play": "Play",
  "ugc.similar.playA11y": "Play {title}",
  "ugc.similar.cantPlay": "That one cannot be played right now.",

  // My uploads: removed as a copy
  "ugc.removed.duplicateOf": "Removed as a copy of {title}",
  "ugc.removed.duplicateOfUnknown": "Removed as a copy of a recording that is already in the library",
  "ugc.removed.openOriginal": "Listen to the original",

  // Report
  "ugc.report.reason.duplicate": "Duplicate",
  "ugc.report.hint.duplicate": "The same recording is already in the library",
} as const

export const duplicatesRu = {
  "ugc.dup.playA11y": "Воспроизвести: {title}",
  "ugc.dup.cantPlay": "Сейчас её нельзя воспроизвести.",
  "ugc.err.ownDuplicate": "Вы уже добавляли запись с таким названием и таким же звучанием.",
  "ugc.err.dailyLimit": "Сегодня вы добавили много записей. Приходите завтра, чтобы добавить ещё. Спасибо, что делитесь.",

  "ugc.similar.play": "Послушать",
  "ugc.similar.playA11y": "Воспроизвести: {title}",
  "ugc.similar.cantPlay": "Сейчас эту запись нельзя воспроизвести.",

  "ugc.removed.duplicateOf": "Удалена как копия записи «{title}»",
  "ugc.removed.duplicateOfUnknown": "Удалена как копия записи, которая уже есть в библиотеке",
  "ugc.removed.openOriginal": "Послушать оригинал",

  "ugc.report.reason.duplicate": "Дубликат",
  "ugc.report.hint.duplicate": "Такая же запись уже есть в библиотеке",
} as const

export const duplicatesEs: Record<keyof typeof duplicatesEn, string> = {
  "ugc.dup.playA11y": "Reproducir {title}",
  "ugc.dup.cantPlay": "No se puede reproducir ahora.",
  "ugc.err.ownDuplicate": "Ya añadiste una grabación con este título que suena igual.",
  "ugc.err.dailyLimit": "Hoy has añadido muchas grabaciones. Vuelve mañana para añadir más. Gracias por compartir.",

  "ugc.similar.play": "Escuchar",
  "ugc.similar.playA11y": "Reproducir {title}",
  "ugc.similar.cantPlay": "Esa no se puede reproducir ahora.",

  "ugc.removed.duplicateOf": "Eliminada por ser copia de {title}",
  "ugc.removed.duplicateOfUnknown": "Eliminada por ser copia de una grabación que ya está en la biblioteca",
  "ugc.removed.openOriginal": "Escuchar la original",

  "ugc.report.reason.duplicate": "Duplicado",
  "ugc.report.hint.duplicate": "La misma grabación ya está en la biblioteca",
}
