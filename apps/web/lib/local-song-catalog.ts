import type { SongDetail, SongSummary } from "@/lib/api"
import mediaRows from "../../../data/seed/media.json"
import notationRows from "../../../data/seed/notations.json"
import songRows from "../../../data/seed/songs.json"

type SeedSong = {
  number: number
  title: string
  first_line?: string | null
  lyrics_original?: string | null
  transliteration?: string | null
  hindi_meaning?: string | null
  english_meaning?: string | null
  theme?: string | null
  occasion?: string | null
  festival?: string | null
  season?: string | null
  mood?: string | null
  language?: string | null
  difficulty?: string | null
  meditation_context?: string | null
  raga?: string | null
  tala?: string | null
  harmonium_notation?: string | null
  canonical_source_url?: string | null
  canonical_source_status?: string
  is_verified?: boolean
  metadata_json?: Record<string, unknown>
}

type SeedMedia = {
  song_number?: number | null
  kind: string
  provider: string
  title: string
  url: string
  embed_url?: string | null
  verification_status: string
  source_url?: string | null
  notes?: string | null
  metadata_json?: Record<string, unknown>
}

type SeedNotation = {
  song_number: number
  source_url?: string | null
  notation_text?: string | null
  scale?: string | null
  verification_status?: string | null
}

const RELATED_FIELDS = ["theme", "occasion", "festival", "season", "mood", "language"] as const

let songsByNumber: Map<number, SeedSong> | null = null
let mediaByNumber: Map<number, SeedMedia[]> | null = null
let notationsByNumber: Map<number, SeedNotation> | null = null

function songIndex() {
  if (!songsByNumber) {
    songsByNumber = new Map((songRows as SeedSong[]).map((song) => [song.number, song]))
  }
  return songsByNumber
}

function mediaIndex() {
  if (!mediaByNumber) {
    mediaByNumber = new Map()
    for (const item of mediaRows as SeedMedia[]) {
      if (!item.song_number) continue
      const list = mediaByNumber.get(item.song_number) ?? []
      list.push(item)
      mediaByNumber.set(item.song_number, list)
    }
  }
  return mediaByNumber
}

function notationIndex() {
  if (!notationsByNumber) {
    notationsByNumber = new Map((notationRows as SeedNotation[]).map((item) => [item.song_number, item]))
  }
  return notationsByNumber
}

function summary(song: SeedSong): SongSummary {
  return {
    number: song.number,
    title: song.title,
    first_line: song.first_line,
    theme: song.theme,
    occasion: song.occasion,
    mood: song.mood,
    language: song.language,
    difficulty: song.difficulty,
    is_verified: Boolean(song.is_verified),
  }
}

function relatedSongs(song: SeedSong, limit = 6): SongSummary[] {
  const related: SongSummary[] = []
  for (const candidate of songRows as SeedSong[]) {
    if (candidate.number === song.number) continue
    if (RELATED_FIELDS.some((field) => song[field] && candidate[field] === song[field])) {
      related.push(summary(candidate))
    }
    if (related.length >= limit) break
  }
  return related
}

export function localSongDetail(number: number): SongDetail | null {
  if (!Number.isInteger(number) || number < 1) return null
  const song = songIndex().get(number)
  if (!song) return null
  const notation = notationIndex().get(number)
  const playable = Boolean(notation?.notation_text?.trim().startsWith("{") || song.harmonium_notation?.trim().startsWith("{"))
  return {
    ...summary(song),
    lyrics_original: song.lyrics_original,
    transliteration: song.transliteration,
    hindi_meaning: song.hindi_meaning,
    english_meaning: song.english_meaning,
    festival: song.festival,
    season: song.season,
    meditation_context: song.meditation_context,
    raga: song.raga,
    tala: song.tala,
    harmonium_notation: song.harmonium_notation,
    canonical_source_url: song.canonical_source_url,
    canonical_source_status: song.canonical_source_status ?? "pending",
    related_songs: relatedSongs(song),
    media: (mediaIndex().get(number) ?? []).map((item) => ({
      kind: item.kind,
      provider: item.provider,
      title: item.title,
      url: item.url,
      embed_url: item.embed_url,
      verification_status: item.verification_status,
      source_url: item.source_url,
      notes: item.notes,
    })),
    notation_scale: notation?.scale,
    notation_source_url: notation?.source_url,
    notation_verification_status: notation?.verification_status,
    notation_transposition_available: playable,
    metadata_json: song.metadata_json ?? {},
  }
}
