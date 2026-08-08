import type { ActiveSiteAnnouncement } from "@/lib/announcements"
import type { SongSummary } from "@/lib/api"
import { runtimeEnv } from "@/lib/runtime-env"

function apiBase() {
  return runtimeEnv("API_BASE_URL")
    ?? runtimeEnv("NEXT_PUBLIC_API_BASE_URL")
    ?? "http://localhost:8000"
}

export async function searchSongsOnServer(
  query: string,
  mode: "catalog" | "semantic" = "catalog",
): Promise<SongSummary[] | null> {
  const trimmed = query.trim()
  if (!trimmed) return null

  try {
    const response = await fetch(`${apiBase()}/api/v1/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: trimmed, mode }),
      cache: "no-store",
    })
    if (!response.ok) return null
    return await response.json() as SongSummary[]
  } catch {
    return null
  }
}

export async function fetchActiveAnnouncementsOnServer(): Promise<ActiveSiteAnnouncement[]> {
  try {
    const response = await fetch(`${apiBase()}/api/v1/announcements/active`, {
      cache: "no-store",
    })
    if (!response.ok) return []
    const payload = (await response.json()) as { items?: ActiveSiteAnnouncement[] }
    return payload.items ?? []
  } catch {
    return []
  }
}
