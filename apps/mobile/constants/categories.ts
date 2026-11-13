import { t } from "@/lib/i18n"

/** Mood chips on Songs — lists are bundled in mobile_category_songs.json. */
export const songCategories = [
  { id: "devotional", get label() { return t("cat.devotional") }, icon: "sparkles" },
  { id: "nature", get label() { return t("cat.nature") }, icon: "leaf" },
  { id: "love", get label() { return t("cat.love") }, icon: "heart" },
  { id: "meditation", get label() { return t("cat.meditation") }, icon: "flower2" },
  { id: "morning", get label() { return t("cat.morning") }, icon: "sunrise" },
  { id: "evening", get label() { return t("cat.evening") }, icon: "moon" },
  { id: "rain", get label() { return t("cat.rain") }, icon: "cloud-rain" },
  { id: "festival", get label() { return t("cat.festival") }, icon: "party-popper" },
  { id: "guru", get label() { return t("cat.guru") }, icon: "flame" },
  { id: "peace", get label() { return t("cat.peace") }, icon: "peace" },
] as const

/** Verified catalog collections (subset of the 68). Full list is /collections. */
export const songCollectionChips = [
  { id: "hindi", get label() { return t("cat.hindi") }, icon: "sparkles", collectionLabel: "Hindi Songs" },
  { id: "urdu", get label() { return t("cat.urdu") }, icon: "flower2", collectionLabel: "Urdu Songs" },
  { id: "english", get label() { return t("cat.english") }, icon: "leaf", collectionLabel: "English Songs" },
  { id: "sanskrit", get label() { return t("cat.sanskrit") }, icon: "flame", collectionLabel: "Sanskrit Songs" },
  { id: "shiva", get label() { return t("cat.shiva") }, icon: "moon", collectionLabel: "Shiva Songs" },
  { id: "krsna", get label() { return t("cat.krsna") }, icon: "heart", collectionLabel: "Krśńa Songs" },
  { id: "spring", get label() { return t("cat.spring") }, icon: "sunrise", collectionLabel: "Spring Songs" },
  { id: "neohumanism", get label() { return t("cat.neohumanism") }, icon: "peace", collectionLabel: "Neo-Humanism Songs" },
  { id: "children", get label() { return t("cat.children") }, icon: "party-popper", collectionLabel: "Children Songs" },
  { id: "bababirthday", get label() { return t("cat.bababirthday") }, icon: "sparkles", collectionLabel: "Bábá Birthday Songs" },
] as const

export type SongCategoryId = (typeof songCategories)[number]["id"]
export type SongCollectionChipId = (typeof songCollectionChips)[number]["id"]
export type SongBrowseId = SongCategoryId | SongCollectionChipId
