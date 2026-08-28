import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { bookletHarmoniumSong } from "@prabhat/core"
import type { SongDetail, SongSummary, TransposedNotation } from "@/lib/api"
import { completeSargamSongs, isCompleteSargamSong } from "@/lib/complete-sargam"
import { isRomanPracticeNotation } from "@/lib/sargam-display"
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
}

type SeedNotation = {
  song_number: number
  source_url?: string | null
  notation_text?: string | null
  scale?: string | null
  verification_status?: string | null
  metadata_json?: Record<string, unknown> | null
}

const RELATED_FIELDS = ["theme", "occasion", "festival", "season", "mood", "language"] as const

let songsByNumber: Map<number, SeedSong> | null = null
let mediaByNumber: Map<number, SeedMedia[]> | null = null
let notationsByNumber: Map<number, SeedNotation> | null = null
let generatedSongsByNumber: Map<number, SeedSong> | null = null
let generatedAudioByNumber: Map<number, SeedMedia> | null = null
let practiceByNumber: Map<number, SeedNotation> | null = null

function generatedDir(): string | null {
  const roots = [
    join(process.cwd(), "data", "generated"),
    join(process.cwd(), "..", "..", "data", "generated"),
  ]
  return roots.find((root) => existsSync(root)) ?? null
}

function readGeneratedJson<T>(filename: string): T | null {
  const root = generatedDir()
  if (!root) return null
  const path = join(root, filename)
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, "utf8")) as T
}

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

function generatedSongIndex() {
  if (!generatedSongsByNumber) {
    generatedSongsByNumber = new Map()
    const rows = readGeneratedJson<SeedSong[]>("songs.json") ?? []
    for (const song of rows) {
      if (isCompleteSargamSong(song.number)) generatedSongsByNumber.set(song.number, song)
    }
  }
  return generatedSongsByNumber
}

function generatedAudioIndex() {
  if (!generatedAudioByNumber) {
    generatedAudioByNumber = new Map()
    const rows = readGeneratedJson<SeedMedia[]>("external_audio.json") ?? []
    for (const item of rows) {
      const number = item.song_number
      if (!number || !isCompleteSargamSong(number) || generatedAudioByNumber.has(number)) continue
      generatedAudioByNumber.set(number, item)
    }
  }
  return generatedAudioByNumber
}

function practiceIndex() {
  if (!practiceByNumber) {
    practiceByNumber = new Map()
    const rows = readGeneratedJson<SeedNotation[]>("notation_practice.json") ?? []
    for (const item of rows) {
      if (isCompleteSargamSong(item.song_number) && isRomanPracticeNotation(item)) {
        practiceByNumber.set(item.song_number, item)
      }
    }
  }
  return practiceByNumber
}

function firstFilled(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (value?.trim()) return value
  }
  return null
}

