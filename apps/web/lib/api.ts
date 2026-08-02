import { z } from "zod"
import { queryGuidanceFor, queryIsUseful } from "@/lib/query-guard"

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"
const requestTimeoutMs = 15000
const searchTimeoutMs = 45000

function searchErrorMessage(error: unknown) {
  if (error instanceof Error) {
    if (error.name === "AbortError" || /abort/i.test(error.message)) {
      return "Search is taking longer than expected. Please try again in a moment."
    }
    if (error.message !== "Failed to fetch") return error.message
  }
  return "Search is temporarily unavailable."
}

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
  media: z.array(z.object({
    kind: z.string(),
    provider: z.string(),
    title: z.string(),
    url: z.string(),
    embed_url: z.string().nullable().optional(),
    verification_status: z.string(),
    source_url: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    channel_name: z.string().nullable().optional(),
    language: z.string().nullable().optional(),
    match_score: z.number().nullable().optional(),
  })).default([]),
  notation_scale: z.string().nullable().optional(),
  notation_source_url: z.string().nullable().optional(),
  notation_verification_status: z.string().nullable().optional(),
  notation_transposition_available: z.boolean().default(false),
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
  beats: z.array(notationBeatSchema).default([]),
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
export type NotationLine = z.infer<typeof notationLineSchema>
export type NotationNote = z.infer<typeof notationNoteSchema>
export type SongLocalization = z.infer<typeof songLocalizationSchema>

const todayRecommendationSchema = z.object({
  context: z.record(z.any()),
  signals: z.array(z.object({
    title: z.string(),
    category: z.string(),
    summary: z.string(),
    source_name: z.string(),
    source_url: z.string(),
  })).default([]),
  recommendations: z.array(z.object({
    number: z.number(),
    title: z.string(),
    first_line: z.string().nullable().optional(),
    score: z.number(),
    reasons: z.array(z.string()).default([]),
    is_verified: z.boolean(),
    audio_url: z.string().nullable().optional(),
    video_embed_url: z.string().nullable().optional(),
    notation_available: z.boolean().default(false),
  })),
  disclaimer: z.string(),
})

export type TodayRecommendations = z.infer<typeof todayRecommendationSchema>

const voiceSearchSchema = z.object({
  heard: z.string(),
  spoken_language: z.string().nullable().optional(),
  interpreted_as: z.string(),
  confidence: z.enum(["high", "medium", "low", "none"]),
  matches: z.array(z.object({
    song: songSummarySchema,
    confidence: z.number(),
    match_reason: z.string(),
  })).max(3),
  guidance: z.string().nullable().optional(),
})

export type VoiceSearchResult = z.infer<typeof voiceSearchSchema>

const reflectionQuoteSchema = z.object({
  quote_text: z.string(),
  attribution: z.string(),
  source_title: z.string(),
  source_url: z.string().url(),
  source_date: z.string().nullable().optional(),
  context_label: z.string(),
  verification_status: z.string(),
})

const testimonialSchema = z.object({
  quote_text: z.string(),
  display_name: z.string(),
  display_location: z.string().nullable().optional(),
  avatar_url: z.string().nullable().optional(),
})

const inspirationStorySchema = z.object({
  slug: z.string(),
  title: z.string(),
  author: z.string(),
  teaser: z.string(),
  read_path: z.string(),
  source_url: z.string(),
  themes: z.array(z.string()).default([]),
  song_numbers: z.array(z.number()).default([]),
})

const inspirationStoryDetailSchema = inspirationStorySchema.extend({
  body_paragraphs: z.array(z.string()).default([]),
})

export type ReflectionQuote = z.infer<typeof reflectionQuoteSchema>
export type CommunityTestimonial = z.infer<typeof testimonialSchema>
export type InspirationStory = z.infer<typeof inspirationStorySchema>
export type InspirationStoryDetail = z.infer<typeof inspirationStoryDetailSchema>

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

