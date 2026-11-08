import { RECORDING_KINDS, type RecordingKind } from "@/lib/kirtan/types"

/**
 * What the Radio can play, as the person picks it: the app's own kinds (lib/kirtan/types.ts RECORDING_KINDS), nothing
 * invented. `prabhat_samgiita` holds the official catalogue songs AND the Prabhat Samgiita performances people uploaded;
 * every other kind is its recordings. Pure: no React, no stores, no I/O.
 */

export type RadioCategory = RecordingKind

/** In the order the chips show: the songs first, Baba's voice last. */
export const RADIO_CATEGORIES: readonly RadioCategory[] = [
  "prabhat_samgiita",
  "kiirtan",
  "bhajan",
  "spiritual_song",
  "dance_song",
  "baba_audio",
]

/** Stored with the selection: bump it when the ids or the meaning of the stored value change. */
export const RADIO_SELECTION_VERSION = 2

/**
 * A first-time listener hears everything the app has: every category is ticked (Dada's decision). A category with nothing
 * to play is skipped by `effectiveSelection`, and one that gets its first recording later joins the Radio by itself.
 */
export const DEFAULT_RADIO_SELECTION: readonly RadioCategory[] = RADIO_CATEGORIES

/** What version 1 stored as its default (Prabhat Samgiita only): it was never a choice, so version 2 turns it into "all". */
export const LEGACY_DEFAULT_SELECTION: readonly RadioCategory[] = ["prabhat_samgiita"]

export type RadioCounts = Readonly<Record<RadioCategory, number>>

export const NO_COUNTS: RadioCounts = {
  prabhat_samgiita: 0,
  kiirtan: 0,
  bhajan: 0,
  spiritual_song: 0,
  dance_song: 0,
  baba_audio: 0,
}

export function isRadioCategory(value: unknown): value is RadioCategory {
  return typeof value === "string" && (RADIO_CATEGORIES as readonly string[]).includes(value)
}

/** The category of a stored kind id (the removed `devotional_song` reads as a Bhajan); null for an unknown id. */
export function radioCategoryOf(kind: unknown): RadioCategory | null {
  if (kind === "devotional_song") return "bhajan"
  return isRadioCategory(kind) ? kind : null
}

/** A stored value that is not a list of known ids is dropped; the result has no repeats, is in chip order and is never empty. */
export function sanitizeSelection(raw: unknown): RadioCategory[] {
  const wanted = Array.isArray(raw) ? raw.map(radioCategoryOf) : []
  const picked = RADIO_CATEGORIES.filter((c) => wanted.includes(c))
  return picked.length ? picked : [...DEFAULT_RADIO_SELECTION]
}

const hasTracks = (counts: RadioCounts, c: RadioCategory) => (counts[c] ?? 0) > 0

/**
 * The categories the Radio really draws from: the chosen ones that have something to play. When none of the chosen has
 * (a category emptied since it was chosen), it falls back to the default, then to any category that has tracks.
 * Empty only when nothing at all can play.
 */
export function effectiveSelection(selected: readonly RadioCategory[], counts: RadioCounts): RadioCategory[] {
  const live = RADIO_CATEGORIES.filter((c) => selected.includes(c) && hasTracks(counts, c))
  if (live.length) return live
  const fallback = DEFAULT_RADIO_SELECTION.filter((c) => hasTracks(counts, c))
  if (fallback.length) return [...fallback]
  return RADIO_CATEGORIES.filter((c) => hasTracks(counts, c))
}

export type ToggleResult = "added" | "removed" | "last" | "empty"

/**
 * One tap on a chip. A category with nothing to play cannot be chosen ("empty"); the last chosen one cannot be switched
 * off ("last": the screen says so gently). Judged against the EFFECTIVE selection, so a stale tick on an emptied
 * category never counts as "another one is still on".
 */
export function toggleCategory(
  selected: readonly RadioCategory[],
  id: RadioCategory,
  counts: RadioCounts,
): { selected: RadioCategory[]; result: ToggleResult } {
  const current = effectiveSelection(selected, counts)
  const on = current.includes(id)
  if (on) {
    if (current.length <= 1) return { selected: current, result: "last" }
    return { selected: current.filter((c) => c !== id), result: "removed" }
  }
  if (!hasTracks(counts, id)) return { selected: current, result: "empty" }
  return { selected: RADIO_CATEGORIES.filter((c) => c === id || current.includes(c)), result: "added" }
}

/** The "All" shortcut: every category, so one that gets its first recording later is included too (empty ones are skipped). */
export function selectAll(_counts?: RadioCounts): RadioCategory[] {
  return [...RADIO_CATEGORIES]
}

export function isAllSelected(selected: readonly RadioCategory[], counts: RadioCounts): boolean {
  const live = RADIO_CATEGORIES.filter((c) => hasTracks(counts, c))
  const current = effectiveSelection(selected, counts)
  return live.length > 0 && live.every((c) => current.includes(c))
}

export type SummaryLine =
  | { type: "all" }
  | { type: "list"; shown: RadioCategory[]; more: number }

/**
 * What the one-line summary says ("Kiirtan · Bhajan", "All categories", "Kiirtan · Bhajan +2"). The screen turns the ids
 * into the app's own words. Three names fit on a line; more fold into "+N".
 */
export function summaryLine(selected: readonly RadioCategory[], counts: RadioCounts, maxShown = 3): SummaryLine {
  const live = RADIO_CATEGORIES.filter((c) => hasTracks(counts, c))
  const current = effectiveSelection(selected, counts)
  if (live.length > 1 && current.length === live.length) return { type: "all" }
  const shown = current.length > maxShown ? current.slice(0, maxShown - 1) : current
  return { type: "list", shown, more: current.length - shown.length }
}
