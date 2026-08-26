export type MemberProfile = {
  authenticated: true
  id: string
  display_name: string
  email?: string | null
  avatar_url?: string | null
  identity_provider: string
  preferred_language?: string | null
  country?: string | null
  phone_e164?: string | null
  phone_display?: string | null
  phone_country_code?: string | null
  phone_verified?: boolean
  phone_required?: boolean
  phone_verification_required?: boolean
  personalization_enabled: boolean
  favorite_song_numbers: number[]
  is_admin: boolean
  is_super_admin?: boolean
  /** False when Azure identity is present but member API/proxy cannot serve writes. */
  member_backend?: boolean
}

export type MemberSession = MemberProfile | { authenticated: false }

export function memberFirstName(displayName: string): string {
  const trimmed = displayName.trim()
  if (!trimmed) return "Member"
  if (trimmed.includes("@")) {
    const local = trimmed.split("@")[0] ?? trimmed
    const word = local.split(/[._-]/)[0] ?? local
    return word.charAt(0).toUpperCase() + word.slice(1)
  }
  return trimmed.split(/\s+/)[0] ?? "Member"
}

export async function fetchMemberSession(): Promise<MemberSession> {
  const controller = new AbortController()
  // Must stay above the member proxy session upstream timeout (12s) so we receive the
  // live API profile (including is_admin) instead of aborting into signed-out UI.
  const timeout = window.setTimeout(() => controller.abort(), 15_000)
  try {
    const response = await fetch("/api/member/session", {
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    })
    if (!response.ok) return { authenticated: false }
    return await response.json() as MemberSession
  } catch {
    return { authenticated: false }
  } finally {
    window.clearTimeout(timeout)
  }
}

export async function saveMemberChat(payload: {
  song_number?: number
  turns: Array<{ role: "user" | "assistant"; content: string }>
}) {
  const response = await fetch("/api/member/chat-memory", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  })
  return response.ok
}

export type ChatHistoryDay = {
  date: string
  turns: Array<{ role: "user" | "assistant"; content: string }>
}

export type MemberChatMemory = {
  ok: boolean
  summary: string
  recent_turns: Array<{ role: "user" | "assistant"; content: string }>
  history_days: ChatHistoryDay[]
  archived_summary: string
  monthly_summaries: Record<string, string>
}

const emptyMemberChatMemory = (): MemberChatMemory => ({
  ok: false,
  summary: "",
  recent_turns: [],
  history_days: [],
  archived_summary: "",
  monthly_summaries: {},
})

export async function fetchMemberChat(songNumber?: number): Promise<MemberChatMemory> {
  const suffix = songNumber ? `?song_number=${encodeURIComponent(String(songNumber))}` : ""
  try {
    const response = await fetch(`/api/member/chat-memory${suffix}`, {
      credentials: "same-origin",
      cache: "no-store",
    })
    if (!response.ok) return emptyMemberChatMemory()
    const body = await response.json() as {
      summary?: string
      recent_turns?: Array<{ role: "user" | "assistant"; content: string }>
      history_days?: ChatHistoryDay[]
      archived_summary?: string
      monthly_summaries?: Record<string, string>
    }
    return {
      ok: true,
      summary: body.summary ?? "",
      recent_turns: Array.isArray(body.recent_turns) ? body.recent_turns : [],
      history_days: Array.isArray(body.history_days) ? body.history_days : [],
      archived_summary: body.archived_summary ?? "",
      monthly_summaries: body.monthly_summaries ?? {},
    }
  } catch {
    return emptyMemberChatMemory()
  }
}

export type FavoriteUpdateResult =
  | { ok: true; favorites: number[] }
  | { ok: false; error: string }

async function readFavoriteUpdate(response: Response): Promise<FavoriteUpdateResult> {
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    const detail = body && typeof body === "object" && typeof (body as { detail?: unknown }).detail === "string"
      ? (body as { detail: string }).detail
      : "Could not update your playlist."
    return { ok: false, error: detail }
  }
  if (!Array.isArray(body) || body.some((value) => typeof value !== "number")) {
    return { ok: false, error: "Could not update your playlist." }
  }
  return { ok: true, favorites: body }
}

export async function addFavoriteSong(songNumber: number): Promise<FavoriteUpdateResult> {
  try {
    const response = await fetch("/api/member/favorites", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ song_number: songNumber }),
    })
    return await readFavoriteUpdate(response)
  } catch {
    return { ok: false, error: "Could not reach playlist services. Please try again." }
  }
}

export async function removeFavoriteSong(songNumber: number): Promise<FavoriteUpdateResult> {
  try {
    const response = await fetch(`/api/member/favorites/${songNumber}`, {
      method: "DELETE",
      credentials: "same-origin",
      cache: "no-store",
    })
    return await readFavoriteUpdate(response)
  } catch {
    return { ok: false, error: "Could not reach playlist services. Please try again." }
  }
}

export type PreferencesUpdateResult =
  | { ok: true; profile: MemberProfile }
  | { ok: false; error: string }

export async function updateMemberPreferences(payload: {
  display_name?: string
  preferred_language?: string | null
  country?: string | null
  personalization_enabled?: boolean
}): Promise<PreferencesUpdateResult> {
  try {
    const response = await fetch("/api/member/preferences", {
      method: "PATCH",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const body = await response.json().catch(() => null)
    if (!response.ok) {
      const detail =
        body && typeof body === "object" && typeof (body as { detail?: unknown }).detail === "string"
          ? (body as { detail: string }).detail
          : "Could not update your profile."
      return { ok: false, error: detail }
    }
    if (!body || typeof body !== "object" || (body as { authenticated?: unknown }).authenticated !== true) {
      return { ok: false, error: "Could not update your profile." }
    }
    return { ok: true, profile: body as MemberProfile }
  } catch {
    return { ok: false, error: "Could not reach profile services. Please try again." }
  }
}
