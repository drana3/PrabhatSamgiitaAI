import { z } from "zod"

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"

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

export type SongSummary = z.infer<typeof songSummarySchema>
export type SongDetail = z.infer<typeof songDetailSchema>

export async function fetchSongs(): Promise<SongSummary[]> {
  try {
    const response = await fetch(`${apiBase}/api/v1/songs`, { cache: "no-store" })
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
    const response = await fetch(`${apiBase}/api/v1/songs/${number}`, { cache: "no-store" })
    if (!response.ok) {
      return null
    }
    return songDetailSchema.parse(await response.json())
  } catch {
    return null
  }
}

export async function searchSongs(query: string): Promise<SongSummary[]> {
  try {
    const response = await fetch(`${apiBase}/api/v1/search`, {
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
    const response = await fetch(`${apiBase}/api/v1/recommendations`, {
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
    const response = await fetch(`${apiBase}/api/v1/inventory`, { cache: "no-store" })
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
