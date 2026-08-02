import { z } from "zod"

import { queryGuidanceFor, queryIsUseful } from "./query-guard"

export const songSummarySchema = z.object({
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

export const songDetailSchema = songSummarySchema.extend({
  lyrics_original: z.string().nullable().optional(),
  transliteration: z.string().nullable().optional(),
  hindi_meaning: z.string().nullable().optional(),
  english_meaning: z.string().nullable().optional(),
  festival: z.string().nullable().optional(),
  season: z.string().nullable().optional(),
  meditation_context: z.string().nullable().optional(),
  raga: z.string().nullable().optional(),
  tala: z.string().nullable().optional(),
  canonical_source_url: z.string().nullable().optional(),
  canonical_source_status: z.string(),
  related_songs: z.array(songSummarySchema).default([]),
  media: z
    .array(
      z.object({
        kind: z.string(),
        provider: z.string(),
        title: z.string(),
        url: z.string(),
        embed_url: z.string().nullable().optional(),
        verification_status: z.string(),
      }),
    )
    .default([]),
  notation_verification_status: z.string().nullable().optional(),
})

export const inspirationStorySchema = z.object({
  slug: z.string(),
  title: z.string(),
  author: z.string(),
  teaser: z.string(),
  read_path: z.string(),
  source_url: z.string().nullable().optional(),
  themes: z.array(z.string()).default([]),
  song_numbers: z.array(z.number()).default([]),
})

export const inspirationStoryDetailSchema = inspirationStorySchema.extend({
  body_paragraphs: z.array(z.string()).default([]),
})

export const todayRecommendationSchema = z.object({
  date: z.string(),
  timezone: z.string(),
  occasion: z.string().nullable().optional(),
  festival: z.string().nullable().optional(),
  songs: z.array(songSummarySchema).default([]),
  rationale: z.string().nullable().optional(),
})

export const reflectionQuoteSchema = z.object({
  quote: z.string(),
  attribution: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
})

export type SongSummary = z.infer<typeof songSummarySchema>
export type SongDetail = z.infer<typeof songDetailSchema>
export type InspirationStory = z.infer<typeof inspirationStorySchema>
export type InspirationStoryDetail = z.infer<typeof inspirationStoryDetailSchema>
export type TodayRecommendations = z.infer<typeof todayRecommendationSchema>
export type ReflectionQuote = z.infer<typeof reflectionQuoteSchema>

export type ApiClientOptions = {
  baseUrl: string
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

export type ConversationTurn = {
  role: "user" | "assistant"
  content: string
}

async function readEventStream(response: Response, onChunk: (chunk: string) => void) {
  if (!response.body) {
    onChunk("Streaming unavailable.")
    return
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const frames = buffer.split("\n\n")
    buffer = frames.pop() ?? ""
    for (const frame of frames) {
      const payload = frame
        .split("\n")
        .filter((entry) => entry.startsWith("data: "))
        .map((entry) => entry.slice(6))
        .join("\n")
      if (payload) onChunk(payload)
    }
  }
  buffer += decoder.decode()
  if (buffer.trim()) {
    const payload = buffer
      .split("\n")
      .filter((entry) => entry.startsWith("data: "))
      .map((entry) => entry.slice(6))
      .join("\n")
    if (payload) onChunk(payload)
  }
}

export function createApiClient(options: ApiClientOptions) {
  const baseUrl = options.baseUrl.replace(/\/$/, "")
  const timeoutMs = options.timeoutMs ?? 15000
  const fetchImpl = options.fetchImpl ?? fetch

  async function fetchJson(path: string, init?: RequestInit) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    try {
      return await fetchImpl(`${baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          ...(init?.headers ?? {}),
        },
      })
    } finally {
      clearTimeout(timeout)
    }
  }

  return {
    apiUrl(path: string) {
      return `${baseUrl}${path}`
    },

    async fetchSong(number: number): Promise<SongDetail | null> {
      try {
        const response = await fetchJson(`/api/v1/songs/${number}`)
        if (!response.ok) return null
        return songDetailSchema.parse(await response.json())
      } catch {
        return null
      }
    },

    async searchSongs(query: string): Promise<SongSummary[]> {
      if (!queryIsUseful(query, 200)) throw new Error(queryGuidanceFor(query))
      try {
        const response = await fetchJson("/api/v1/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
        })
        if (!response.ok) {
          const payload = await response.json().catch(() => null)
          throw new Error(typeof payload?.detail === "string" ? payload.detail : "Search is temporarily unavailable.")
        }
        return z.array(songSummarySchema).parse(await response.json())
      } catch (error) {
        if (error instanceof Error && error.message !== "Failed to fetch") throw error
        return []
      }
    },

    async recommendSongs(payload: Record<string, unknown>): Promise<SongSummary[]> {
      try {
        const response = await fetchJson("/api/v1/recommendations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!response.ok) return []
        return z.array(songSummarySchema).parse(await response.json())
      } catch {
        return []
      }
    },

    async fetchTodayRecommendations(): Promise<TodayRecommendations | null> {
      try {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata"
        const response = await fetchJson(`/api/v1/recommendations/today?timezone=${encodeURIComponent(timezone)}`)
        if (!response.ok) return null
        return todayRecommendationSchema.parse(await response.json())
      } catch {
        return null
      }
    },

    async fetchTodayReflection(): Promise<ReflectionQuote | null> {
      try {
        const response = await fetchJson("/api/v1/reflections/today")
        if (!response.ok) return null
        return reflectionQuoteSchema.parse(await response.json())
      } catch {
        return null
      }
    },

    async fetchStories(optionsArg: { songNumber?: number; limit?: number } = {}): Promise<InspirationStory[]> {
      try {
        const params = new URLSearchParams()
        if (optionsArg.songNumber) params.set("song_number", String(optionsArg.songNumber))
        if (optionsArg.limit) params.set("limit", String(optionsArg.limit))
        const suffix = params.size ? `?${params.toString()}` : ""
        const response = await fetchJson(`/api/v1/stories${suffix}`)
        if (!response.ok) return []
        return z.array(inspirationStorySchema).parse(await response.json())
      } catch {
        return []
      }
    },

    async fetchFeaturedStory(): Promise<InspirationStory | null> {
      try {
        const response = await fetchJson("/api/v1/stories/featured")
        if (!response.ok) return null
        return inspirationStorySchema.parse(await response.json())
      } catch {
        return null
      }
    },

    async fetchStory(slug: string): Promise<InspirationStoryDetail | null> {
      try {
        const response = await fetchJson(`/api/v1/stories/${encodeURIComponent(slug)}`)
        if (!response.ok) return null
        return inspirationStoryDetailSchema.parse(await response.json())
      } catch {
        return null
      }
    },

    async streamExplanation(
      songNumber: number,
      onChunk: (chunk: string) => void,
      prompt?: string,
      history: ConversationTurn[] = [],
    ): Promise<void> {
      if (prompt && !queryIsUseful(prompt, 800)) {
        onChunk(queryGuidanceFor(prompt))
        return
      }
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 60_000)
      let response: Response
      try {
        response = await fetchImpl(`${baseUrl}/api/v1/ai/explain`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
          body: JSON.stringify({
            song_number: songNumber,
            prompt,
            history: history.slice(-12),
          }),
          signal: controller.signal,
        })
      } finally {
        clearTimeout(timeout)
      }
      if (!response.ok) {
        throw new Error("The song companion is temporarily unavailable.")
      }
      await readEventStream(response, onChunk)
    },
  }
}

export type ApiClient = ReturnType<typeof createApiClient>
