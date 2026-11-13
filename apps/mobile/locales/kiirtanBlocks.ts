/**
 * Words of the blocks added to the Kiirtan page on 13 Nov 2026: the audio-only broadcast player (Listen / Stop), the shelves of
 * Discourses, Dance music and Spiritual songs, and the Most played variants. English is the source of truth; ru and es mirror it key
 * for key (the test checks it). Read through `lib/kirtan/blocksCopy.ts` (`useBlocksT`), the same way as the crop sheet's strings.
 */
export const kiirtanBlocksEn = {
  "kb.audio.listen": "Listen",
  "kb.audio.stop": "Stop",
  "kb.audio.only": "Audio only",
  "kb.shelf.all": "See all",
  "kb.shelf.empty": "No recordings yet. Be the first to add one.",
  "kb.shelf.a11y": "{title}, {count}",
  "kb.shelf.baba.first": "Discourses",
  "kb.shelf.baba.second": "in audio",
  "kb.shelf.dance.first": "Dance",
  "kb.shelf.dance.second": "music",
  "kb.shelf.spiritual.first": "Spiritual",
  "kb.shelf.spiritual.second": "songs",
  "kb.mp.number1": "Number 1 this week",
  "kb.mp.more": "The full chart",
} as const

export const kiirtanBlocksRu: Record<keyof typeof kiirtanBlocksEn, string> = {
  "kb.audio.listen": "Слушать",
  "kb.audio.stop": "Стоп",
  "kb.audio.only": "Только аудио",
  "kb.shelf.all": "Все",
  "kb.shelf.empty": "Записей пока нет. Добавьте первую.",
  "kb.shelf.a11y": "{title}, {count}",
  "kb.shelf.baba.first": "Беседы",
  "kb.shelf.baba.second": "в записи",
  "kb.shelf.dance.first": "Танцевальная",
  "kb.shelf.dance.second": "музыка",
  "kb.shelf.spiritual.first": "Духовные",
  "kb.shelf.spiritual.second": "песни",
  "kb.mp.number1": "Первое место недели",
  "kb.mp.more": "Весь чарт",
}

export const kiirtanBlocksEs: Record<keyof typeof kiirtanBlocksEn, string> = {
  "kb.audio.listen": "Escuchar",
  "kb.audio.stop": "Parar",
  "kb.audio.only": "Solo audio",
  "kb.shelf.all": "Ver todo",
  "kb.shelf.empty": "Aún no hay grabaciones. Añade la primera.",
  "kb.shelf.a11y": "{title}, {count}",
  "kb.shelf.baba.first": "Discursos",
  "kb.shelf.baba.second": "en audio",
  "kb.shelf.dance.first": "Música",
  "kb.shelf.dance.second": "de baile",
  "kb.shelf.spiritual.first": "Canciones",
  "kb.shelf.spiritual.second": "espirituales",
  "kb.mp.number1": "El número 1 de la semana",
  "kb.mp.more": "La lista completa",
}
