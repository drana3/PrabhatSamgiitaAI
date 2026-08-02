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
}

export type MemberSession = MemberProfile | { authenticated: false }

export async function fetchMemberSession(): Promise<MemberSession> {
  try {
    const response = await fetch("/api/member/session", { credentials: "same-origin", cache: "no-store" })
    if (!response.ok) return { authenticated: false }
    return await response.json() as MemberSession
  } catch {
    return { authenticated: false }
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
