import { oembedEndpoint } from "@/lib/kirtan/youtube"

/** What the public oEmbed endpoint tells about a video (no API key, no stream data). */
export type OEmbedPreview = {
  title: string
  author: string
  thumbnailUrl: string | null
}

export type OEmbedResult =
  | { ok: true; preview: OEmbedPreview }
  /**
   * unreachable: offline, blocked by CORS or timed out (the form falls back to a manual title)
   * not_found: no such video, or it is private
   * not_embeddable: the owner turned embedding off, so it could not play here
   * bad_response: YouTube answered with something that is not oEmbed JSON
   */
  | { ok: false; reason: "unreachable" | "not_found" | "not_embeddable" | "bad_response" }

/** Reads an oEmbed JSON body. A title is required; the rest is optional. */
export function parseOEmbed(json: unknown): OEmbedPreview | null {
  if (!json || typeof json !== "object") return null
  const row = json as Record<string, unknown>
  const title = typeof row.title === "string" ? row.title.trim() : ""
  if (!title) return null
  const author = typeof row.author_name === "string" ? row.author_name.trim() : ""
  const thumb = typeof row.thumbnail_url === "string" && /^https:\/\//i.test(row.thumbnail_url) ? row.thumbnail_url : null
  return { title, author, thumbnailUrl: thumb }
}

type FetchLike = (input: string, init?: { signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>

/**
 * Asks YouTube's oEmbed endpoint about a video. Never throws: a network or CORS failure is
 * `unreachable`, which the caller treats as "type the title yourself".
 */
export async function fetchOEmbed(id: string, fetchImpl?: FetchLike, timeoutMs = 6000): Promise<OEmbedResult> {
  const doFetch: FetchLike | undefined = fetchImpl ?? (typeof fetch === "function" ? (fetch as unknown as FetchLike) : undefined)
  if (!doFetch) return { ok: false, reason: "unreachable" }
  const controller = typeof AbortController === "function" ? new AbortController() : null
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null
  try {
    const response = await doFetch(oembedEndpoint(id), controller ? { signal: controller.signal } : undefined)
    if (response.status === 404) return { ok: false, reason: "not_found" }
    if (response.status === 401 || response.status === 403) return { ok: false, reason: "not_embeddable" }
    if (!response.ok) return { ok: false, reason: "unreachable" }
    const preview = parseOEmbed(await response.json())
    return preview ? { ok: true, preview } : { ok: false, reason: "bad_response" }
  } catch {
    return { ok: false, reason: "unreachable" }
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/** The sentence under the link field for a failed preview. */
export function oembedFailureMessage(reason: Extract<OEmbedResult, { ok: false }>["reason"]): string {
  switch (reason) {
    case "not_found":
      return "YouTube does not know this video, or it is private. Check the link."
    case "not_embeddable":
      return "The owner does not allow this video to play outside YouTube, so it cannot be added."
    case "bad_response":
    case "unreachable":
      return "Could not load the preview. Type the title yourself and send it anyway."
  }
}
