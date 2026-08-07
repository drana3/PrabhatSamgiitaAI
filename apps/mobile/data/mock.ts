export type SongVideo = {
  id: string
  title: string
  /** Original catalog URL (watch page or file) — not used for external launch. */
  url: string
  /** In-app embed URL (YouTube nocookie embed or direct video). */
  embedUrl?: string | null
  thumbnailUrl: string
}

export type MockSong = {
  id: string
  number: number
  title: string
  originalTitle?: string
  shortDescription: string
  imageUrl: string
  thumbnailUrl: string
  themes: string[]
  /** English meaning (primary for language=en). */
  meaning: string
  /** Curated Hindi meaning from the catalog when available. */
  hindiMeaning?: string | null
  /** Admin-approved meanings keyed by language code (e.g. bn, ta). */
  localizedMeanings?: Record<string, string>
  lyrics: string
  translation: string
  durationSeconds: number
  performer: string
  videos: SongVideo[]
  /** Direct audio stream when available from the catalog. */
  audioUrl?: string | null
  /** True after GET /songs/{n} media has been applied. */
  mediaHydrated?: boolean
}

/** Scenic fallback art when catalog has no thumbnails. */
export const scenicArt = {
  sunrise: "https://images.unsplash.com/photo-1495616811223-4d98b6e70c9a?w=1200&q=80",
  dawnLake: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80",
  lotus: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200&q=80",
  dusk: "https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?w=1200&q=80",
  mist: "https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=1200&q=80",
  mountains: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1200&q=80",
  meadow: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1200&q=80",
  river: "https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=1200&q=80",
} as const

export const scenicArtList = Object.values(scenicArt)

/** Prompt chips for browse/search UIs — not used by song-grounded AI companion. */
export const aiSuggestions = [
  "Suggest a morning devotion song",
  "Which song helps with peace of mind?",
  "Tell me about Prabhat Samgiita",
  "Recommend a song for meditation",
]

export const popularSearches = [
  "Devotional",
  "Morning",
  "Love",
  "Meditation",
  "Festival",
  "Guru",
]
