import { z } from "zod"

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"
const requestTimeoutMs = 15000

const songSummarySchema = z.object({
  number: z.number(),
  title: z.string(),
  first_line: z.string().nullable().optional(),
  theme: z.string().nullable().optional(),
  occasion: z.string().nullable().optional(),
  mood: z.string().nullable().optional(),
  language: z.string().nullable().optional(),
  difficulty: z.string().nullable().optional(),
  is_verified: z.boolean().optional().default(false),
})

const songDetailSchema = songSummarySchema.extend({
  lyrics_original: z.string().nullable().optional(),
  transliteration: z.string().nullable().optional(),
  hindi_meaning: z.string().nullable().optional(),
  english_meaning: z.string().nullable().optional(),
  festival: z.string().nullable().optional(),
  season: z.string().nullable().optional(),
  meditation_context: z.string().nullable().optional(),
  raga: z.string().nullable().optional(),
  tala: z.string().nullable().optional(),
  harmonium_notation: z.string().nullable().optional(),
  canonical_source_url: z.string().nullable().optional(),
  canonical_source_status: z.string(),
  related_songs: z.array(songSummarySchema).default([]),
  media: z.array(z.any()).default([]),
  notation_scale: z.string().nullable().optional(),
  metadata_json: z.record(z.any()).default({}),
})

const notationNoteSchema = z.object({
  sargam: z.string(),
  western: z.string().nullable().optional(),
  duration: z.number(),
  octave: z.enum(["lower", "middle", "upper"]).default("middle"),
  syllable: z.string().nullable().optional(),
  ornament: z.string().nullable().optional(),
})

const notationBeatSchema = z.object({
  beat: z.number(),
  notes: z.array(notationNoteSchema).default([]),
})

const notationMeasureSchema = z.object({
  measures: z.array(notationBeatSchema).default([]),
})

const notationLineSchema = z.object({
  line_number: z.number(),
  lyrics: z.string(),
  transliteration: z.string().nullable().optional(),
  measures: z.array(notationMeasureSchema).default([]),
})

const notationSchema = z.object({
  version: z.number(),
  source_scale: z.string(),
  tempo_bpm: z.number().nullable().optional(),
  tala: z
    .object({
      name: z.string(),
      beats: z.number(),
      groups: z.array(z.number()).default([]),
    })
    .nullable()
    .optional(),
  lines: z.array(notationLineSchema).default([]),
})

const transposedNotationSchema = z.object({
  song_number: z.number(),
  source_scale: z.string(),
  target_scale: z.string(),
  verification_status: z.string(),
  notation: notationSchema,
})

const songLocalizationSchema = z.object({
  song_number: z.number(),
  language: z.string(),
  localized_title: z.string().nullable().optional(),
  localized_first_line: z.string().nullable().optional(),
  localized_meaning: z.string().nullable().optional(),
  localized_explanation: z.string().nullable().optional(),
})

export type SongSummary = z.infer<typeof songSummarySchema>
export type SongDetail = z.infer<typeof songDetailSchema>
export type TransposedNotation = z.infer<typeof transposedNotationSchema>
export type SongLocalization = z.infer<typeof songLocalizationSchema>

export async function fetchJson(path: string, init: RequestInit = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs)
  try {
    return await fetch(`${apiBase}${path}`, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    })
  } finally {
    clearTimeout(timeout)
  }
}

export async function fetchSongs(): Promise<SongSummary[]> {
  try {
    const response = await fetchJson("/api/v1/songs")
    if (!response.ok) {
      return []
    }
    return z.array(songSummarySchema).parse(await response.json())
  } catch {
    return []
  }
}

export async function fetchSong(number: number): Promise<SongDetail | null> {
  try {
    const response = await fetchJson(`/api/v1/songs/${number}`)
    if (!response.ok) {
      return null
    }
    return songDetailSchema.parse(await response.json())
  } catch {
    return null
  }
}

export async function fetchNotation(
  number: number,
  scale = "C",
): Promise<TransposedNotation | null> {
  try {
    const response = await fetchJson(
      `/api/v1/songs/${number}/notation?scale=${encodeURIComponent(scale)}&system=sargam`,
    )
    if (!response.ok) {
      return null
    }
    return transposedNotationSchema.parse(await response.json())
  } catch {
    return null
  }
}

export async function fetchSongLocalization(
  number: number,
  language: string,
): Promise<SongLocalization | null> {
  try {
    const response = await fetchJson(
      `/api/v1/songs/${number}/localized?language=${encodeURIComponent(language)}`,
    )
    if (!response.ok) {
      return null
    }
    return songLocalizationSchema.parse(await response.json())
  } catch {
    return null
  }
}

export async function searchSongs(query: string): Promise<SongSummary[]> {
  try {
    const response = await fetchJson("/api/v1/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    })
    if (!response.ok) {
      return []
    }
    return z.array(songSummarySchema).parse(await response.json())
  } catch {
    return []
  }
}

export async function recommendSongs(payload: Record<string, unknown>): Promise<SongSummary[]> {
  try {
    const response = await fetchJson("/api/v1/recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    if (!response.ok) {
      return []
    }
    return z.array(songSummarySchema).parse(await response.json())
  } catch {
    return []
  }
}

export async function fetchInventory(): Promise<Array<{ source_kind: string; title: string; url: string; status: string; metadata_json: Record<string, unknown>; notes?: string | null }>> {
  try {
    const response = await fetchJson("/api/v1/inventory")
    if (!response.ok) {
      return []
    }
    return z
      .array(
        z.object({
          source_kind: z.string(),
          title: z.string(),
          url: z.string(),
          status: z.string(),
          metadata_json: z.record(z.any()),
          notes: z.string().nullable().optional(),
        }),
      )
      .parse(await response.json())
  } catch {
    return []
  }
}

export function apiUrl(path: string) {
  return `${apiBase}${path}`
}
