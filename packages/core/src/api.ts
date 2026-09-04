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
  notation_scale: z.string().nullable().optional(),
  notation_source_url: z.string().nullable().optional(),
  notation_verification_status: z.string().nullable().optional(),
  notation_transposition_available: z.boolean().optional().default(false),
  notation_enabled: z.boolean().optional().default(true),
  sargam_attribution: z
    .object({
      display_name: z.string(),
      submitted_at: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  metadata_json: z.record(z.unknown()).optional().default({}),
})

export const notationNoteSchema = z.object({
  sargam: z.string(),
  western: z.string().nullable().optional(),
  duration: z.number(),
  octave: z.enum(["lower", "middle", "upper"]).default("middle"),
  syllable: z.string().nullable().optional(),
  ornament: z.string().nullable().optional(),
})

export const notationLineSchema = z.object({
  line_number: z.number(),
  lyrics: z.string(),
  transliteration: z.string().nullable().optional(),
  measures: z
    .array(
      z.object({
        beats: z
          .array(
            z.object({
              beat: z.number(),
              notes: z.array(notationNoteSchema).default([]),
            }),
          )
          .default([]),
      }),
    )
    .default([]),
})

export const transposedNotationSchema = z.object({
  song_number: z.number(),
  source_scale: z.string(),
  target_scale: z.string(),
  verification_status: z.string(),
  notation: z.object({
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
  }),
  sargam_attribution: z
    .object({
      display_name: z.string(),
      submitted_at: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
})

export const songLocalizationSchema = z.object({
  song_number: z.number(),
  language: z.string(),
  localized_title: z.string().nullable().optional(),
  localized_first_line: z.string().nullable().optional(),
  localized_meaning: z.string().nullable().optional(),
  localized_explanation: z.string().nullable().optional(),
})

export const adminFeedbackItemSchema = z.object({
  feedback_id: z.string(),
  category: z.string(),
  rating: z.number(),
  comment: z.string(),
  page_path: z.string().nullable().optional(),
  contact: z.string().nullable().optional(),
  status: z.string(),
  created_at: z.string(),
  priority: z.boolean().optional().default(false),
  on_live_ticker: z.boolean().optional().default(false),
})

export const adminFeedbackListSchema = z.object({
  total: z.number(),
  items: z.array(adminFeedbackItemSchema).default([]),
})

export const adminMemberSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  display_name: z.string(),
  email: z.string().nullable().optional(),
  phone_e164: z.string().nullable().optional(),
  is_admin: z.boolean(),
  is_protected: z.boolean().optional().default(false),
})

export type TransposedNotation = z.infer<typeof transposedNotationSchema>
export type SongLocalization = z.infer<typeof songLocalizationSchema>
export type AdminFeedbackItem = z.infer<typeof adminFeedbackItemSchema>
export type AdminFeedbackList = z.infer<typeof adminFeedbackListSchema>
export type AdminMember = z.infer<typeof adminMemberSchema>

export const sargamCaptureEventSchema = z.object({
  sargam: z.string(),
  western: z.string(),
  startSec: z.number(),
  durationSec: z.number(),
})

export const sargamCaptureLineSchema = z.object({
  line_number: z.number(),
  lyric: z.string(),
  lyric_original: z.string().nullable().optional(),
  status: z.enum(["empty", "recorded", "confirmed"]),
  events: z.array(sargamCaptureEventSchema).default([]),
  sargam: z.string().nullable().optional(),
})

export const sargamCaptureSchema = z.object({
  song_number: z.number(),
  title: z.string(),
  booklet_locked: z.boolean().optional().default(false),
  source_scale: z.string().optional().default("C"),
  tempo_bpm: z.number().optional().default(100),
  can_submit: z.boolean().optional().default(false),
  submitted: z.boolean().optional().default(false),
  notation_enabled: z.boolean().optional().default(true),
  listen_url: z.string().nullable().optional(),
  lines: z.array(sargamCaptureLineSchema).default([]),
})

export const sargamCaptureMutationSchema = z.object({
  song_number: z.number(),
  source_scale: z.string().optional().default("C"),
  tempo_bpm: z.number().optional().default(100),
  can_submit: z.boolean().optional().default(false),
  submitted: z.boolean().optional().default(false),
  notation_enabled: z.boolean().nullable().optional(),
  line: sargamCaptureLineSchema.nullable().optional(),
})

