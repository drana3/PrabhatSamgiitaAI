import { t } from "@/lib/i18n"

import type { SongSummary } from "@prabhat/core"

/**
 * One row of the catalog as the redesigned Songs screen sees it (spec SCR-11).
 * `null` means "not known": the app never invents a duration or a play count.
 */
export type CatalogEntry = {
  number: number
  title: string
  firstLine: string | null
  /** theme, else mood, else "Other"; used by the Category sort */
  category: string
  language: string | null
  durationSeconds: number | null
  hasAudio: boolean | null
  hasDevanagari: boolean | null
  /** higher = added later; null until the API sends it */
  addedRank: number | null
  /** anonymous aggregate play count; null until the API sends it */
  plays: number | null
  /**
   * Does the song have a published chart (any instrument)? Filled by hooks/useSongsV2Catalog.ts from the API's list of
   * songs with chords; absent or null = not known (offline, or not loaded yet), which is never read as "no chords".
   */
  hasChords?: boolean | null
}

export const CATEGORY_FALLBACK = "Other"

export function summaryToEntry(
  row: SongSummary,
  options: { hasAudio?: (number: number) => boolean } = {},
): CatalogEntry {
  const category = (row.theme ?? row.mood ?? "").trim() || CATEGORY_FALLBACK
  return {
    number: row.number,
    title: displayTitle(row.title),
    firstLine: row.first_line?.trim() || null,
    category,
    language: row.language?.trim() || null,
    durationSeconds: null,
    hasAudio: options.hasAudio ? options.hasAudio(row.number) : null,
    hasDevanagari: null,
    addedRank: null,
    plays: null,
  }
}

/** 271 -> "4:31". Returns null for unknown or non-positive lengths. */
export function formatDuration(seconds: number | null | undefined): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return null
  const total = Math.round(seconds)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, "0")}`
}

/** Row eyebrow: `PS 3 · 4:31 · Offline`, or `PS 3` when the length is not known. */
export function rowEyebrow(entry: Pick<CatalogEntry, "number" | "durationSeconds">, offline = false): string {
  const parts = [`PS ${entry.number}`]
  const duration = formatDuration(entry.durationSeconds)
  if (duration) parts.push(duration)
  if (offline) parts.push(t("songs.offline"))
  return parts.join(" · ")
}

/**
 * The API sends catalog titles in capitals ("BANDHU HE NIYE CALO"); the design shows them as
 * names ("Bandhu He Niye Calo"). Titles that already have lower-case letters are left alone.
 */
export function displayTitle(title: string): string {
  const text = title.trim()
  if (!text || text !== text.toUpperCase()) return text
  return text
    .toLocaleLowerCase("en")
    .replace(/(^|[\s\-/("'])(\p{L})/gu, (_all, lead: string, letter: string) => lead + letter.toLocaleUpperCase("en"))
}

/**
 * Title used for ordering and for the fast-scroll letter: lower case,
 * diacritics folded, leading punctuation dropped.
 */
export function plainTitle(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/^[^A-Za-z0-9ऀ-ॿ]+/, "")
    .toLowerCase()
    .trim()
}

/** A to Z group letter; anything that is not a Latin letter goes to "#". */
export function groupLetter(title: string): string {
  const first = plainTitle(title).charAt(0).toUpperCase()
  return /[A-Z]/.test(first) ? first : "#"
}

/** A row for a song number the catalog has not loaded (yet). */
export function placeholderEntry(number: number, title?: string): CatalogEntry {
  return {
    number,
    title: title?.trim() || `Prabhat Samgiita ${number}`,
    firstLine: null,
    category: CATEGORY_FALLBACK,
    language: null,
    durationSeconds: null,
    hasAudio: null,
    hasDevanagari: null,
    addedRank: null,
    plays: null,
  }
}
