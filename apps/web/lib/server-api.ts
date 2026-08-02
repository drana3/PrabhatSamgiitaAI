import type { SongSummary } from "@/lib/api"

function apiBase() {
  return process.env.API_BASE_URL
    ?? process.env.NEXT_PUBLIC_API_BASE_URL
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
      next: { revalidate: mode === "catalog" ? 300 : 0 },
    })
    if (!response.ok) return null
    return await response.json() as SongSummary[]
  } catch {
    return null
  }
}