export type SargamCaptureEvent = z.infer<typeof sargamCaptureEventSchema>
export type SargamCaptureMutation = z.infer<typeof sargamCaptureMutationSchema>
export type SargamCaptureLine = z.infer<typeof sargamCaptureLineSchema>
export type SargamCapturePayload = z.infer<typeof sargamCaptureSchema>

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

export const todayContextSignalSchema = z.object({
  title: z.string(),
  category: z.string().optional().default("news"),
  summary: z.string().nullable().optional().default(""),
  source_name: z.string().nullable().optional().default(""),
  source_url: z.string().nullable().optional().default(""),
  keywords: z.array(z.string()).optional().default([]),
})

export const todayRecommendationItemSchema = z.object({
  number: z.number(),
  title: z.string(),
  first_line: z.string().nullable().optional(),
  score: z.number().optional().default(0),
  reasons: z.array(z.string()).default([]),
  is_verified: z.boolean().optional().default(false),
  audio_url: z.string().nullable().optional(),
  video_embed_url: z.string().nullable().optional(),
  notation_available: z.boolean().optional().default(false),
})

/** Matches GET /api/v1/recommendations/today (live API + website). */
export const todayRecommendationSchema = z
  .object({
    context: z
      .object({
        date: z.string().optional(),
        timezone: z.string().optional(),
        time_of_day: z.string().nullable().optional(),
        season: z.string().nullable().optional(),
        festival: z.string().nullable().optional(),
        observance: z.string().nullable().optional(),
        recommendation_mode: z.string().optional(),
        humanitarian_context: z.string().nullable().optional(),
        canonical_collections: z.array(z.string()).optional(),
      })
      .passthrough()
      .default({}),
    signals: z.array(todayContextSignalSchema.passthrough()).default([]),
    recommendations: z.array(todayRecommendationItemSchema.passthrough()).default([]),
    disclaimer: z.string().optional().default(""),
  })
  .passthrough()

/** Matches GET /api/v1/reflections/today (live API + website). */
export const reflectionQuoteSchema = z
  .object({
    quote_text: z.string(),
    attribution: z.string(),
    source_title: z.string(),
    source_url: z.string(),
    source_date: z.string().nullable().optional(),
    context_label: z.string(),
    verification_status: z.string().optional(),
  })
  .passthrough()

export type SongSummary = z.infer<typeof songSummarySchema>
export type SongDetail = z.infer<typeof songDetailSchema>
export type InspirationStory = z.infer<typeof inspirationStorySchema>
export type InspirationStoryDetail = z.infer<typeof inspirationStoryDetailSchema>
export type TodayRecommendations = z.infer<typeof todayRecommendationSchema>
export type TodayContextSignal = z.infer<typeof todayContextSignalSchema>
export type TodayRecommendationItem = z.infer<typeof todayRecommendationItemSchema>
export type ReflectionQuote = z.infer<typeof reflectionQuoteSchema>

export const activeSiteAnnouncementSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  kind: z.string(),
  priority: z.string(),
  ends_at: z.string(),
})

export const activeSiteAnnouncementsListSchema = z.object({
  items: z.array(activeSiteAnnouncementSchema).default([]),
})

export type ActiveSiteAnnouncement = z.infer<typeof activeSiteAnnouncementSchema>

export const voiceSearchSchema = z.object({
  heard: z.string(),
  spoken_language: z.string().nullable().optional(),
  interpreted_as: z.string(),
  confidence: z.enum(["high", "medium", "low", "none"]),
  matches: z
    .array(
      z.object({
        song: songSummarySchema,
        confidence: z.number(),
        match_reason: z.string(),
      }),
    )
    .max(12),
  guidance: z.string().nullable().optional(),
})

export const testimonialSchema = z.object({
  quote_text: z.string(),
  display_name: z.string(),
  display_location: z.string().nullable().optional(),
  avatar_url: z.string().nullable().optional(),
})

export type VoiceSearchResult = z.infer<typeof voiceSearchSchema>
export type CommunityTestimonial = z.infer<typeof testimonialSchema>

