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
  /** Official Central idea / Purport when present. */
  centralIdea?: string | null
  /** Curated Hindi meaning from the catalog when available. */
  hindiMeaning?: string | null
  /** Admin-approved meanings keyed by language code (e.g. bn, ta). */
  localizedMeanings?: Record<string, string>
  /** Cached Central idea translations keyed by language code. */
  localizedExplanations?: Record<string, string>
  lyrics: string
  /** Catalog language label (e.g. English, Roman, Bengali). */
  language?: string | null
  /** Roman transliteration when available from the catalog. */
  transliteration?: string | null
  /** Devanagari lyrics (rule-based or approved), when available. */
  lyricsDevanagari?: string | null
  /** none | provisional | pending_review | approved */
  devanagariStatus?: string | null
  translation: string
  durationSeconds: number
  performer: string
  videos: SongVideo[]
  /** Direct audio stream when available from the catalog. */
  audioUrl?: string | null
  /** Alternate catalog recordings for the Listen tab. */
  audioRecordings?: Array<{ title: string; url: string; provider: string; isLatest?: boolean; loudnessLufs?: number; truePeakDb?: number }>
  /** Canonical Andromeda notation PDF when available. */
  notationSourceUrl?: string | null
  /** True after GET /songs/{n} media has been applied. */
  mediaHydrated?: boolean
  /**
   * What kind of track this is. Absent means a Prabhat Samgiita song. A Kiirtan is a normal audio
   * track of the same player (lib/kirtan/track.ts) with a synthetic `number`, no lyrics and no versions.
   */
  kind?: "song" | "kiirtan"
  /**
   * How loud the audio file is, measured on the server (lib/loudness/levels.ts): integrated loudness in LUFS
   * and true peak in dBTP. Absent until it is measured; the player then leaves the track at its own level.
   */
  loudness?: { lufs: number; truePeakDb: number | null }
  /**
   * Set when kind is "kiirtan" (a recording of the Kiirtan system): its catalog id, type id and who added it.
   * `recording` says which kind it is (Kiirtan, Bhajan, Prabhat Samgiita); absent means a Kiirtan.
   */
  kiirtan?: { id: string; /** the seed of its stock photo: the server id once the recording is up, else `id` (lib/photos/recordingPhoto.ts) */ photoSeed?: string; type: string; addedBy: string; recording?: "kiirtan" | "bhajan" | "prabhat_samgiita" | "spiritual_song" | "dance_song" | "baba_audio" | "other_mantra" }
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
