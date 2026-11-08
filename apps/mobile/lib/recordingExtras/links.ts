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

/**
 * The "Add a chart" screen of a Bhajan or a Spiritual song (the chords sit over pasted words). `edit`: a waiting or rejected
 * chart of the member's own, being fixed. `copy`: a live chart of the member's own, being changed (the new one replaces it).
 * `from`: somebody else's published chart, "Start from this chart".
 */
export function chartFormHref(input: { recordingId: string; title?: string; edit?: string; copy?: string; from?: string; instrument?: string }): string {
  const parts = [`recording=${encodeURIComponent(input.recordingId)}`]
  if (input.title) parts.push(`title=${encodeURIComponent(input.title.slice(0, 120))}`)
  if (input.edit) parts.push(`edit=${encodeURIComponent(input.edit)}`)
  else if (input.copy) parts.push(`copy=${encodeURIComponent(input.copy)}`)
  else if (input.from) parts.push(`from=${encodeURIComponent(input.from)}`)
  if (input.instrument && !input.edit && !input.copy) parts.push(`instrument=${encodeURIComponent(input.instrument)}`)
  return `/recording-chart?${parts.join("&")}`
}

/**
 * Where "add chords" or "change this chart" goes: a Bhajan or a Spiritual song takes a chart over pasted words, every other
 * recording the plain-text sheet. `chart` says which; a Kiirtan is never a chart (lib/recordingChords/kinds.ts).
 */
export function sheetFormHref(input: { chart: boolean; recordingId: string; title?: string; edit?: string; copy?: string; from?: string; instrument?: string }): string {
  return input.chart ? chartFormHref(input) : chordsFormHref({ recordingId: input.recordingId, title: input.title, edit: input.edit })
}

/** The id the API knows a recording by: the server's once it is up, the app's own for a sample of the web preview. */
export function apiIdOf(k: Pick<Kirtan, "id" | "serverId">): string {
  return k.serverId ?? k.id
}
