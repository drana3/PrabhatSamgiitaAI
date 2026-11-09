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
 * The "Words and chords" screen opened from an upload row, before the recording exists: the same editor as for a published
 * Bhajan, but the chart is kept in the upload queue (`row`) and sent when the recording is published.
 */
export function chartDraftHref(input: { row: string; kind?: string; title?: string; instrument?: string }): string {
  const parts = [`row=${encodeURIComponent(input.row)}`]
  if (input.kind) parts.push(`kind=${encodeURIComponent(input.kind)}`)
  if (input.title) parts.push(`title=${encodeURIComponent(input.title.slice(0, 120))}`)
  if (input.instrument) parts.push(`instrument=${encodeURIComponent(input.instrument)}`)
  return `/recording-chart?${parts.join("&")}`
}

/**
 * The "Add the chord cycle" screen of a Kiirtan (docs/kiirtan-cycle.md). Same ids as the chart screen: `edit` a waiting or rejected
 * cycle of the member's own, `copy` a live one of their own (the new one replaces it), `from` somebody else's published cycle
 * (`tune`: the number of a tune with no chords yet that is being added).
 */
export function cycleFormHref(input: { recordingId: string; title?: string; edit?: string; copy?: string; from?: string; instrument?: string; tune?: number }): string {
  const parts = [`recording=${encodeURIComponent(input.recordingId)}`]
  if (input.title) parts.push(`title=${encodeURIComponent(input.title.slice(0, 120))}`)
  if (input.edit) parts.push(`edit=${encodeURIComponent(input.edit)}`)
  else if (input.copy) parts.push(`copy=${encodeURIComponent(input.copy)}`)
  else if (input.from) {
    parts.push(`from=${encodeURIComponent(input.from)}`)
    if (input.tune && Number.isInteger(input.tune) && input.tune >= 1) parts.push(`tune=${input.tune}`)
  }
  if (input.instrument && !input.edit && !input.copy) parts.push(`instrument=${encodeURIComponent(input.instrument)}`)
  return `/recording-cycle?${parts.join("&")}`
}

/**
 * Where "add chords" or "change this chart" goes: a Bhajan or a Spiritual song takes a chart over pasted words, every other
 * recording the plain-text sheet. `chart` says which; a Kiirtan is never a chart (lib/recordingChords/kinds.ts).
 */
export function sheetFormHref(input: { chart: boolean; /** a Kiirtan: the chord cycle screen */ cycle?: boolean; recordingId: string; title?: string; edit?: string; copy?: string; from?: string; instrument?: string }): string {
  if (input.cycle && !input.chart) return cycleFormHref(input)
  return input.chart ? chartFormHref(input) : chordsFormHref({ recordingId: input.recordingId, title: input.title, edit: input.edit })
}

/** The id the API knows a recording by: the server's once it is up, the app's own for a sample of the web preview. */
export function apiIdOf(k: Pick<Kirtan, "id" | "serverId">): string {
  return k.serverId ?? k.id
}