function resolvedSong(number: number): SeedSong | null {
  const seed = songIndex().get(number)
  const generated = generatedSongIndex().get(number)
  if (!seed && !generated) return null
  if (!generated) return seed ?? null
  if (!seed) return generated
  return {
    ...generated,
    ...seed,
    title: firstFilled(seed.title, generated.title) || generated.title,
    first_line: firstFilled(seed.first_line, generated.first_line),
    lyrics_original: firstFilled(seed.lyrics_original, generated.lyrics_original),
    transliteration: firstFilled(seed.transliteration, generated.transliteration),
    hindi_meaning: firstFilled(seed.hindi_meaning, generated.hindi_meaning),
    english_meaning: firstFilled(seed.english_meaning, generated.english_meaning),
    canonical_source_url: firstFilled(seed.canonical_source_url, generated.canonical_source_url),
    metadata_json: { ...(generated.metadata_json ?? {}), ...(seed.metadata_json ?? {}) },
  }
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
  if (isCompleteSargamSong(song.number)) {
    const catalog = completeSargamSongs()
    const index = catalog.findIndex((item) => item.number === song.number)
    const nearby: SongSummary[] = []
    for (let offset = 1; nearby.length < limit && (index - offset >= 0 || index + offset < catalog.length); offset += 1) {
      const before = catalog[index - offset]
      const after = catalog[index + offset]
      if (after) nearby.push(after)
      if (nearby.length >= limit) break
      if (before) nearby.push(before)
    }
    return nearby
  }
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

function mediaFor(number: number): SongDetail["media"] {
  const seed = (mediaIndex().get(number) ?? []).map((item) => ({
    kind: item.kind,
    provider: item.provider,
    title: item.title,
    url: item.url,
    embed_url: item.embed_url,
    verification_status: item.verification_status,
    source_url: item.source_url,
    notes: item.notes,
  }))
  if (seed.length) return seed
  const generated = generatedAudioIndex().get(number)
  if (!generated) return []
  return [
    {
      kind: generated.kind,
      provider: generated.provider,
      title: generated.title,
      url: generated.url,
      embed_url: generated.embed_url,
      verification_status: generated.verification_status,
      source_url: generated.source_url,
      notes: generated.notes,
    },
  ]
}

function notationFor(number: number): SeedNotation | undefined {
  return practiceIndex().get(number) ?? notationIndex().get(number)
}

export function localSongDetail(number: number): SongDetail | null {
  if (!Number.isInteger(number) || number < 1) return null
  const song = resolvedSong(number)
  if (!song) return null
  const notation = notationFor(number)
  const playable = Boolean(
    bookletHarmoniumSong(number) &&
      (notation?.notation_text?.trim().startsWith("{") || song.harmonium_notation?.trim().startsWith("{")),
  )
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
    media: mediaFor(number),
    notation_scale: notation?.scale,
    notation_source_url: notation?.source_url,
    notation_verification_status: notation?.verification_status,
    notation_transposition_available: playable,
    notation_enabled: true,
    metadata_json: song.metadata_json ?? {},
  }
}

export function localTransposedNotation(number: number, scale = "C"): TransposedNotation | null {
  if (!bookletHarmoniumSong(number)) return null
  const row = notationFor(number)
  const raw = row?.notation_text?.trim()
  if (!raw?.startsWith("{")) return null
  try {
    const notation = JSON.parse(raw) as TransposedNotation["notation"]
    if (!notation?.lines?.length) return null
    return {
      song_number: number,
      source_scale: notation.source_scale || row?.scale || "C",
      target_scale: scale,
      verification_status: row?.verification_status || "practice_draft",
      notation,
    }
  } catch {
    return null
  }
}

export function coalesceSongDetail(remote: SongDetail | null, local: SongDetail | null): SongDetail | null {
  if (!remote) return local
  if (!local) return remote
  return {
    ...remote,
    lyrics_original: firstFilled(remote.lyrics_original, local.lyrics_original),
    transliteration: firstFilled(remote.transliteration, local.transliteration),
    hindi_meaning: firstFilled(remote.hindi_meaning, local.hindi_meaning),
    english_meaning: firstFilled(remote.english_meaning, local.english_meaning),
    media: remote.media.length ? remote.media : local.media,
    notation_scale: remote.notation_scale || local.notation_scale,
    notation_source_url: remote.notation_source_url || local.notation_source_url,
    notation_verification_status: remote.notation_verification_status || local.notation_verification_status,
    notation_transposition_available:
      remote.notation_enabled === false
        ? false
        : Boolean(bookletHarmoniumSong(remote.number)) ||
            remote.notation_verification_status === "admin_submitted" ||
            local.notation_verification_status === "admin_submitted"
          ? remote.notation_transposition_available || local.notation_transposition_available
          : false,
    notation_enabled: remote.notation_enabled ?? local.notation_enabled ?? true,
    sargam_attribution: remote.notation_enabled === false ? null : remote.sargam_attribution ?? local.sargam_attribution,
  }
}
