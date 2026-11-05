/**
 * Counted labels that used to be glued together in helpers ("5 songs", "4 min read"). English is
 * the source; ru and es mirror it key for key, with the plural forms each language needs.
 * Spread into the main dictionaries. Songs and kiirtans reuse `songs.count` and `kind.kiirtan.count`.
 */
export const countsEn = {
  "mix.empty": "Empty",
  "songs.hiddenShow": "Show",
  "stories.count_one": "{count} story",
  "stories.count_other": "{count} stories",
  "stories.shownOf": "{shown} of {total}",
  "stories.unreadCount": "{count} unread",
  "stories.readTime": "{count} min read",
} as const

export const countsEs = {
  "mix.empty": "Vacía",
  "songs.hiddenShow": "Mostrar",
  "stories.count_one": "{count} historia",
  "stories.count_other": "{count} historias",
  "stories.shownOf": "{shown} de {total}",
  "stories.unreadCount": "{count} sin leer",
  "stories.readTime": "{count} min de lectura",
} as const

export const countsRu = {
  "mix.empty": "Пусто",
  "songs.hiddenShow": "Показать",
  "stories.count_one": "{count} история",
  "stories.count_few": "{count} истории",
  "stories.count_many": "{count} историй",
  "stories.count_other": "{count} истории",
  "stories.shownOf": "{shown} из {total}",
  "stories.unreadCount": "Не прочитано: {count}",
  "stories.readTime": "{count} мин чтения",
} as const
