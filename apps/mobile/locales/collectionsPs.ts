/**
 * Words of the Collections page with the Prabhat Samgiita collections (lib/psCollections, app/collections-v2.tsx):
 * the section names and the one-line help on a collection page. English is the source of truth; ru and es mirror it key
 * for key. The collection names themselves come from the data files (English, like the content of the songs).
 * Spread into the Search menu words (locales/searchMenu.ts), which the main dictionaries already carry.
 */
export const collectionsPsEn = {
  "psColl.section.feeling": "Mood and feeling",
  "psColl.section.time": "Time of day",
  "psColl.section.season": "Season",
  "psColl.section.theme": "Theme",
  "psColl.section.language": "Languages",
  "psColl.section.tala": "Tala",
  "psColl.section.raga": "Raga",
  "psColl.section.site": "From the site",
  "psColl.section.heart": "Songs of the heart",
  "psColl.chips.all": "All",
  "songs.coll.plusHint": "Tap + to save a song to Mine or to a playlist.",
} as const

export const collectionsPsRu = {
  "psColl.section.feeling": "Настроение и чувство",
  "psColl.section.time": "Время суток",
  "psColl.section.season": "Сезон",
  "psColl.section.theme": "Тема",
  "psColl.section.language": "Языки",
  "psColl.section.tala": "Тала",
  "psColl.section.raga": "Рага",
  "psColl.section.site": "С сайта",
  "psColl.section.heart": "Песни сердца",
  "psColl.chips.all": "Все",
  "songs.coll.plusHint": "Нажмите +, чтобы сохранить песню в «Моё» или в плейлист.",
} as const

export const collectionsPsEs = {
  "psColl.section.feeling": "Ánimo y sentimiento",
  "psColl.section.time": "Hora del día",
  "psColl.section.season": "Estación",
  "psColl.section.theme": "Tema",
  "psColl.section.language": "Idiomas",
  "psColl.section.tala": "Tala",
  "psColl.section.raga": "Raga",
  "psColl.section.site": "Del sitio",
  "psColl.section.heart": "Canciones del corazón",
  "psColl.chips.all": "Todo",
  "songs.coll.plusHint": "Toca + para guardar la canción en Mío o en una lista.",
} as const
