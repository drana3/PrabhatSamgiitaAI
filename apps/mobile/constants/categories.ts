/** Mood chips on Songs — lists are bundled in mobile_category_songs.json. */
export const songCategories = [
  { id: "devotional", label: "Devotional", icon: "sparkles" },
  { id: "nature", label: "Nature", icon: "leaf" },
  { id: "love", label: "Love", icon: "heart" },
  { id: "meditation", label: "Meditation", icon: "flower2" },
  { id: "morning", label: "Morning", icon: "sunrise" },
  { id: "evening", label: "Evening", icon: "moon" },
  { id: "rain", label: "Rain", icon: "cloud-rain" },
  { id: "festival", label: "Festival", icon: "party-popper" },
  { id: "guru", label: "Guru", icon: "flame" },
  { id: "peace", label: "Peace", icon: "peace" },
] as const

/** Non-Bengali language collections (Top collections strip, beside Hindi/Urdu). */
export const songLanguageChips = [
  { id: "hindi", label: "Hindi", icon: "sparkles", collectionLabel: "Hindi Songs" },
  { id: "urdu", label: "Urdu", icon: "flower2", collectionLabel: "Urdu Songs" },
  { id: "sanskrit", label: "Sanskrit", icon: "flame", collectionLabel: "Sanskrit Songs" },
  { id: "english", label: "English", icon: "leaf", collectionLabel: "English Songs" },
  { id: "aungika", label: "Aungika", icon: "peace", collectionLabel: "Aungika Songs" },
  { id: "maithili", label: "Maithili", icon: "flower2", collectionLabel: "Maethili Song" },
  { id: "magahi", label: "Magahi", icon: "leaf", collectionLabel: "Magahi Songs" },
] as const

/** Themed catalog collections (after language chips on Songs). */
export const songThemeCollectionChips = [
  { id: "shiva", label: "Shiva", icon: "moon", collectionLabel: "Shiva Songs" },
  { id: "krsna", label: "Krśńa", icon: "heart", collectionLabel: "Krśńa Songs" },
  { id: "spring", label: "Spring", icon: "sunrise", collectionLabel: "Spring Songs" },
  { id: "neohumanism", label: "Neo-Humanism", icon: "peace", collectionLabel: "Neo-Humanism Songs" },
  { id: "children", label: "Children", icon: "party-popper", collectionLabel: "Children Songs" },
  { id: "bababirthday", label: "Bábá Birthday", icon: "sparkles", collectionLabel: "Bábá Birthday Songs" },
] as const

export const songCollectionChips = [...songLanguageChips, ...songThemeCollectionChips]

export type SongCategoryId = (typeof songCategories)[number]["id"]
export type SongCollectionChipId = (typeof songCollectionChips)[number]["id"]
export type SongBrowseId = SongCategoryId | SongCollectionChipId