export const feedbackResponseSchema = z.object({
  feedback_id: z.string(),
  status: z.string().optional(),
  message: z.string(),
})

export type FeedbackResponse = z.infer<typeof feedbackResponseSchema>

export type FeedbackPayload = {
  category: string
  rating: number
  comment: string
  page_path?: string
  contact?: string
}

export const memberProfileSchema = z
  .object({
    authenticated: z.literal(true),
    id: z.string(),
    display_name: z.string(),
    email: z.string().nullable().optional(),
    avatar_url: z.string().nullable().optional(),
    identity_provider: z.string(),
    preferred_language: z.string().nullable().optional(),
    country: z.string().nullable().optional(),
    phone_e164: z.string().nullable().optional(),
    phone_display: z.string().nullable().optional(),
    phone_country_code: z.string().nullable().optional(),
    phone_verified: z.boolean().optional().default(false),
    phone_required: z.boolean().optional().default(false),
    phone_verification_required: z.boolean().optional().default(false),
    personalization_enabled: z.boolean().optional().default(true),
    is_admin: z.boolean().optional().default(false),
    is_super_admin: z.boolean().optional().default(false),
    favorite_song_numbers: z.array(z.number()).default([]),
  })
  .passthrough()

export const memberSessionSchema = z.union([
  memberProfileSchema,
  z.object({ authenticated: z.literal(false) }),
])

export const chatMemoryTurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
})

export const chatHistoryDaySchema = z.object({
  date: z.string(),
  turns: z.array(chatMemoryTurnSchema).default([]),
})

export const chatMemoryResponseSchema = z.object({
  summary: z.string().optional().default(""),
  recent_turns: z.array(chatMemoryTurnSchema).default([]),
  history_days: z.array(chatHistoryDaySchema).default([]),
  archived_summary: z.string().optional().default(""),
  monthly_summaries: z.record(z.string()).optional().default({}),
})

export type MemberProfile = z.infer<typeof memberProfileSchema>
export type MemberSession = z.infer<typeof memberSessionSchema>
export type ChatMemoryResponse = z.infer<typeof chatMemoryResponseSchema>
export type ChatMemoryTurn = z.infer<typeof chatMemoryTurnSchema>
export type ChatHistoryDay = z.infer<typeof chatHistoryDaySchema>

export type ApiClientOptions = {
  baseUrl: string
  timeoutMs?: number
  fetchImpl?: typeof fetch
  searchTimeoutMs?: number
  /** Optional member auth headers for /members/* preview or native Easy Auth. */
  getAuthHeaders?: () => Record<string, string> | Promise<Record<string, string>>
}

export type ConversationTurn = {
  role: "user" | "assistant"
  content: string
}

function sseDataPayload(frame: string): string {
  return frame
    .split("\n")
    .filter((entry) => entry.startsWith("data: "))
    .map((entry) => entry.slice(6))
    .join("\n")
}

/** Emit complete SSE frames; optionally flush a trailing partial frame (end of stream). */
function emitSseFrames(raw: string, onChunk: (chunk: string) => void, flushPartial = false): string {
  const frames = raw.split("\n\n")
  const remainder = frames.pop() ?? ""
  for (const frame of frames) {
    const payload = sseDataPayload(frame)
    if (payload) onChunk(payload)
  }
  if (flushPartial && remainder.trim()) {
    const payload = sseDataPayload(remainder)
    if (payload) onChunk(payload)
    return ""
  }
  return remainder
}

async function readEventStream(response: Response, onChunk: (chunk: string) => void) {
  const body = response.body

  // React Native / some Expo fetch builds buffer the body but leave `response.body` null.
  // Fall back to text() and parse the full SSE payload so chat still works.
  if (!body || typeof body.getReader !== "function") {
    const raw = await response.text()
    if (!raw.trim()) {
      onChunk("Streaming unavailable.")
      return
    }
    emitSseFrames(raw, onChunk, true)
    return
  }

  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    buffer = emitSseFrames(buffer, onChunk, false)
  }
  buffer += decoder.decode()
  emitSseFrames(buffer, onChunk, true)
}

