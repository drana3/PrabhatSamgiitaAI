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

/** Verified catalog collections (subset of the 68). Full list is /collections. */
export const songCollectionChips = [
  { id: "fullsargam", label: "Full Sargam", icon: "music", collectionLabel: "Full Sargam" },
  { id: "hindi", label: "Hindi", icon: "sparkles", collectionLabel: "Hindi Songs" },
  { id: "urdu", label: "Urdu", icon: "flower2", collectionLabel: "Urdu Songs" },
  { id: "english", label: "English", icon: "leaf", collectionLabel: "English Songs" },
  { id: "sanskrit", label: "Sanskrit", icon: "flame", collectionLabel: "Sanskrit Songs" },
  { id: "shiva", label: "Shiva", icon: "moon", collectionLabel: "Shiva Songs" },
  { id: "krsna", label: "Krśńa", icon: "heart", collectionLabel: "Krśńa Songs" },
  { id: "spring", label: "Spring", icon: "sunrise", collectionLabel: "Spring Songs" },
  { id: "neohumanism", label: "Neo-Humanism", icon: "peace", collectionLabel: "Neo-Humanism Songs" },
  { id: "children", label: "Children", icon: "party-popper", collectionLabel: "Children Songs" },
  { id: "bababirthday", label: "Bábá Birthday", icon: "sparkles", collectionLabel: "Bábá Birthday Songs" },
] as const

export type SongCategoryId = (typeof songCategories)[number]["id"]
export type SongCollectionChipId = (typeof songCollectionChips)[number]["id"]
export type SongBrowseId = SongCategoryId | SongCollectionChipId