async function fetchSearchJson(path: string, init: RequestInit) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), searchTimeoutMs)
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

export async function searchSongs(
  query: string,
  options: { mode?: "catalog" | "semantic" } = {},
): Promise<SongSummary[]> {
  if (!queryIsUseful(query, 200)) throw new Error(queryGuidanceFor(query))
  const mode = options.mode ?? "catalog"
  try {
    const response = await fetchSearchJson("/api/v1/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, mode }),
    })
    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      throw new Error(typeof payload?.detail === "string" ? payload.detail : "Search is temporarily unavailable.")
    }
    return z.array(songSummarySchema).parse(await response.json())
  } catch (error) {
    throw new Error(searchErrorMessage(error))
  }
}

export async function searchSongsByVoice(
  transcript: string,
  spokenLanguage?: string,
  alternatives: string[] = [],
): Promise<VoiceSearchResult> {
  if (!queryIsUseful(transcript, 200)) throw new Error(queryGuidanceFor(transcript))
  const response = await fetchJson("/api/v1/search/voice", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      transcript,
      spoken_language: spokenLanguage,
      alternatives: alternatives.slice(0, 3),
    }),
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(typeof payload?.detail === "string" ? payload.detail : "Voice search is temporarily unavailable.")
  }
  return voiceSearchSchema.parse(payload)
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

export async function fetchTodayRecommendations(): Promise<TodayRecommendations | null> {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata"
    const response = await fetchJson(`/api/v1/recommendations/today?timezone=${encodeURIComponent(timezone)}`)
    if (!response.ok) return null
    return todayRecommendationSchema.parse(await response.json())
  } catch {
    return null
  }
}

export async function fetchTodayReflection(): Promise<ReflectionQuote | null> {
  try {
    const response = await fetchJson("/api/v1/reflections/today")
    if (!response.ok) return null
    return reflectionQuoteSchema.parse(await response.json())
  } catch {
    return null
  }
}

export async function fetchTestimonials(): Promise<CommunityTestimonial[]> {
  try {
    const response = await fetchJson("/api/v1/testimonials?limit=8")
    if (!response.ok) return []
    return z.array(testimonialSchema).parse(await response.json())
  } catch {
    return []
  }
}

export async function fetchStories(options: { songNumber?: number; limit?: number } = {}): Promise<InspirationStory[]> {
  try {
    const params = new URLSearchParams()
    if (options.songNumber) params.set("song_number", String(options.songNumber))
    if (options.limit) params.set("limit", String(options.limit))
    const suffix = params.size ? `?${params.toString()}` : ""
    const response = await fetchJson(`/api/v1/stories${suffix}`)
    if (!response.ok) return []
    return z.array(inspirationStorySchema).parse(await response.json())
  } catch {
    return []
  }
}

export async function fetchFeaturedStory(): Promise<InspirationStory | null> {
  try {
    const response = await fetchJson("/api/v1/stories/featured")
    if (!response.ok) return null
    return inspirationStorySchema.parse(await response.json())
  } catch {
    return null
  }
}

export async function fetchStory(slug: string): Promise<InspirationStoryDetail | null> {
  try {
    const response = await fetchJson(`/api/v1/stories/${encodeURIComponent(slug)}`)
    if (!response.ok) return null
    return inspirationStoryDetailSchema.parse(await response.json())
  } catch {
    return null
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

export async function submitFeedback(payload: {
  category: string
  rating: number
  comment: string
  page_path?: string
  contact?: string
}): Promise<{ message: string; feedbackId: string }> {
  const response = await fetchJson("/api/v1/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(typeof body?.detail === "string" ? body.detail : "Feedback could not be sent. Please try again.")
  }
  return {
    message: typeof body?.message === "string" ? body.message : "Thank you for helping us improve.",
    feedbackId: typeof body?.feedback_id === "string" ? body.feedback_id : "",
  }
}
