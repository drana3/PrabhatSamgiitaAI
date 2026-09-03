import { scenicHeroList } from "@/lib/scenicArt"

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
  /** Roman transliteration when available from the catalog. */
  transliteration?: string | null
  translation: string
  durationSeconds: number
  performer: string
  videos: SongVideo[]
  /** Direct audio stream when available from the catalog. */
  audioUrl?: string | null
  /** Alternate catalog recordings for the Listen tab. */
  audioRecordings?: Array<{ title: string; url: string; provider: string }>
  /** Canonical Andromeda notation PDF when available. */
  notationSourceUrl?: string | null
  /** True after GET /songs/{n} media has been applied. */
  mediaHydrated?: boolean
}

export {
  scenicHeroFor as scenicFor,
  scenicHeroList as scenicArtList,
  scenicThumbFor,
  scenicThumbList,
} from "@/lib/scenicArt"

/** Named scenic heroes — prefer scenicHeroFor / scenicThumbFor by song number. */
export const scenicArt = {
  sunrise: scenicHeroList[0],
  dawnLake: scenicHeroList[1],
  lotus: scenicHeroList[2],
  dusk: scenicHeroList[3],
  mist: scenicHeroList[4],
  mountains: scenicHeroList[5],
  meadow: scenicHeroList[6],
  river: scenicHeroList[7],
} as const

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
