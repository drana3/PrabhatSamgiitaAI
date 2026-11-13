/**
 * Words of "Who are you for this recording?" on the Add Recording form (Dada, 13 Nov 2026): the required one-of-four answer and its comment.
 * English is the source of truth; ru and es mirror it key for key (__tests__/uploadRole.test.ts checks it) and are NOT yet read by a
 * native speaker. Registered in locales/index.ts (merged over en, ru and es), not spread in en.ts, ru.ts or es.ts. Read with `useUx()`.
 */
export const uploadRoleEn = {
  "ux.who.title": "Who are you for this recording?",
  "ux.who.wrote": "I wrote it",
  "ux.who.wroteHint": "The words or the melody. Saved with the recording as “By the author”.",
  "ux.who.performs": "I perform / play on it",
  "ux.who.performsHint": "You sing or play on this recording. Your name goes in the performer line if it is empty.",
  "ux.who.both": "Both",
  "ux.who.bothHint": "You wrote it and you perform or play on it.",
  "ux.who.sharing": "I’m only sharing (someone else’s recording)",
  "ux.who.sharingHint": "You neither wrote nor play on it. Say in the comment who did.",
  "ux.who.error": "Choose who you are for this recording.",
  "ux.who.auto": "A discourse of Baba. You are sharing it. Add its source in the comment if you like.",
  "ux.who.comment": "Comment (optional)",
  "ux.who.placeholder": "Who else wrote it, who plays, where it comes from",
  "ux.who.placeholderSharing": "Who wrote it and who performs it, if you know. The source too.",
  "ux.who.count": "{count} of {max}",
  "ux.who.page": "On your author page, “I wrote it” and “Both” are under “Wrote”; the other two stay under “Performs”. The server keeps only that and your comment, so “I perform” and “Only sharing” look the same there for now.",
} as const

export const uploadRoleRu: Record<keyof typeof uploadRoleEn, string> = {
  "ux.who.title": "Кто вы для этой записи?",
  "ux.who.wrote": "Я автор",
  "ux.who.wroteHint": "Слов или мелодии. Сохраняется вместе с записью как «От автора».",
  "ux.who.performs": "Я исполняю / играю в ней",
  "ux.who.performsHint": "Вы поёте или играете в этой записи. Ваше имя встанет в строку исполнителя, если она пуста.",
  "ux.who.both": "И то и другое",
  "ux.who.bothHint": "Вы написали это и исполняете или играете в записи.",
  "ux.who.sharing": "Я только делюсь (чужая запись)",
  "ux.who.sharingHint": "Вы не писали и не играете в ней. Напишите в комментарии, кто.",
  "ux.who.error": "Выберите, кто вы для этой записи.",
  "ux.who.auto": "Беседа Бабы. Вы ею делитесь. Источник можно указать в комментарии.",
  "ux.who.comment": "Комментарий (необязательно)",
  "ux.who.placeholder": "Кто ещё написал, кто играет, откуда запись",
  "ux.who.placeholderSharing": "Кто написал и кто исполняет, если знаете. И источник.",
  "ux.who.count": "{count} из {max}",
  "ux.who.page": "На вашей странице автора «Я автор» и «И то и другое» лежат во вкладке «Написал», два других остаются в «Исполняет». Сервер хранит только это и ваш комментарий, поэтому «Я исполняю» и «Только делюсь» пока выглядят там одинаково.",
}

export const uploadRoleEs: Record<keyof typeof uploadRoleEn, string> = {
  "ux.who.title": "¿Quién eres tú en esta grabación?",
  "ux.who.wrote": "La escribí yo",
  "ux.who.wroteHint": "La letra o la melodía. Se guarda con la grabación como «Del autor».",
  "ux.who.performs": "La interpreto / toco en ella",
  "ux.who.performsHint": "Cantas o tocas en esta grabación. Tu nombre pasa a la línea del intérprete si está vacía.",
  "ux.who.both": "Las dos cosas",
  "ux.who.bothHint": "La escribiste y la interpretas o tocas en ella.",
  "ux.who.sharing": "Solo la comparto (grabación de otra persona)",
  "ux.who.sharingHint": "No la escribiste ni tocas en ella. Di en el comentario quién.",
  "ux.who.error": "Elige quién eres en esta grabación.",
  "ux.who.auto": "Un discurso de Baba. Lo compartes. Puedes añadir la fuente en el comentario.",
  "ux.who.comment": "Comentario (opcional)",
  "ux.who.placeholder": "Quién más la escribió, quién toca, de dónde viene",
  "ux.who.placeholderSharing": "Quién la escribió y quién la interpreta, si lo sabes. Y la fuente.",
  "ux.who.count": "{count} de {max}",
  "ux.who.page": "En tu página de autor, «La escribí yo» y «Las dos cosas» están en «Escribió»; las otras dos quedan en «Interpreta». El servidor solo guarda eso y tu comentario, así que «La interpreto» y «Solo la comparto» se ven igual allí por ahora.",
}