async function readApiErrorDetail(response: Response, fallback = "Request failed"): Promise<string> {
  try {
    const payload = (await response.json()) as { detail?: unknown }
    if (typeof payload?.detail === "string") return payload.detail
    if (Array.isArray(payload?.detail)) {
      const joined = payload.detail
        .map((entry) =>
          typeof entry === "string"
            ? entry
            : typeof entry === "object" && entry && "msg" in entry
              ? String((entry as { msg: unknown }).msg)
              : null,
        )
        .filter(Boolean)
        .join("; ")
      if (joined) return joined
    }
  } catch {
    /* ignore */
  }
  return `${fallback} (${response.status})`
}

export function createApiClient(options: ApiClientOptions) {
  const baseUrl = options.baseUrl.replace(/\/$/, "")
  const timeoutMs = options.timeoutMs ?? 15000
  const searchTimeoutMs = options.searchTimeoutMs ?? 20000
  const fetchImpl = options.fetchImpl ?? fetch

  async function authHeaders() {
    return (await options.getAuthHeaders?.()) ?? {}
  }

  async function fetchJson(path: string, init?: RequestInit, timeout = timeoutMs) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)
    const userSignal = init?.signal
    const onUserAbort = () => controller.abort()
    if (userSignal) {
      if (userSignal.aborted) controller.abort()
      else userSignal.addEventListener("abort", onUserAbort, { once: true })
    }
    try {
      const extraAuth = await authHeaders()
      const { signal: _userSignal, ...rest } = init ?? {}
      return await fetchImpl(`${baseUrl}${path}`, {
        ...rest,
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          ...extraAuth,
          ...(init?.headers ?? {}),
        },
      })
    } finally {
      clearTimeout(timer)
      userSignal?.removeEventListener("abort", onUserAbort)
    }
  }

  return {
    apiUrl(path: string) {
      return `${baseUrl}${path}`
    },

    async fetchSongs(): Promise<SongSummary[]> {
      try {
        const response = await fetchJson("/api/v1/songs")
        if (!response.ok) return []
        return z.array(songSummarySchema).parse(await response.json())
      } catch {
        return []
      }
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

    async fetchNotation(number: number, scale = "C"): Promise<TransposedNotation | null> {
      try {
        const response = await fetchJson(
          `/api/v1/songs/${number}/notation?scale=${encodeURIComponent(scale)}&system=sargam`,
        )
        if (!response.ok) return null
        return transposedNotationSchema.parse(await response.json())
      } catch {
        return null
      }
    },

    async fetchSongLocalization(number: number, language: string): Promise<SongLocalization | null> {
      try {
        const response = await fetchJson(
          `/api/v1/songs/${number}/localized?language=${encodeURIComponent(language)}`,
          undefined,
          90_000,
        )
        if (!response.ok) return null
        return songLocalizationSchema.parse(await response.json())
      } catch {
        return null
      }
    },

    async fetchAdminFeedback(status: "new" | "reviewed" | "actioned" | "all" = "new"): Promise<AdminFeedbackList> {
      try {
        const response = await fetchJson(`/api/v1/members/admin/feedback?status=${status}`)
        if (!response.ok) return { total: 0, items: [] }
        return adminFeedbackListSchema.parse(await response.json())
      } catch {
        return { total: 0, items: [] }
      }
    },

    async updateAdminFeedback(
      feedbackId: string,
      body: {
        status?: "new" | "reviewed" | "actioned" | "dismissed"
        publish_to_live?: boolean
        unpublish_from_live?: boolean
        review_note?: string
      },
    ): Promise<{ ok: boolean; detail?: string }> {
      try {
        const response = await fetchJson(`/api/v1/members/admin/feedback/${encodeURIComponent(feedbackId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        if (response.ok) return { ok: true }
        let detail: string | undefined
        try {
          const payload = (await response.json()) as { detail?: unknown }
          if (typeof payload?.detail === "string") detail = payload.detail
          else if (Array.isArray(payload?.detail)) {
            detail = payload.detail
              .map((entry) =>
                typeof entry === "string"
                  ? entry
                  : typeof entry === "object" && entry && "msg" in entry
                    ? String((entry as { msg: unknown }).msg)
                    : null,
              )
              .filter(Boolean)
              .join("; ")
          }
        } catch {
          detail = undefined
        }
        return { ok: false, detail: detail || `Could not update feedback (${response.status})` }
      } catch {
        return { ok: false, detail: "Could not reach the admin service" }
      }
    },

    async fetchAdminMembers(): Promise<AdminMember[]> {
      try {
        const response = await fetchJson("/api/v1/members/admin/users")
        if (!response.ok) return []
        return z.array(adminMemberSchema).parse(await response.json())
      } catch {
        return []
      }
    },

    async grantAdmin(email: string): Promise<boolean> {
      try {
        const response = await fetchJson("/api/v1/members/admin/grant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        })
        return response.ok
      } catch {
        return false
      }
    },

    async revokeAdmin(userId: string): Promise<boolean> {
      try {
        const response = await fetchJson(`/api/v1/members/admin/users/${encodeURIComponent(userId)}`, {
          method: "DELETE",
        })
        return response.ok || response.status === 204
      } catch {
        return false
      }
    },

    async fetchAdminSargamCapture(number: number): Promise<SargamCapturePayload | null> {
      try {
        const response = await fetchJson(
          `/api/v1/members/admin/songs/${encodeURIComponent(String(number))}/sargam-capture`,
        )
        if (!response.ok) return null
        return sargamCaptureSchema.parse(await response.json())
      } catch {
        return null
      }
    },

    async saveAdminSargamTake(
      number: number,
      lineNumber: number,
      body: { events: SargamCaptureEvent[]; source_scale?: string; tempo_bpm?: number },
    ): Promise<{ ok: boolean; patch?: SargamCaptureMutation; detail?: string }> {
      try {
        const response = await fetchJson(
          `/api/v1/members/admin/songs/${encodeURIComponent(String(number))}/sargam-capture/lines/${encodeURIComponent(String(lineNumber))}/takes`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
        )
        if (response.ok) {
          return { ok: true, patch: sargamCaptureMutationSchema.parse(await response.json()) }
        }
        return { ok: false, detail: await readApiErrorDetail(response) }
      } catch {
        return { ok: false, detail: "Could not reach the admin service" }
      }
    },

    async postAdminSargamLineAction(
      number: number,
      lineNumber: number,
      action: "confirm" | "retake",
    ): Promise<{ ok: boolean; patch?: SargamCaptureMutation; detail?: string }> {
      try {
        const response = await fetchJson(
          `/api/v1/members/admin/songs/${encodeURIComponent(String(number))}/sargam-capture/lines/${encodeURIComponent(String(lineNumber))}/${action}`,
          { method: "POST" },
        )
        if (response.ok) {
          return { ok: true, patch: sargamCaptureMutationSchema.parse(await response.json()) }
        }
        return { ok: false, detail: await readApiErrorDetail(response) }
      } catch {
        return { ok: false, detail: "Could not reach the admin service" }
      }
    },

    async submitAdminSargamCapture(
      number: number,
    ): Promise<{ ok: boolean; patch?: SargamCaptureMutation; detail?: string }> {
      try {
        const response = await fetchJson(
          `/api/v1/members/admin/songs/${encodeURIComponent(String(number))}/sargam-capture/submit`,
          { method: "POST" },
        )
        if (response.ok) {
          return { ok: true, patch: sargamCaptureMutationSchema.parse(await response.json()) }
        }
        return { ok: false, detail: await readApiErrorDetail(response) }
      } catch {
        return { ok: false, detail: "Could not reach the admin service" }
      }
    },

    async setAdminSargamVisibility(
      number: number,
      enabled: boolean,
    ): Promise<{ ok: boolean; patch?: SargamCaptureMutation; detail?: string }> {
      try {
        const response = await fetchJson(
          `/api/v1/members/admin/songs/${encodeURIComponent(String(number))}/sargam-capture/visibility`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ enabled }),
          },
        )
        if (response.ok) {
          return { ok: true, patch: sargamCaptureMutationSchema.parse(await response.json()) }
        }
        return { ok: false, detail: await readApiErrorDetail(response) }
      } catch {
        return { ok: false, detail: "Could not reach the admin service" }
      }
    },

    async searchSongs(
      query: string,
      searchOptions: { mode?: "catalog" | "semantic"; signal?: AbortSignal } = {},
    ): Promise<SongSummary[]> {
      if (!queryIsUseful(query, 200)) throw new Error(queryGuidanceFor(query))
      const mode = searchOptions.mode ?? "catalog"
      try {
        const response = await fetchJson(
          "/api/v1/search",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query, mode }),
            signal: searchOptions.signal,
          },
          searchTimeoutMs,
        )
        if (!response.ok) {
          const payload = await response.json().catch(() => null)
          throw new Error(
            typeof payload?.detail === "string" ? payload.detail : "Search is temporarily unavailable.",
          )
        }
        return z.array(songSummarySchema).parse(await response.json())
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          if (searchOptions.signal?.aborted) throw error
          throw new Error("Search is taking longer than expected. Please try again.")
        }
        if (error instanceof Error) throw error
        throw new Error("Search is temporarily unavailable.")
      }
    },

    async searchSongsByVoice(
      transcript: string,
      spokenLanguage?: string,
      alternatives: string[] = [],
    ): Promise<VoiceSearchResult> {
      if (!queryIsUseful(transcript, 200)) throw new Error(queryGuidanceFor(transcript))
      const response = await fetchJson(
        "/api/v1/search/voice",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcript,
            spoken_language: spokenLanguage,
            alternatives: alternatives.slice(0, 3),
          }),
        },
        searchTimeoutMs,
      )
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(
          typeof payload?.detail === "string" ? payload.detail : "Voice search is temporarily unavailable.",
        )
      }
      return voiceSearchSchema.parse(payload)
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
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata"
      const url = `/api/v1/recommendations/today?timezone=${encodeURIComponent(timezone)}`
      // Today builds news + ranking; allow more than the default 15s client timeout.
      const attempt = async () => {
        const response = await fetchJson(url, undefined, 25_000)
        if (!response.ok) return null
        const parsed = todayRecommendationSchema.safeParse(await response.json())
        return parsed.success ? parsed.data : null
      }
      try {
        const first = await attempt()
        if (first) return first
        // One quiet retry for transient empty/timeouts — keeps home smooth.
        return await attempt()
      } catch {
        try {
          return await attempt()
        } catch {
          return null
        }
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

    async fetchActiveAnnouncements(): Promise<ActiveSiteAnnouncement[]> {
      try {
        const response = await fetchJson("/api/v1/announcements/active")
        if (!response.ok) return []
        return activeSiteAnnouncementsListSchema.parse(await response.json()).items
      } catch {
        return []
      }
    },

    async fetchTestimonials(limit = 8): Promise<CommunityTestimonial[]> {
      try {
        const response = await fetchJson(`/api/v1/testimonials?limit=${limit}`)
        if (!response.ok) return []
        return z.array(testimonialSchema).parse(await response.json())
      } catch {
        return []
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

    async submitFeedback(payload: FeedbackPayload): Promise<FeedbackResponse> {
      const response = await fetchJson("/api/v1/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(
          typeof body?.detail === "string" ? body.detail : "Feedback could not be sent. Please try again.",
        )
      }
      return feedbackResponseSchema.parse(body)
    },

    async fetchMemberSession(): Promise<MemberSession> {
      try {
        const response = await fetchJson("/api/v1/members/session")
        if (!response.ok) return { authenticated: false }
        return memberSessionSchema.parse(await response.json())
      } catch {
        return { authenticated: false }
      }
    },

    async fetchMemberChat(songNumber?: number): Promise<ChatMemoryResponse & { ok: boolean }> {
      const empty = {
        ok: false as const,
        summary: "",
        recent_turns: [] as ChatMemoryTurn[],
        history_days: [] as ChatMemoryResponse["history_days"],
        archived_summary: "",
        monthly_summaries: {} as ChatMemoryResponse["monthly_summaries"],
      }
      try {
        const suffix = songNumber ? `?song_number=${encodeURIComponent(String(songNumber))}` : ""
        const response = await fetchJson(`/api/v1/members/chat-memory${suffix}`)
        if (!response.ok) return empty
        return { ok: true, ...chatMemoryResponseSchema.parse(await response.json()) }
      } catch {
        return empty
      }
    },

    async saveMemberChat(payload: {
      song_number?: number
      turns: ChatMemoryTurn[]
    }): Promise<boolean> {
      try {
        const response = await fetchJson("/api/v1/members/chat-memory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        return response.ok
      } catch {
        return false
      }
    },

    async clearMemberChat(): Promise<boolean> {
      try {
        const response = await fetchJson("/api/v1/members/chat-memory", { method: "DELETE" })
        return response.ok || response.status === 204
      } catch {
        return false
      }
    },

    async updateMemberPreferences(payload: {
      display_name?: string
      preferred_language?: string | null
      country?: string | null
      personalization_enabled?: boolean
    }): Promise<MemberProfile | null> {
      try {
        const response = await fetchJson("/api/v1/members/preferences", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!response.ok) return null
        return memberProfileSchema.parse(await response.json())
      } catch {
        return null
      }
    },

    async deleteMemberAccount(): Promise<boolean> {
      try {
        const response = await fetchJson("/api/v1/members/me", { method: "DELETE" })
        return response.ok || response.status === 204
      } catch {
        return false
      }
    },

    async fetchMemberFavorites(): Promise<number[] | null> {
      try {
        const response = await fetchJson("/api/v1/members/favorites")
        // null = request failed (callers must not wipe local favorites)
        if (!response.ok) return null
        return z.array(z.number()).parse(await response.json())
      } catch {
        return null
      }
    },

    async addMemberFavorite(songNumber: number): Promise<number[]> {
      const response = await fetchJson("/api/v1/members/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ song_number: songNumber }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(typeof body?.detail === "string" ? body.detail : "Could not save favorite.")
      }
      return z.array(z.number()).parse(body)
    },

    async removeMemberFavorite(songNumber: number): Promise<number[]> {
      const response = await fetchJson(`/api/v1/members/favorites/${songNumber}`, {
        method: "DELETE",
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(typeof body?.detail === "string" ? body.detail : "Could not remove favorite.")
      }
      return z.array(z.number()).parse(body)
    },

    async fetchQuizStatus(): Promise<unknown | null> {
      try {
        const response = await fetchJson("/api/v1/members/quiz/status")
        if (!response.ok) return null
        return await response.json()
      } catch {
        return null
      }
    },

    async startQuiz(level: "starter" | "intermediate" | "experienced"): Promise<unknown | null> {
      try {
        const response = await fetchJson("/api/v1/members/quiz/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ level }),
        })
        if (!response.ok) return null
        return await response.json()
      } catch {
        return null
      }
    },

    async submitQuiz(payload: {
      attempt_id: string
      answers: Array<{ question_id: string; selected_option_id: string }>
    }): Promise<unknown | null> {
      try {
        const response = await fetchJson("/api/v1/members/quiz/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!response.ok) return null
        return await response.json()
      } catch {
        return null
      }
    },

    async fetchQuizEvent(slug: string): Promise<unknown | null> {
      try {
        const response = await fetchJson(`/api/v1/members/quiz/events/${encodeURIComponent(slug)}`)
        if (!response.ok) return null
        return await response.json()
      } catch {
        return null
      }
    },

    async startQuizEvent(slug: string): Promise<unknown | null> {
      try {
        const response = await fetchJson(
          `/api/v1/members/quiz/events/${encodeURIComponent(slug)}/start`,
          { method: "POST" },
        )
        if (!response.ok) return null
        return await response.json()
      } catch {
        return null
      }
    },

    async submitQuizEvent(
      slug: string,
      answers: Array<{ question_id: string; selected_option_id: string }>,
    ): Promise<unknown | null> {
      try {
        const response = await fetchJson(
          `/api/v1/members/quiz/events/${encodeURIComponent(slug)}/submit`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ answers }),
          },
        )
        if (!response.ok) return null
        return await response.json()
      } catch {
        return null
      }
    },

    async fetchQuizWinners(): Promise<unknown | null> {
      try {
        const response = await fetchJson("/api/v1/quiz/winners")
        if (!response.ok) return null
        return await response.json()
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
      if (prompt && !queryIsUseful(prompt, 800, { companion: true, allowFollowUp: history.length > 0 })) {
        onChunk(queryGuidanceFor(prompt, { companion: true, allowFollowUp: history.length > 0 }))
        return
      }
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 60_000)
      let response: Response
      try {
        const extraAuth = await authHeaders()
        response = await fetchImpl(`${baseUrl}/api/v1/ai/explain`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
            ...extraAuth,
          },
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
