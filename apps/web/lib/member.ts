export type MemberProfile = {
  authenticated: true
  id: string
  display_name: string
  email?: string | null
  avatar_url?: string | null
  identity_provider: string
  preferred_language?: string | null
  country?: string | null
  personalization_enabled: boolean
  favorite_song_numbers: number[]
  is_admin: boolean
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
  const timeout = window.setTimeout(() => controller.abort(), 8000)
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
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  return response.ok
}

export async function fetchMemberChat(songNumber?: number) {
  const suffix = songNumber ? `?song_number=${songNumber}` : ""
  const response = await fetch(`/api/member/chat-memory${suffix}`, { cache: "no-store" })
  if (!response.ok) return { summary: "", recent_turns: [] }
  return await response.json() as {
    summary: string
    recent_turns: Array<{ role: "user" | "assistant"; content: string }>
  }
}

export async function addFavoriteSong(songNumber: number): Promise<number[] | null> {
  const response = await fetch("/api/member/favorites", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ song_number: songNumber }),
  })
  if (!response.ok) return null
  return await response.json() as number[]
}

export async function removeFavoriteSong(songNumber: number): Promise<number[] | null> {
  const response = await fetch(`/api/member/favorites/${songNumber}`, { method: "DELETE" })
  if (!response.ok) return null
  return await response.json() as number[]
}
