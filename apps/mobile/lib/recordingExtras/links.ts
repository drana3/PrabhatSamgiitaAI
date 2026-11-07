import type { Kirtan } from "@/lib/kirtan/types"

/**
 * Where the recording extras live (docs/recording-extras.md). A recording is named by the id the API knows it by:
 * the server's id once it is up, the app's own id for a sample in the web preview.
 */
export function recordingPageHref(recordingId: string): string {
  return `/recording/${encodeURIComponent(recordingId)}`
}

/** The "Add chords" screen; `edit` is the id of a waiting or rejected chart of the member's own that is being changed. */
export function chordsFormHref(input: { recordingId: string; title?: string; edit?: string }): string {
  const parts = [`recording=${encodeURIComponent(input.recordingId)}`]
  if (input.title) parts.push(`title=${encodeURIComponent(input.title.slice(0, 120))}`)
  if (input.edit) parts.push(`edit=${encodeURIComponent(input.edit)}`)
  return `/recording-chords?${parts.join("&")}`
}

/** The id the API knows a recording by: the server's once it is up, the app's own for a sample of the web preview. */
export function apiIdOf(k: Pick<Kirtan, "id" | "serverId">): string {
  return k.serverId ?? k.id
}
