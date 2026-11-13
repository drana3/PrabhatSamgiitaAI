import type { ChordProposal, ProposalStatus } from "./types"

/**
 * "Your chord charts" on the Upload hub: how the member's own charts are ordered, filtered and described.
 * Pure, so every rule is tested without a screen.
 */
export type ChartFilter = "all" | ProposalStatus

/** What needs the member first comes first: a rejected chart (fix it), then a waiting one, then the live ones. */
const ATTENTION: Record<ProposalStatus, number> = { rejected: 0, pending: 1, published: 2 }

export function sortForMember(items: readonly ChordProposal[]): ChordProposal[] {
  return [...items].sort((a, b) => ATTENTION[a.status] - ATTENTION[b.status] || b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id))
}

export function filterCharts(items: readonly ChordProposal[], filter: ChartFilter): ChordProposal[] {
  return filter === "all" ? [...items] : items.filter((p) => p.status === filter)
}

export function countByStatus(items: readonly ChordProposal[]): Record<ChartFilter, number> {
  const out: Record<ChartFilter, number> = { all: items.length, pending: 0, published: 0, rejected: 0 }
  for (const p of items) out[p.status] += 1
  return out
}

/**
 * What "Edit" means for a chart: a waiting or rejected one is fixed and sent again as the same chart ("edit"); a live
 * one stays on the song page while the member makes a changed copy that goes through the review ("copy").
 */
export function editMode(p: Pick<ChordProposal, "status">): "edit" | "copy" {
  return p.status === "published" ? "copy" : "edit"
}

/** The filter chips are worth showing from this many charts on; below it the list is short enough to read. */
export const FILTER_FROM = 4

export function showFilters(items: readonly ChordProposal[]): boolean {
  return items.length >= FILTER_FROM
}

/** The address that opens the editor for a chart (see app/upload-chords.tsx). */
export function editHref(p: Pick<ChordProposal, "id" | "status">): string {
  return editMode(p) === "edit" ? `/upload-chords?edit=${encodeURIComponent(p.id)}` : `/upload-chords?copy=${encodeURIComponent(p.id)}`
}

/** The address that starts a new chart for the same song (the "offer another version" door). */
export function offerAnotherHref(p: Pick<ChordProposal, "songId" | "instrument">): string {
  return `/upload-chords?song=${p.songId}&instrument=${p.instrument}`
}

/** "3 Nov" in the app's language; an unreadable date gives an empty text rather than an error. */
export function shortDate(iso: string, language: string): string {
  const time = Date.parse(iso)
  if (!Number.isFinite(time)) return ""
  try {
    return new Intl.DateTimeFormat(language, { day: "numeric", month: "short" }).format(new Date(time))
  } catch {
    return ""
  }
}
